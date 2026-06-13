import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.models.order import OrderSide, ProductType


def _now():
    return datetime.now(timezone.utc)


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        Index("ix_trades_order_id", "order_id"),
        Index("ix_trades_client_id", "client_id"),
        Index("ix_trades_traded_at", "traded_at"),
        {"schema": "orders"},
    )

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id     = Column(UUID(as_uuid=True), ForeignKey("orders.orders.id"), nullable=False)
    client_id    = Column(UUID(as_uuid=True), nullable=False)
    managed_by   = Column(UUID(as_uuid=True), nullable=False)
    symbol       = Column(String(30), nullable=False)
    exchange     = Column(String(10), nullable=False)
    side         = Column(Enum(OrderSide, schema="orders"), nullable=False)
    fill_qty     = Column(Integer, nullable=False)
    fill_price   = Column(Numeric(15, 4), nullable=False)
    product_type = Column(Enum(ProductType, schema="orders"), nullable=False, default=ProductType.CNC)
    traded_at    = Column(DateTime(timezone=True), default=_now)
