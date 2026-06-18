"""
Shared realistic NSE mock data used by all sandbox adapters.
Prices fluctuate slightly on each call to simulate live market.
"""
import random
from datetime import date
from app.adapters.base import HoldingData, QuoteData

NSE_STOCKS = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd",     "sector": "Energy",      "base": 1320.00, "prev": 1305.00, "isin": "INE002A01018"},
    {"symbol": "TCS",       "name": "Tata Consultancy Services",  "sector": "Technology",  "base": 3450.00, "prev": 3420.00, "isin": "INE467B01029"},
    {"symbol": "HDFCBANK",  "name": "HDFC Bank Ltd",              "sector": "Finance",     "base": 1780.00, "prev": 1760.00, "isin": "INE040A01034"},
    {"symbol": "INFY",      "name": "Infosys Ltd",                "sector": "Technology",  "base": 1560.00, "prev": 1540.00, "isin": "INE009A01021"},
    {"symbol": "WIPRO",     "name": "Wipro Ltd",                  "sector": "Technology",  "base": 181.00,  "prev": 179.50,  "isin": "INE075A01022"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd",             "sector": "Finance",     "base": 1380.00, "prev": 1365.00, "isin": "INE090A01021"},
    {"symbol": "HINDUNILVR","name": "Hindustan Unilever Ltd",     "sector": "FMCG",        "base": 2380.00, "prev": 2355.00, "isin": "INE030A01027"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical",         "sector": "Healthcare",  "base": 1720.00, "prev": 1700.00, "isin": "INE044A01036"},
    {"symbol": "BAJFINANCE","name": "Bajaj Finance Ltd",          "sector": "Finance",     "base": 9100.00, "prev": 9000.00, "isin": "INE296A01024"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank",        "sector": "Finance",     "base": 2120.00, "prev": 2095.00, "isin": "INE237A01028"},
    {"symbol": "LTIM",      "name": "LTIMindtree Ltd",            "sector": "Technology",  "base": 4850.00, "prev": 4800.00, "isin": "INE214T01019"},
    {"symbol": "AXISBANK",  "name": "Axis Bank Ltd",              "sector": "Finance",     "base": 1230.00, "prev": 1215.00, "isin": "INE238A01034"},
    {"symbol": "MARUTI",    "name": "Maruti Suzuki India",        "sector": "Auto",        "base": 12800.00,"prev": 12650.00,"isin": "INE585B01010"},
    {"symbol": "TITAN",     "name": "Titan Company Ltd",          "sector": "Consumer",    "base": 3550.00, "prev": 3510.00, "isin": "INE280A01028"},
    {"symbol": "NESTLEIND", "name": "Nestle India Ltd",           "sector": "FMCG",        "base": 2290.00, "prev": 2265.00, "isin": "INE239A01016"},
]

STOCK_MAP = {s["symbol"]: s for s in NSE_STOCKS}


def _fluctuate(base: float, pct: float = 0.015) -> float:
    """Simulate ±1.5% intraday movement."""
    return round(base * (1 + random.uniform(-pct, pct)), 2)


def get_mock_holdings(account_suffix: str = "") -> list[HoldingData]:
    """Return a realistic subset of holdings for a sandbox account."""
    random.seed(hash(account_suffix) % 1000)
    count = random.randint(5, 10)
    stocks = random.sample(NSE_STOCKS, count)
    holdings = []
    for s in stocks:
        ltp = _fluctuate(s["base"])
        qty = random.choice([10, 20, 25, 30, 50, 75, 100])
        avg = round(s["base"] * random.uniform(0.85, 1.05), 2)
        holdings.append(HoldingData(
            symbol=s["symbol"],
            name=s["name"],
            exchange="NSE",
            sector=s["sector"],
            quantity=qty,
            average_buy_price=avg,
            current_price=ltp,
            previous_close=s["prev"],
            isin=s["isin"],
        ))
    return holdings


def get_mock_quotes(symbols: list[str]) -> dict[str, QuoteData]:
    quotes = {}
    for sym in symbols:
        s = STOCK_MAP.get(sym.upper())
        if not s:
            continue
        ltp = _fluctuate(s["base"])
        prev = s["prev"]
        change = round(ltp - prev, 2)
        change_pct = round((change / prev) * 100, 4)
        quotes[sym] = QuoteData(
            symbol=sym,
            exchange="NSE",
            ltp=ltp,
            open_price=_fluctuate(s["base"], 0.005),
            high_price=round(ltp * 1.012, 2),
            low_price=round(ltp * 0.988, 2),
            prev_close=prev,
            change=change,
            change_pct=change_pct,
            volume=random.randint(500_000, 5_000_000),
        )
    return quotes
