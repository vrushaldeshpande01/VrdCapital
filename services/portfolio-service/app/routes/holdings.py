from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.portfolio import Holding, HoldingStatus
from app.schemas.portfolio import HoldingCreate, HoldingUpdate, HoldingResponse, BulkPriceUpdateRequest
from app.services import calculations as calc
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser

router = APIRouter(prefix="/holdings", tags=["Holdings"])


@router.post("", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
async def create_holding(
    body: HoldingCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    # Upsert: if holding for same client+broker+symbol exists, update it
    result = await db.execute(
        select(Holding).where(
            and_(
                Holding.client_id == body.client_id,
                Holding.broker_account_id == body.broker_account_id,
                Holding.symbol == body.symbol,
                Holding.status == HoldingStatus.ACTIVE,
            )
        )
    )
    holding = result.scalar_one_or_none()

    if holding:
        # Average down/up logic
        old_qty = float(holding.quantity)
        new_qty = float(body.quantity)
        old_avg = float(holding.average_buy_price)
        new_avg = float(body.average_buy_price)
        total_qty = old_qty + new_qty
        holding.average_buy_price = ((old_qty * old_avg) + (new_qty * new_avg)) / total_qty
        holding.quantity = total_qty
    else:
        holding = Holding(**body.model_dump())
        db.add(holding)

    if body.current_price:
        holding.current_price = body.current_price
        holding.last_price_updated_at = datetime.now(timezone.utc)
    if body.previous_close:
        holding.previous_close = body.previous_close

    holding.recalculate()
    await db.flush()
    await db.refresh(holding)
    return holding


@router.get("", response_model=list[HoldingResponse])
async def list_holdings(
    client_id: UUID = Query(...),
    broker_account_id: Optional[UUID] = None,
    asset_class: Optional[str] = None,
    sector: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Holding).where(
        and_(Holding.client_id == client_id, Holding.status == HoldingStatus.ACTIVE)
    )
    if broker_account_id:
        q = q.where(Holding.broker_account_id == broker_account_id)
    if asset_class:
        q = q.where(Holding.asset_class == asset_class)
    if sector:
        q = q.where(Holding.sector == sector)

    q = q.order_by(Holding.current_value.desc().nullslast())
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{holding_id}", response_model=HoldingResponse)
async def update_holding(
    holding_id: UUID,
    body: HoldingUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(Holding).where(Holding.id == holding_id))
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(holding, field, value)

    if body.current_price:
        holding.last_price_updated_at = datetime.now(timezone.utc)

    holding.recalculate()
    await db.flush()
    await db.refresh(holding)
    return holding


@router.patch("/{holding_id}/price", response_model=HoldingResponse)
async def update_holding_price(
    holding_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    """Lightweight price-only update called by broker-service sync engine."""
    result = await db.execute(select(Holding).where(Holding.id == holding_id))
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    if "current_price" in body:
        holding.current_price = body["current_price"]
        holding.last_price_updated_at = datetime.now(timezone.utc)
    if "previous_close" in body:
        holding.previous_close = body["previous_close"]
    holding.recalculate()
    await db.flush()
    await db.refresh(holding)
    return holding


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_holding(
    holding_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(Holding).where(Holding.id == holding_id))
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    holding.status = HoldingStatus.CLOSED


@router.post("/price-update", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_price_update(
    body: BulkPriceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    """Update live prices for multiple symbols at once (called after market data sync)."""
    for price_data in body.prices:
        result = await db.execute(
            select(Holding).where(
                and_(Holding.symbol == price_data.symbol, Holding.status == HoldingStatus.ACTIVE)
            )
        )
        holdings = result.scalars().all()
        for h in holdings:
            h.current_price = price_data.current_price
            if price_data.previous_close:
                h.previous_close = price_data.previous_close
            h.last_price_updated_at = datetime.now(timezone.utc)
            h.recalculate()
