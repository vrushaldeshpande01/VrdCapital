import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime,
    ForeignKey, Text, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ProductType(str, PyEnum):
    CNC  = "CNC"
    MIS  = "MIS"
    NRML = "NRML"


class Validity(str, PyEnum):
    DAY = "DAY"
    IOC = "IOC"
    TTL = "TTL"


class OrderStatus(str, PyEnum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    OPEN = "OPEN"
    EXECUTED = "EXECUTED"
    PARTIALLY_EXECUTED = "PARTIALLY_EXECUTED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class OrderSide(str, PyEnum):
    BUY = "BUY"
    SELL = "SELL"


class PriceType(str, PyEnum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"
    SL_M = "SL_M"


class BasketStatus(str, PyEnum):
    DRAFT = "DRAFT"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"


def _now():
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_client_id", "client_id"),
        Index("ix_orders_status", "status"),
        Index("ix_orders_placed_at", "placed_at"),
        {"schema": "orders"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    broker_credential_id = Column(UUID(as_uuid=True), nullable=True)
    broker = Column(String(50), nullable=False)
    managed_by = Column(UUID(as_uuid=True), nullable=False)

    # Instrument
    symbol = Column(String(50), nullable=False)
    exchange = Column(String(10), nullable=False, default="NSE")
    isin = Column(String(12), nullable=True)

    # Instrument reference (optional — symbol/exchange always stored directly)
    instrument_id = Column(UUID(as_uuid=True), nullable=True)

    # Order params
    side = Column(Enum(OrderSide, schema="orders"), nullable=False)
    price_type = Column(Enum(PriceType, schema="orders"), nullable=False, default=PriceType.MARKET)
    product_type = Column(Enum(ProductType, schema="orders"), nullable=False, default=ProductType.CNC)
    validity = Column(Enum(Validity, schema="orders"), nullable=False, default=Validity.DAY)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(12, 4), nullable=True)
    trigger_price = Column(Numeric(12, 4), nullable=True)
    tag = Column(String(100), nullable=True)

    # Execution result
    status = Column(Enum(OrderStatus, schema="orders"), nullable=False, default=OrderStatus.PENDING)
    broker_order_id = Column(String(100), nullable=True)
    executed_quantity = Column(Integer, nullable=False, default=0)
    average_price = Column(Numeric(12, 4), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Basket reference
    basket_id = Column(UUID(as_uuid=True), ForeignKey("orders.basket_orders.id"), nullable=True)

    # Timestamps
    placed_at = Column(DateTime(timezone=True), default=_now)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class BasketOrder(Base):
    __tablename__ = "basket_orders"
    __table_args__ = {"schema": "orders"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)

    status = Column(Enum(BasketStatus, schema="orders"), nullable=False, default=BasketStatus.DRAFT)
    total_orders = Column(Integer, nullable=False, default=0)
    executed_orders = Column(Integer, nullable=False, default=0)
    failed_orders = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=_now)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class BasketOrderItem(Base):
    __tablename__ = "basket_order_items"
    __table_args__ = {"schema": "orders"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    basket_id = Column(UUID(as_uuid=True), ForeignKey("orders.basket_orders.id"), nullable=False)

    symbol = Column(String(50), nullable=False)
    exchange = Column(String(10), nullable=False, default="NSE")
    side = Column(Enum(OrderSide, schema="orders"), nullable=False)
    price_type = Column(Enum(PriceType, schema="orders"), nullable=False, default=PriceType.MARKET)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(12, 4), nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now)
