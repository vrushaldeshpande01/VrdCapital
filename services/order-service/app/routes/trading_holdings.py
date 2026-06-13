"""
Trading holdings — CNC positions built up via BUY orders and reduced by SELL orders.
Distinct from portfolio-service holdings (which are broker-synced DEMAT positions).
"""
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trade import Trade
from app.models.order import OrderSide, ProductType
from app.core.dependencies import get_current_user, CurrentUser
from app.services.price_feed import get_ltp

router = APIRouter(prefix="/trading/holdings", tags=["Trading Holdings"])


class HoldingResponse(BaseModel):
    symbol: str
    exchange: str
    quantity: int
    avg_buy_price: Decimal
    current_value: Decimal
    invested_value: Decimal
    pnl: Decimal
    pnl_pct: Decimal
    ltp: Decimal


@router.get("", response_model=list[HoldingResponse])
async def get_holdings(
    client_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Trade).where(
        Trade.client_id == client_id,
        Trade.product_type == ProductType.CNC,
    )
    if not current_user.is_admin:
        q = q.where(Trade.managed_by == current_user.user_id)

    trades = (await db.execute(q)).scalars().all()

    # Aggregate net CNC holdings per symbol
    agg: dict[str, dict] = {}
    for t in trades:
        sym = t.symbol
        if sym not in agg:
            agg[sym] = {"exchange": t.exchange, "buy_qty": 0, "sell_qty": 0, "buy_value": Decimal("0")}
        a = agg[sym]
        if t.side == OrderSide.BUY:
            a["buy_qty"] += t.fill_qty
            a["buy_value"] += Decimal(str(t.fill_price)) * t.fill_qty
        else:
            # SELL reduces holding
            a["sell_qty"] += t.fill_qty

    results = []
    for sym, a in agg.items():
        net_qty = a["buy_qty"] - a["sell_qty"]
        if net_qty <= 0:
            continue  # fully sold

        avg_buy = a["buy_value"] / a["buy_qty"] if a["buy_qty"] else Decimal("0")
        ltp = await get_ltp(sym, db)
        invested = avg_buy * net_qty
        current = ltp * net_qty
        pnl = current - invested
        pnl_pct = (pnl / invested * 100) if invested else Decimal("0")

        results.append(HoldingResponse(
            symbol=sym,
            exchange=a["exchange"],
            quantity=net_qty,
            avg_buy_price=avg_buy.quantize(Decimal("0.01")),
            current_value=current.quantize(Decimal("0.01")),
            invested_value=invested.quantize(Decimal("0.01")),
            pnl=pnl.quantize(Decimal("0.01")),
            pnl_pct=pnl_pct.quantize(Decimal("0.01")),
            ltp=ltp,
        ))

    return sorted(results, key=lambda h: h.current_value, reverse=True)
