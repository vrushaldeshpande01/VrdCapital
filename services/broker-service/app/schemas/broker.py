from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.models.broker import BrokerName, SyncStatus, SyncType


class CredentialCreate(BaseModel):
    client_id: UUID
    broker: BrokerName
    account_id: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    is_sandbox: bool = True


class CredentialUpdate(BaseModel):
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    is_sandbox: Optional[bool] = None
    is_active: Optional[bool] = None


class CredentialResponse(BaseModel):
    id: UUID
    client_id: UUID
    broker: BrokerName
    account_id: str
    display_name: Optional[str]
    is_sandbox: bool
    is_active: bool
    has_api_key: bool
    has_access_token: bool
    token_expiry: Optional[datetime]
    last_sync_at: Optional[datetime]
    last_sync_status: Optional[str]
    total_syncs: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SyncLogResponse(BaseModel):
    id: UUID
    credential_id: UUID
    client_id: UUID
    broker: str
    sync_type: SyncType
    status: SyncStatus
    records_synced: int
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[float] = None

    model_config = {"from_attributes": True}


class SyncRequest(BaseModel):
    sync_type: SyncType = SyncType.FULL
    credential_ids: Optional[list[UUID]] = None  # None = sync all active credentials


class SyncResult(BaseModel):
    client_id: UUID
    credentials_synced: int
    holdings_synced: int
    prices_updated: int
    errors: list[str]
    duration_seconds: float


class MarketQuote(BaseModel):
    symbol: str
    exchange: str
    ltp: float
    open_price: Optional[float]
    high_price: Optional[float]
    low_price: Optional[float]
    prev_close: Optional[float]
    change: Optional[float]
    change_pct: Optional[float]
    volume: Optional[int]
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    broker: BrokerName
    account_id: str
    mode: str  # "sandbox" or "live"
    message: str
    profile: Optional[dict] = None
