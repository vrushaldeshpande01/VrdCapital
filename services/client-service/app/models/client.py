import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey,
    Enum, Text, Numeric, Integer, Date
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ClientStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    ONBOARDING = "onboarding"


class RiskProfile(str, enum.Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class BrokerName(str, enum.Enum):
    ZERODHA = "zerodha"
    UPSTOX = "upstox"
    ANGELONE = "angelone"


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    REVOKED = "revoked"


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Links to auth service user
    managed_by = Column(UUID(as_uuid=True), nullable=False, index=True)  # Portfolio Manager user_id

    # Personal Info
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False)
    pan_number = Column(String(10), unique=True, nullable=True, index=True)
    date_of_birth = Column(Date, nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), default="India")

    # Financial Info
    annual_income = Column(Numeric(15, 2), nullable=True)
    investment_goal = Column(Text, nullable=True)
    risk_profile = Column(Enum(RiskProfile), default=RiskProfile.MODERATE, nullable=False)
    investment_horizon_years = Column(Integer, nullable=True)

    # Status
    status = Column(Enum(ClientStatus), default=ClientStatus.ONBOARDING, nullable=False)
    kyc_verified = Column(Boolean, default=False, nullable=False)
    kyc_verified_at = Column(DateTime(timezone=True), nullable=True)

    # Meta
    notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    broker_accounts = relationship("BrokerAccount", back_populates="client", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Client {self.full_name} ({self.email})>"


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.clients.id", ondelete="CASCADE"), nullable=False)

    broker = Column(Enum(BrokerName), nullable=False)
    account_id = Column(String(100), nullable=False)  # Broker's client ID
    account_name = Column(String(200), nullable=True)
    status = Column(Enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)

    # Encrypted credentials (store encrypted in production)
    api_key = Column(Text, nullable=True)
    api_secret = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(Text, nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="broker_accounts")

    def __repr__(self) -> str:
        return f"<BrokerAccount {self.broker.value}:{self.account_id}>"
