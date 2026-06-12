from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional
import random
import string
import uuid


@dataclass
class HoldingData:
    symbol: str
    name: str
    exchange: str
    sector: str
    quantity: float
    average_buy_price: float
    current_price: float
    previous_close: float
    isin: Optional[str] = None


@dataclass
class PositionData:
    symbol: str
    exchange: str
    quantity: float
    buy_price: float
    sell_price: Optional[float]
    trade_date: date
    is_open: bool = True
    product: str = "CNC"  # CNC/MIS/NRML


@dataclass
class FundsData:
    available_cash: float
    used_margin: float
    total_balance: float


@dataclass
class QuoteData:
    symbol: str
    exchange: str
    ltp: float
    open_price: float
    high_price: float
    low_price: float
    prev_close: float
    change: float
    change_pct: float
    volume: int


@dataclass
class ProfileData:
    broker: str
    account_id: str
    client_name: str
    email: str
    exchanges: list[str] = field(default_factory=list)


class BrokerAdapter(ABC):
    def __init__(self, api_key: str, api_secret: str, access_token: str = "", is_sandbox: bool = True):
        self.api_key = api_key
        self.api_secret = api_secret
        self.access_token = access_token
        self.is_sandbox = is_sandbox

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str, Optional[ProfileData]]:
        """Returns (success, message, profile)"""

    @abstractmethod
    async def get_holdings(self) -> list[HoldingData]:
        """Fetch all equity holdings from the broker."""

    @abstractmethod
    async def get_positions(self) -> list[PositionData]:
        """Fetch open intraday/delivery positions."""

    @abstractmethod
    async def get_funds(self) -> FundsData:
        """Fetch available funds and margin."""

    @abstractmethod
    async def get_quotes(self, symbols: list[str]) -> dict[str, QuoteData]:
        """Fetch live/EOD quotes for a list of symbols."""

    async def place_order(
        self,
        symbol: str,
        exchange: str,
        side: str,
        price_type: str,
        quantity: int,
        price: Optional[Decimal] = None,
        trigger_price: Optional[Decimal] = None,
    ) -> dict:
        """Place an order. Sandbox returns a simulated fill; live subclasses override this."""
        if self.is_sandbox:
            broker_order_id = "".join(random.choices(string.digits, k=10))
            fill_price = float(price) if price and price_type == "LIMIT" else None
            from datetime import datetime, timezone
            return {
                "status": "EXECUTED" if price_type == "MARKET" else "OPEN",
                "broker_order_id": broker_order_id,
                "executed_quantity": quantity if price_type == "MARKET" else 0,
                "average_price": str(fill_price) if fill_price else None,
                "executed_at": datetime.now(timezone.utc).isoformat() if price_type == "MARKET" else None,
            }
        raise NotImplementedError("Live order placement not implemented for this adapter")
