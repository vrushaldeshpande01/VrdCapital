import uuid
import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date,
    Enum, Numeric, Integer, ForeignKey, Text, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AssetClass(str, enum.Enum):
    EQUITY = "equity"
    MUTUAL_FUND = "mutual_fund"
    ETF = "etf"
    BOND = "bond"
    CASH = "cash"
    OTHER = "other"


class Exchange(str, enum.Enum):
    NSE = "NSE"
    BSE = "BSE"


class HoldingStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class Holding(Base):
    """
    Represents a current long-term position (holdings from DEMAT account).
    Updated on every trade or sync from broker.
    """
    __tablename__ = "holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    broker_account_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Instrument details
    symbol = Column(String(30), nullable=False)
    isin = Column(String(12), nullable=True)
    name = Column(String(200), nullable=True)
    exchange = Column(Enum(Exchange), nullable=False, default=Exchange.NSE)
    asset_class = Column(Enum(AssetClass), nullable=False, default=AssetClass.EQUITY)
    sector = Column(String(100), nullable=True)

    # Position details
    quantity = Column(Numeric(15, 4), nullable=False, default=0)
    average_buy_price = Column(Numeric(15, 4), nullable=False)

    # Live market data (updated via broker sync)
    current_price = Column(Numeric(15, 4), nullable=True)
    previous_close = Column(Numeric(15, 4), nullable=True)
    last_price_updated_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(Enum(HoldingStatus), nullable=False, default=HoldingStatus.ACTIVE)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Computed properties (stored for performance)
    invested_value = Column(Numeric(18, 4), nullable=True)      # quantity × avg_buy_price
    current_value = Column(Numeric(18, 4), nullable=True)       # quantity × current_price
    unrealized_pnl = Column(Numeric(18, 4), nullable=True)      # current_value - invested_value
    unrealized_pnl_pct = Column(Numeric(10, 4), nullable=True)  # unrealized_pnl / invested_value × 100
    day_pnl = Column(Numeric(18, 4), nullable=True)             # (current - prev_close) × quantity

    __table_args__ = (
        Index("ix_holdings_client_symbol", "client_id", "symbol"),
        Index("ix_holdings_client_broker", "client_id", "broker_account_id"),
    )

    def recalculate(self):
        """Recompute all derived fields from base data."""
        if self.quantity and self.average_buy_price:
            self.invested_value = float(self.quantity) * float(self.average_buy_price)
        if self.quantity and self.current_price:
            self.current_value = float(self.quantity) * float(self.current_price)
            if self.invested_value:
                self.unrealized_pnl = float(self.current_value) - float(self.invested_value)
                self.unrealized_pnl_pct = (float(self.unrealized_pnl) / float(self.invested_value)) * 100
        if self.quantity and self.current_price and self.previous_close:
            self.day_pnl = (float(self.current_price) - float(self.previous_close)) * float(self.quantity)


class Position(Base):
    """
    Intraday positions — open within the trading session, not held overnight.
    """
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    broker_account_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    symbol = Column(String(30), nullable=False)
    exchange = Column(Enum(Exchange), nullable=False, default=Exchange.NSE)

    # Net position (positive = long, negative = short)
    quantity = Column(Numeric(15, 4), nullable=False, default=0)
    buy_quantity = Column(Numeric(15, 4), nullable=False, default=0)
    sell_quantity = Column(Numeric(15, 4), nullable=False, default=0)
    average_buy_price = Column(Numeric(15, 4), nullable=True)
    average_sell_price = Column(Numeric(15, 4), nullable=True)

    current_price = Column(Numeric(15, 4), nullable=True)

    # P&L
    realized_pnl = Column(Numeric(18, 4), nullable=True, default=0)
    unrealized_pnl = Column(Numeric(18, 4), nullable=True, default=0)

    trade_date = Column(Date, nullable=False, default=date.today)
    is_open = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_positions_client_date", "client_id", "trade_date"),
        Index("ix_positions_client_symbol_date", "client_id", "symbol", "trade_date"),
    )


class CashBalance(Base):
    """Cash and margin available per broker account."""
    __tablename__ = "cash_balances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    broker_account_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    available_cash = Column(Numeric(18, 4), nullable=False, default=0)
    used_margin = Column(Numeric(18, 4), nullable=False, default=0)
    total_balance = Column(Numeric(18, 4), nullable=False, default=0)

    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PortfolioSnapshot(Base):
    """
    Daily snapshot of portfolio value — used for historical charts and daily return calculation.
    One row per client per day.
    """
    __tablename__ = "portfolio_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    snapshot_date = Column(Date, nullable=False)

    holdings_value = Column(Numeric(18, 4), nullable=False, default=0)
    cash_balance = Column(Numeric(18, 4), nullable=False, default=0)
    total_value = Column(Numeric(18, 4), nullable=False, default=0)
    invested_value = Column(Numeric(18, 4), nullable=False, default=0)

    day_pnl = Column(Numeric(18, 4), nullable=True)
    day_return_pct = Column(Numeric(10, 4), nullable=True)
    total_pnl = Column(Numeric(18, 4), nullable=True)
    total_return_pct = Column(Numeric(10, 4), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_snapshots_client_date", "client_id", "snapshot_date", unique=True),
    )
