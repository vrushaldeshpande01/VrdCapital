import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Integer, Numeric, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class BrokerName(str, enum.Enum):
    ZERODHA = "zerodha"
    UPSTOX = "upstox"
    ANGELONE = "angelone"


class SyncStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    RUNNING = "running"


class SyncType(str, enum.Enum):
    HOLDINGS = "holdings"
    POSITIONS = "positions"
    PRICES = "prices"
    FULL = "full"


class BrokerCredential(Base):
    __tablename__ = "broker_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    broker = Column(Enum(BrokerName, name="brokername", create_type=False), nullable=False)

    # Broker account identifiers
    account_id = Column(String(100), nullable=False)        # Broker's client/account ID
    display_name = Column(String(200), nullable=True)       # e.g. "Zerodha - ZD1234"

    # Encrypted credentials (populated when live mode)
    api_key_encrypted = Column(Text, nullable=True)
    api_secret_encrypted = Column(Text, nullable=True)
    access_token_encrypted = Column(Text, nullable=True)    # OAuth access token
    token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Mode: sandbox uses mock data, live calls real broker API
    is_sandbox = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(20), nullable=True)
    total_syncs = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SyncLog(Base):
    __tablename__ = "broker_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    credential_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    broker = Column(String(20), nullable=False)
    sync_type = Column(Enum(SyncType, name="synctype", create_type=False), nullable=False)
    status = Column(Enum(SyncStatus, name="syncstatus", create_type=False), nullable=False)
    records_synced = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class MarketPrice(Base):
    """Cache table for latest market prices."""
    __tablename__ = "market_prices"

    symbol = Column(String(30), primary_key=True)
    exchange = Column(String(10), default="NSE")
    ltp = Column(Numeric(12, 2), nullable=False)        # Last traded price
    open_price = Column(Numeric(12, 2), nullable=True)
    high_price = Column(Numeric(12, 2), nullable=True)
    low_price = Column(Numeric(12, 2), nullable=True)
    prev_close = Column(Numeric(12, 2), nullable=True)
    change = Column(Numeric(10, 2), nullable=True)
    change_pct = Column(Numeric(8, 4), nullable=True)
    volume = Column(BigInteger, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
