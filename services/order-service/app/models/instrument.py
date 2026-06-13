import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Integer, Numeric, DateTime, Enum, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class InstrumentType(str, PyEnum):
    EQUITY   = "EQUITY"
    FUTURES  = "FUTURES"
    OPTIONS  = "OPTIONS"
    CURRENCY = "CURRENCY"


def _now():
    return datetime.now(timezone.utc)


class Instrument(Base):
    __tablename__ = "instruments"
    __table_args__ = (
        Index("ix_instruments_symbol", "symbol"),
        Index("ix_instruments_type", "instrument_type"),
        {"schema": "orders"},
    )

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol          = Column(String(30), unique=True, nullable=False)
    name            = Column(String(200), nullable=False)
    exchange        = Column(String(10), nullable=False)
    instrument_type = Column(Enum(InstrumentType, schema="orders"), nullable=False)
    lot_size        = Column(Integer, nullable=False, default=1)
    tick_size       = Column(Numeric(10, 4), nullable=False, default=Decimal("0.05"))
    ltp             = Column(Numeric(15, 4), nullable=False, default=Decimal("0"))
    created_at      = Column(DateTime(timezone=True), default=_now)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)
