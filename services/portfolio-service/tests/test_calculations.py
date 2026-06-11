from decimal import Decimal
from app.services.calculations import (
    market_value, invested_value, unrealized_pnl, unrealized_pnl_pct,
    realized_pnl, day_pnl, portfolio_value, daily_return, sector_allocation
)


def test_market_value():
    assert market_value(50, 2485.60) == Decimal("124280.00")


def test_invested_value():
    assert invested_value(50, 2350.50) == Decimal("117525.00")


def test_unrealized_pnl_profit():
    pnl = unrealized_pnl(2485.60, 2350.50, 50)
    assert pnl == Decimal("6755.00")


def test_unrealized_pnl_loss():
    pnl = unrealized_pnl(2000.00, 2350.50, 50)
    assert pnl == Decimal("-17525.00")


def test_unrealized_pnl_pct():
    pct = unrealized_pnl_pct(2485.60, 2350.50)
    assert pct is not None
    assert pct > 0


def test_realized_pnl():
    pnl = realized_pnl(3500.00, 3000.00, 10)
    assert pnl == Decimal("5000.00")


def test_day_pnl():
    pnl = day_pnl(2485.60, 2460.00, 50)
    assert pnl == Decimal("1280.00")


def test_portfolio_value():
    val = portfolio_value(250000, 500000)
    assert val == Decimal("750000.00")


def test_daily_return():
    ret = daily_return(750000, 720000)
    assert ret is not None
    assert ret > 0


def test_daily_return_zero_yesterday():
    assert daily_return(100000, 0) is None


def test_sector_allocation():
    class MockHolding:
        def __init__(self, sector, val):
            self.sector = sector
            self.current_value = val

    holdings = [
        MockHolding("Technology", 500000),
        MockHolding("Finance", 300000),
        MockHolding("Technology", 200000),
        MockHolding(None, 100000),
    ]
    result = sector_allocation(holdings)
    assert len(result) == 3
    assert result[0]["sector"] == "Technology"
    assert result[0]["value"] == 700000.0
    total_weight = sum(r["weight_pct"] for r in result)
    assert abs(total_weight - 100.0) < 0.1
