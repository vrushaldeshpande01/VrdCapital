import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, Numeric, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _now():
    return datetime.now(timezone.utc)


class ClientFund(Base):
    __tablename__ = "client_funds"
    __table_args__ = (
        Index("ix_client_funds_client_id", "client_id"),
        {"schema": "orders"},
    )

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), unique=True, nullable=False)
    available = Column(Numeric(18, 4), nullable=False, default=Decimal("500000"))
    used      = Column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    total     = Column(Numeric(18, 4), nullable=False, default=Decimal("500000"))
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
