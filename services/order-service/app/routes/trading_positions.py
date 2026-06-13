"""
Trading positions derived from Trade records.
Day positions: MIS trades from today.
Net positions: all open CNC/NRML trades netted against sells.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trade import Trade
from app.models.instrument import Instrument
from app.models.order import OrderSide, ProductType
from app.core.dependencies import get_current_user, CurrentUser
from app.services.price_feed import get_ltp

router = APIRouter(prefix="/trading/positions", tags=["Trading Positions"])


class PositionResponse(BaseModel):
    symbol: str
    exchange: str
    product_type: str
    buy_qty: int
    sell_qty: int
    net_qty: int
    avg_buy_price: Decimal
    avg_sell_price: Decimal
    ltp: Decimal
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    is_open: bool


def _net_positions(trades: list[Trade]) -> dict[str, dict]:
    pos: dict[str, dict] = {}
    for t in trades:
        key = (t.symbol, t.product_type.value)
        if key not in pos:
            pos[key] = {
                "symbol": t.symbol,
                "exchange": t.exchange,
                "product_type": t.product_type.value,
                "buy_qty": 0,
                "sell_qty": 0,
                "buy_value": Decimal("0"),
                "sell_value": Decimal("0"),
            }
        p = pos[key]
        qty = t.fill_qty
        price = Decimal(str(t.fill_price))
        if t.side == OrderSide.BUY:
            p["buy_qty"] += qty
            p["buy_value"] += price * qty
        else:
            p["sell_qty"] += qty
            p["sell_value"] += price * qty
    return pos


@router.get("", response_model=list[PositionResponse])
async def get_positions(
    client_id: UUID = Query(...),
    type: str = Query("day", regex="^(day|net)$"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Trade).where(Trade.client_id == client_id)
    if not current_user.is_admin:
        q = q.where(Trade.managed_by == current_user.user_id)

    if type == "day":
        today = datetime.now(timezone.utc).date()
        q = q.where(Trade.product_type == ProductType.MIS)
        trades = (await db.execute(q)).scalars().all()
        trades = [t for t in trades if t.traded_at.date() == today]
    else:
        q = q.where(Trade.product_type.in_([ProductType.CNC, ProductType.NRML]))
        trades = (await db.execute(q)).scalars().all()

    raw = _net_positions(trades)
    results = []
    for (symbol, pt), p in raw.items():
        ltp = await get_ltp(symbol, db)
        buy_qty = p["buy_qty"]
        sell_qty = p["sell_qty"]
        net_qty = buy_qty - sell_qty
        avg_buy = p["buy_value"] / buy_qty if buy_qty else Decimal("0")
        avg_sell = p["sell_value"] / sell_qty if sell_qty else Decimal("0")

        matched = min(buy_qty, sell_qty)
        realized = (avg_sell - avg_buy) * matched if matched > 0 else Decimal("0")
        unrealized = (ltp - avg_buy) * net_qty if net_qty > 0 else Decimal("0")

        results.append(PositionResponse(
            symbol=symbol,
            exchange=p["exchange"],
            product_type=pt,
            buy_qty=buy_qty,
            sell_qty=sell_qty,
            net_qty=net_qty,
            avg_buy_price=avg_buy.quantize(Decimal("0.01")),
            avg_sell_price=avg_sell.quantize(Decimal("0.01")),
            ltp=ltp,
            unrealized_pnl=unrealized.quantize(Decimal("0.01")),
            realized_pnl=realized.quantize(Decimal("0.01")),
            is_open=net_qty != 0,
        ))

    return results
