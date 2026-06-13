from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trade import Trade
from app.models.order import OrderSide, ProductType
from app.core.dependencies import get_current_user, CurrentUser

router = APIRouter(prefix="/trades", tags=["Trades"])


class TradeResponse(BaseModel):
    id: UUID
    order_id: UUID
    client_id: UUID
    managed_by: UUID
    symbol: str
    exchange: str
    side: OrderSide
    fill_qty: int
    fill_price: Decimal
    product_type: ProductType
    traded_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[TradeResponse])
async def list_trades(
    client_id: Optional[UUID] = None,
    symbol: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Trade)

    if not current_user.is_admin:
        q = q.where(Trade.managed_by == current_user.user_id)

    if client_id:
        q = q.where(Trade.client_id == client_id)
    if symbol:
        q = q.where(Trade.symbol.ilike(f"%{symbol}%"))
    if date_from:
        q = q.where(Trade.traded_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(Trade.traded_at <= datetime.fromisoformat(date_to))

    q = q.order_by(Trade.traded_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).scalars().all()
    return list(rows)
