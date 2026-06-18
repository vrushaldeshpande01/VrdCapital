import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class AlertCondition(str, enum.Enum):
    PRICE_ABOVE   = "price_above"
    PRICE_BELOW   = "price_below"
    CHANGE_PCT_UP = "change_pct_up"    # % gain from previous close
    CHANGE_PCT_DN = "change_pct_dn"    # % loss from previous close
    PNL_ABOVE     = "pnl_above"        # portfolio unrealized P&L above threshold
    PNL_BELOW     = "pnl_below"


class AlertStatus(str, enum.Enum):
    ACTIVE    = "active"
    TRIGGERED = "triggered"
    PAUSED    = "paused"
    DELETED   = "deleted"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # What to watch
    symbol     = Column(String(30), nullable=True)    # None for portfolio-level alerts
    client_id  = Column(UUID(as_uuid=True), nullable=True)   # for portfolio alerts

    condition  = Column(SAEnum(AlertCondition, name="alertcondition", create_type=True), nullable=False)
    threshold  = Column(Numeric(16, 4), nullable=False)

    label      = Column(String(200), nullable=True)   # user-defined description
    status     = Column(SAEnum(AlertStatus, name="alertstatus", create_type=True), nullable=False, default=AlertStatus.ACTIVE)

    # How many times to fire (None = unlimited)
    repeat_count = Column(Integer, nullable=True, default=1)
    fired_count  = Column(Integer, default=0, nullable=False)

    triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
