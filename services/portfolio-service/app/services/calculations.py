"""
Portfolio calculation engine.
All financial formulas are centralised here so business logic
stays out of routes and models.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional


def to_dec(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def round2(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def round4(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


# ── Core formulas ────────────────────────────────────────────────────────────

def market_value(quantity, current_price) -> Decimal:
    """quantity × current_market_price"""
    return round2(to_dec(quantity) * to_dec(current_price))


def invested_value(quantity, avg_buy_price) -> Decimal:
    """quantity × average_buy_price"""
    return round2(to_dec(quantity) * to_dec(avg_buy_price))


def unrealized_pnl(current_price, avg_buy_price, quantity) -> Decimal:
    """(current_price - avg_buy_price) × quantity"""
    return round2((to_dec(current_price) - to_dec(avg_buy_price)) * to_dec(quantity))


def unrealized_pnl_pct(current_price, avg_buy_price) -> Optional[Decimal]:
    """((current - avg) / avg) × 100"""
    avg = to_dec(avg_buy_price)
    if avg == 0:
        return None
    return round4(((to_dec(current_price) - avg) / avg) * 100)


def realized_pnl(sell_price, buy_price, quantity) -> Decimal:
    """(sell_price - buy_price) × quantity"""
    return round2((to_dec(sell_price) - to_dec(buy_price)) * to_dec(quantity))


def day_pnl(current_price, previous_close, quantity) -> Decimal:
    """(current_price - previous_close) × quantity"""
    return round2((to_dec(current_price) - to_dec(previous_close)) * to_dec(quantity))


def day_return_pct(current_price, previous_close) -> Optional[Decimal]:
    prev = to_dec(previous_close)
    if prev == 0:
        return None
    return round4(((to_dec(current_price) - prev) / prev) * 100)


def portfolio_value(cash_balance, holdings_value) -> Decimal:
    """cash + holdings_value"""
    return round2(to_dec(cash_balance) + to_dec(holdings_value))


def daily_return(today_value, yesterday_value) -> Optional[Decimal]:
    """(today - yesterday) / yesterday"""
    yest = to_dec(yesterday_value)
    if yest == 0:
        return None
    return round4(((to_dec(today_value) - yest) / yest) * 100)


# ── Aggregate helpers ────────────────────────────────────────────────────────

def aggregate_holdings_value(holdings: list) -> Decimal:
    """Sum of current_value across all holdings."""
    return round2(sum(to_dec(h.current_value or 0) for h in holdings))


def aggregate_invested_value(holdings: list) -> Decimal:
    return round2(sum(to_dec(h.invested_value or 0) for h in holdings))


def aggregate_unrealized_pnl(holdings: list) -> Decimal:
    return round2(sum(to_dec(h.unrealized_pnl or 0) for h in holdings))


def aggregate_day_pnl(holdings: list) -> Decimal:
    return round2(sum(to_dec(h.day_pnl or 0) for h in holdings))


def sector_allocation(holdings: list) -> List[dict]:
    """
    Returns list of {sector, value, weight_pct} sorted by value desc.
    Holdings without a sector are grouped under 'Other'.
    """
    totals: dict[str, Decimal] = {}
    grand_total = Decimal("0")

    for h in holdings:
        sector = h.sector or "Other"
        val = to_dec(h.current_value or 0)
        totals[sector] = totals.get(sector, Decimal("0")) + val
        grand_total += val

    if grand_total == 0:
        return []

    result = [
        {
            "sector": sector,
            "value": float(round2(val)),
            "weight_pct": float(round2((val / grand_total) * 100)),
        }
        for sector, val in sorted(totals.items(), key=lambda x: x[1], reverse=True)
    ]
    return result


def top_holdings(holdings: list, n: int = 5) -> list:
    """Return top N holdings by current_value."""
    sorted_h = sorted(
        [h for h in holdings if h.current_value],
        key=lambda h: float(h.current_value),
        reverse=True,
    )
    return sorted_h[:n]
