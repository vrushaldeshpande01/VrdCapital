from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.database import get_db
from app.models.portfolio import Holding, Position, CashBalance, PortfolioSnapshot, HoldingStatus
from app.schemas.portfolio import (
    PortfolioSummary, AUMSummary, SectorAllocation,
    TopHolding, PortfolioSnapshotResponse
)
from app.services import calculations as calc
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


async def _get_active_holdings(db: AsyncSession, client_id: UUID) -> list:
    result = await db.execute(
        select(Holding).where(
            and_(Holding.client_id == client_id, Holding.status == HoldingStatus.ACTIVE)
        )
    )
    return result.scalars().all()


async def _get_cash(db: AsyncSession, client_id: UUID) -> Decimal:
    # Use total_balance (net available after margin) not available_cash (gross)
    result = await db.execute(
        select(func.sum(CashBalance.total_balance)).where(CashBalance.client_id == client_id)
    )
    return result.scalar() or Decimal("0")


@router.get("/summary/{client_id}", response_model=PortfolioSummary)
async def get_portfolio_summary(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    holdings = await _get_active_holdings(db, client_id)
    cash = await _get_cash(db, client_id)

    holdings_val = calc.aggregate_holdings_value(holdings)
    invested_val = calc.aggregate_invested_value(holdings)
    unrealized = calc.aggregate_unrealized_pnl(holdings)
    day_pnl = calc.aggregate_day_pnl(holdings)
    total_val = calc.portfolio_value(cash, holdings_val)

    unrealized_pct = None
    if invested_val > 0:
        unrealized_pct = calc.round4((unrealized / invested_val) * 100)

    day_ret_pct = None
    if holdings_val > 0:
        prev_val = holdings_val - day_pnl
        if prev_val > 0:
            day_ret_pct = calc.round4((day_pnl / prev_val) * 100)

    sectors = calc.sector_allocation(holdings)
    tops = calc.top_holdings(holdings)

    top_list = []
    for h in tops:
        weight = float(calc.round2((calc.to_dec(h.current_value or 0) / holdings_val) * 100)) if holdings_val > 0 else 0
        top_list.append(TopHolding(
            symbol=h.symbol,
            name=h.name,
            sector=h.sector,
            current_value=float(h.current_value or 0),
            unrealized_pnl=float(h.unrealized_pnl or 0),
            unrealized_pnl_pct=float(h.unrealized_pnl_pct or 0),
            weight_pct=weight,
        ))

    return PortfolioSummary(
        client_id=client_id,
        holdings_value=holdings_val,
        invested_value=invested_val,
        cash_balance=cash,
        total_value=total_val,
        unrealized_pnl=unrealized,
        unrealized_pnl_pct=unrealized_pct,
        day_pnl=day_pnl,
        day_return_pct=day_ret_pct,
        total_holdings=len(holdings),
        sector_allocation=[SectorAllocation(**s) for s in sectors],
        top_holdings=top_list,
    )


@router.get("/aum", response_model=AUMSummary)
async def get_aum(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Aggregate AUM across all clients — for dashboard top cards."""
    result = await db.execute(
        select(Holding).where(Holding.status == HoldingStatus.ACTIVE)
    )
    all_holdings = result.scalars().all()

    cash_result = await db.execute(select(func.sum(CashBalance.total_balance)))
    total_cash = cash_result.scalar() or Decimal("0")

    client_result = await db.execute(
        select(func.count(func.distinct(Holding.client_id))).where(Holding.status == HoldingStatus.ACTIVE)
    )
    total_clients = client_result.scalar() or 0

    holdings_val = calc.aggregate_holdings_value(all_holdings)
    invested_val = calc.aggregate_invested_value(all_holdings)
    unrealized = calc.aggregate_unrealized_pnl(all_holdings)
    day_pnl = calc.aggregate_day_pnl(all_holdings)
    total_aum = calc.portfolio_value(total_cash, holdings_val)

    day_ret = None
    prev_val = holdings_val - day_pnl
    if prev_val > 0:
        day_ret = calc.round4((day_pnl / prev_val) * 100)

    return AUMSummary(
        total_aum=total_aum,
        total_clients=total_clients,
        total_holdings_value=holdings_val,
        total_cash=total_cash,
        total_invested=invested_val,
        total_unrealized_pnl=unrealized,
        total_day_pnl=day_pnl,
        day_return_pct=day_ret,
    )


@router.get("/history/{client_id}", response_model=List[PortfolioSnapshotResponse])
async def get_portfolio_history(
    client_id: UUID,
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(PortfolioSnapshot).where(
            and_(
                PortfolioSnapshot.client_id == client_id,
                PortfolioSnapshot.snapshot_date >= since,
            )
        ).order_by(PortfolioSnapshot.snapshot_date.asc())
    )
    return result.scalars().all()


@router.post("/snapshot/{client_id}", status_code=201)
async def create_daily_snapshot(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    """Capture today's portfolio value as a snapshot. Called by a daily scheduler."""
    holdings = await _get_active_holdings(db, client_id)
    cash = await _get_cash(db, client_id)

    holdings_val = calc.aggregate_holdings_value(holdings)
    invested_val = calc.aggregate_invested_value(holdings)
    total_val = calc.portfolio_value(cash, holdings_val)
    day_pnl = calc.aggregate_day_pnl(holdings)

    today = date.today()

    # Get yesterday's snapshot for daily return
    yesterday = today - timedelta(days=1)
    prev_result = await db.execute(
        select(PortfolioSnapshot).where(
            and_(PortfolioSnapshot.client_id == client_id, PortfolioSnapshot.snapshot_date == yesterday)
        )
    )
    prev_snap = prev_result.scalar_one_or_none()

    day_ret_pct = None
    total_pnl = total_val - invested_val if invested_val > 0 else None
    total_ret_pct = None
    if prev_snap and prev_snap.total_value > 0:
        day_ret_pct = calc.round4(((total_val - prev_snap.total_value) / prev_snap.total_value) * 100)
    if invested_val > 0 and total_pnl is not None:
        total_ret_pct = calc.round4((total_pnl / invested_val) * 100)

    # Upsert today's snapshot
    existing = await db.execute(
        select(PortfolioSnapshot).where(
            and_(PortfolioSnapshot.client_id == client_id, PortfolioSnapshot.snapshot_date == today)
        )
    )
    snap = existing.scalar_one_or_none()
    if not snap:
        snap = PortfolioSnapshot(client_id=client_id, snapshot_date=today)
        db.add(snap)

    snap.holdings_value = holdings_val
    snap.cash_balance = cash
    snap.total_value = total_val
    snap.invested_value = invested_val
    snap.day_pnl = day_pnl
    snap.day_return_pct = day_ret_pct
    snap.total_pnl = total_pnl
    snap.total_return_pct = total_ret_pct

    await db.flush()
    return {"message": "Snapshot created", "date": str(today), "total_value": float(total_val)}


@router.get("/cash/{client_id}")
async def get_cash_balance(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(CashBalance).where(CashBalance.client_id == client_id)
    )
    balances = result.scalars().all()
    total = sum(float(b.available_cash) for b in balances)
    return {
        "client_id": str(client_id),
        "total_available_cash": total,
        "accounts": [
            {
                "broker_account_id": str(b.broker_account_id),
                "available_cash": float(b.available_cash),
                "used_margin": float(b.used_margin),
                "total_balance": float(b.total_balance),
                "last_synced_at": b.last_synced_at,
            }
            for b in balances
        ],
    }


@router.post("/cash")
async def upsert_cash_balance_body(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    """Called by broker-service sync engine with {client_id, broker_account_id, ...}"""
    from datetime import datetime, timezone
    client_id = UUID(body["client_id"])
    broker_account_id = UUID(body["broker_account_id"])
    result = await db.execute(
        select(CashBalance).where(CashBalance.broker_account_id == broker_account_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        balance = CashBalance(client_id=client_id, broker_account_id=broker_account_id)
        db.add(balance)
    balance.available_cash = body.get("available_cash", 0)
    balance.used_margin = body.get("used_margin", 0)
    balance.total_balance = body.get("total_balance", 0)
    balance.last_synced_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Cash balance updated"}


@router.post("/cash/{client_id}/{broker_account_id}")
async def upsert_cash_balance(
    client_id: UUID,
    broker_account_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    from datetime import datetime, timezone
    result = await db.execute(
        select(CashBalance).where(CashBalance.broker_account_id == broker_account_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        balance = CashBalance(client_id=client_id, broker_account_id=broker_account_id)
        db.add(balance)

    balance.available_cash = body.get("available_cash", 0)
    balance.used_margin = body.get("used_margin", 0)
    balance.total_balance = body.get("total_balance", 0)
    balance.last_synced_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Cash balance updated"}
