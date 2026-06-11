import math
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

from pydantic import BaseModel, EmailStr, Field, validator

from app.models.client import ClientStatus, RiskProfile, BrokerName, AccountStatus


class BrokerAccountCreate(BaseModel):
    broker: BrokerName
    account_id: str = Field(..., min_length=1, max_length=100)
    account_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    is_primary: bool = False


class BrokerAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    status: Optional[AccountStatus] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    is_primary: Optional[bool] = None


class BrokerAccountResponse(BaseModel):
    id: UUID
    client_id: UUID
    broker: BrokerName
    account_id: str
    account_name: Optional[str]
    status: AccountStatus
    is_primary: bool
    last_synced_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    pan_number: Optional[str] = Field(None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    annual_income: Optional[Decimal] = None
    investment_goal: Optional[str] = None
    risk_profile: RiskProfile = RiskProfile.MODERATE
    investment_horizon_years: Optional[int] = Field(None, ge=1, le=50)
    notes: Optional[str] = None
    tags: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Rajesh Kumar",
                "email": "rajesh.kumar@example.com",
                "phone": "+919876543210",
                "pan_number": "ABCDE1234F",
                "risk_profile": "moderate",
                "annual_income": 2500000,
                "investment_goal": "Wealth creation over 10 years",
                "investment_horizon_years": 10
            }
        }


class ClientUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    annual_income: Optional[Decimal] = None
    investment_goal: Optional[str] = None
    risk_profile: Optional[RiskProfile] = None
    investment_horizon_years: Optional[int] = Field(None, ge=1, le=50)
    status: Optional[ClientStatus] = None
    kyc_verified: Optional[bool] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class ClientResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    managed_by: UUID
    full_name: str
    email: str
    phone: str
    pan_number: Optional[str]
    date_of_birth: Optional[date]
    city: Optional[str]
    state: Optional[str]
    country: str
    annual_income: Optional[Decimal]
    investment_goal: Optional[str]
    risk_profile: RiskProfile
    investment_horizon_years: Optional[int]
    status: ClientStatus
    kyc_verified: bool
    kyc_verified_at: Optional[datetime]
    notes: Optional[str]
    tags: Optional[str]
    broker_accounts: List[BrokerAccountResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    items: List[ClientResponse]
    total: int
    page: int
    size: int
    pages: int


class ClientSummary(BaseModel):
    id: UUID
    full_name: str
    email: str
    status: ClientStatus
    risk_profile: RiskProfile
    kyc_verified: bool
    broker_count: int
    created_at: datetime

    class Config:
        from_attributes = True
