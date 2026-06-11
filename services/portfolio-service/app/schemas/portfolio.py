from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

from pydantic import BaseModel, Field

from app.models.portfolio import AssetClass, Exchange, HoldingStatus


# ── Holding schemas ───────────────────────────────────────────────────────────

class HoldingCreate(BaseModel):
    client_id: UUID
    broker_account_id: UUID
    symbol: str = Field(..., min_length=1, max_length=30)
    isin: Optional[str] = None
    name: Optional[str] = None
    exchange: Exchange = Exchange.NSE
    asset_class: AssetClass = AssetClass.EQUITY
    sector: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    average_buy_price: Decimal = Field(..., gt=0)
    current_price: Optional[Decimal] = None
    previous_close: Optional[Decimal] = None

    class Config:
        json_schema_extra = {
            "example": {
                "client_id": "uuid-here",
                "broker_account_id": "uuid-here",
                "symbol": "RELIANCE",
                "name": "Reliance Industries Ltd",
                "exchange": "NSE",
                "sector": "Energy",
                "quantity": 50,
                "average_buy_price": 2350.50,
                "current_price": 2485.60,
                "previous_close": 2460.00,
            }
        }


class HoldingUpdate(BaseModel):
    quantity: Optional[Decimal] = Field(None, gt=0)
    average_buy_price: Optional[Decimal] = Field(None, gt=0)
    current_price: Optional[Decimal] = Field(None, gt=0)
    previous_close: Optional[Decimal] = Field(None, gt=0)
    sector: Optional[str] = None
    name: Optional[str] = None
    status: Optional[HoldingStatus] = None


class HoldingResponse(BaseModel):
    id: UUID
    client_id: UUID
    broker_account_id: UUID
    symbol: str
    isin: Optional[str]
    name: Optional[str]
    exchange: Exchange
    asset_class: AssetClass
    sector: Optional[str]
    quantity: Decimal
    average_buy_price: Decimal
    current_price: Optional[Decimal]
    previous_close: Optional[Decimal]
    invested_value: Optional[Decimal]
    current_value: Optional[Decimal]
    unrealized_pnl: Optional[Decimal]
    unrealized_pnl_pct: Optional[Decimal]
    day_pnl: Optional[Decimal]
    status: HoldingStatus
    last_price_updated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Position schemas ──────────────────────────────────────────────────────────

class PositionCreate(BaseModel):
    client_id: UUID
    broker_account_id: UUID
    symbol: str
    exchange: Exchange = Exchange.NSE
    quantity: Decimal
    buy_quantity: Decimal = Decimal("0")
    sell_quantity: Decimal = Decimal("0")
    average_buy_price: Optional[Decimal] = None
    average_sell_price: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    realized_pnl: Optional[Decimal] = Decimal("0")
    unrealized_pnl: Optional[Decimal] = Decimal("0")
    trade_date: Optional[date] = None


class PositionResponse(BaseModel):
    id: UUID
    client_id: UUID
    broker_account_id: UUID
    symbol: str
    exchange: Exchange
    quantity: Decimal
    buy_quantity: Decimal
    sell_quantity: Decimal
    average_buy_price: Optional[Decimal]
    average_sell_price: Optional[Decimal]
    current_price: Optional[Decimal]
    realized_pnl: Optional[Decimal]
    unrealized_pnl: Optional[Decimal]
    trade_date: date
    is_open: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Portfolio summary ─────────────────────────────────────────────────────────

class SectorAllocation(BaseModel):
    sector: str
    value: float
    weight_pct: float


class TopHolding(BaseModel):
    symbol: str
    name: Optional[str]
    sector: Optional[str]
    current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    weight_pct: float


class PortfolioSummary(BaseModel):
    client_id: UUID
    holdings_value: Decimal
    invested_value: Decimal
    cash_balance: Decimal
    total_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_pct: Optional[Decimal]
    day_pnl: Decimal
    day_return_pct: Optional[Decimal]
    total_holdings: int
    sector_allocation: List[SectorAllocation]
    top_holdings: List[TopHolding]


class AUMSummary(BaseModel):
    total_aum: Decimal
    total_clients: int
    total_holdings_value: Decimal
    total_cash: Decimal
    total_invested: Decimal
    total_unrealized_pnl: Decimal
    total_day_pnl: Decimal
    day_return_pct: Optional[Decimal]


class PriceUpdateRequest(BaseModel):
    symbol: str
    current_price: Decimal
    previous_close: Optional[Decimal] = None


class BulkPriceUpdateRequest(BaseModel):
    prices: List[PriceUpdateRequest]


class PortfolioSnapshotResponse(BaseModel):
    snapshot_date: date
    total_value: Decimal
    holdings_value: Decimal
    cash_balance: Decimal
    day_pnl: Optional[Decimal]
    day_return_pct: Optional[Decimal]
    total_pnl: Optional[Decimal]
    total_return_pct: Optional[Decimal]

    class Config:
        from_attributes = True
