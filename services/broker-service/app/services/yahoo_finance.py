"""
Alpha Vantage market data service for NSE/BSE Indian stocks.
API docs: https://www.alphavantage.co/documentation/

Free tier: 25 requests/day, 5 requests/minute.
Each GLOBAL_QUOTE call = 1 request (1 symbol only — no batch endpoint).
Symbols use .BSE suffix (e.g. WIPRO.BSE). BSE and NSE prices are identical.
"""
import requests
import time
import logging
from app.adapters.base import QuoteData

logger = logging.getLogger(__name__)

AV_BASE = "https://www.alphavantage.co/query"

NIFTY50 = [
    {"symbol": "RELIANCE",   "av": "RELIANCE.BSE", "name": "Reliance Industries Ltd",     "sector": "Energy"},
    {"symbol": "TCS",        "av": "TCS.BSE",       "name": "Tata Consultancy Services",   "sector": "Technology"},
    {"symbol": "HDFCBANK",   "av": "HDFCBANK.BSE",  "name": "HDFC Bank Ltd",               "sector": "Finance"},
    {"symbol": "INFY",       "av": "INFY.BSE",      "name": "Infosys Ltd",                 "sector": "Technology"},
    {"symbol": "ICICIBANK",  "av": "ICICIBANK.BSE", "name": "ICICI Bank Ltd",              "sector": "Finance"},
    {"symbol": "HINDUNILVR", "av": "HINDUNILVR.BSE","name": "Hindustan Unilever Ltd",      "sector": "FMCG"},
    {"symbol": "ITC",        "av": "ITC.BSE",       "name": "ITC Ltd",                     "sector": "FMCG"},
    {"symbol": "SBIN",       "av": "SBIN.BSE",      "name": "State Bank of India",         "sector": "Finance"},
    {"symbol": "BAJFINANCE", "av": "BAJFINANCE.BSE","name": "Bajaj Finance Ltd",           "sector": "Finance"},
    {"symbol": "BHARTIARTL", "av": "BHARTIARTL.BSE","name": "Bharti Airtel Ltd",           "sector": "Telecom"},
    {"symbol": "KOTAKBANK",  "av": "KOTAKBANK.BSE", "name": "Kotak Mahindra Bank",         "sector": "Finance"},
    {"symbol": "AXISBANK",   "av": "AXISBANK.BSE",  "name": "Axis Bank Ltd",               "sector": "Finance"},
    {"symbol": "MARUTI",     "av": "MARUTI.BSE",    "name": "Maruti Suzuki India",         "sector": "Auto"},
    {"symbol": "LT",         "av": "LT.BSE",        "name": "Larsen & Toubro Ltd",         "sector": "Construction"},
    {"symbol": "TITAN",      "av": "TITAN.BSE",     "name": "Titan Company Ltd",           "sector": "Consumer"},
    {"symbol": "SUNPHARMA",  "av": "SUNPHARMA.BSE", "name": "Sun Pharmaceutical",          "sector": "Healthcare"},
    {"symbol": "WIPRO",      "av": "WIPRO.BSE",     "name": "Wipro Ltd",                   "sector": "Technology"},
    {"symbol": "ULTRACEMCO", "av": "ULTRACEMCO.BSE","name": "UltraTech Cement",            "sector": "Cement"},
    {"symbol": "NESTLEIND",  "av": "NESTLEIND.BSE", "name": "Nestle India Ltd",            "sector": "FMCG"},
    {"symbol": "POWERGRID",  "av": "POWERGRID.BSE", "name": "Power Grid Corp of India",    "sector": "Utilities"},
    {"symbol": "NTPC",       "av": "NTPC.BSE",      "name": "NTPC Ltd",                    "sector": "Utilities"},
    {"symbol": "TECHM",      "av": "TECHM.BSE",     "name": "Tech Mahindra Ltd",           "sector": "Technology"},
    {"symbol": "ONGC",       "av": "ONGC.BSE",      "name": "Oil & Natural Gas Corp",      "sector": "Energy"},
    {"symbol": "TATASTEEL",  "av": "TATASTEEL.BSE", "name": "Tata Steel Ltd",              "sector": "Metals"},
    {"symbol": "ADANIENT",   "av": "ADANIENT.BSE",  "name": "Adani Enterprises Ltd",       "sector": "Conglomerate"},
    {"symbol": "TATAMOTORS", "av": "TATAMOTORS.BSE","name": "Tata Motors Ltd",             "sector": "Auto"},
    {"symbol": "HCLTECH",    "av": "HCLTECH.BSE",   "name": "HCL Technologies Ltd",        "sector": "Technology"},
    {"symbol": "COALINDIA",  "av": "COALINDIA.BSE", "name": "Coal India Ltd",              "sector": "Mining"},
    {"symbol": "JSWSTEEL",   "av": "JSWSTEEL.BSE",  "name": "JSW Steel Ltd",               "sector": "Metals"},
    {"symbol": "BAJAJFINSV", "av": "BAJAJFINSV.BSE","name": "Bajaj Finserv Ltd",           "sector": "Finance"},
    {"symbol": "ASIANPAINT", "av": "ASIANPAINT.BSE","name": "Asian Paints Ltd",            "sector": "Consumer"},
    {"symbol": "DIVISLAB",   "av": "DIVISLAB.BSE",  "name": "Divi's Laboratories",         "sector": "Healthcare"},
    {"symbol": "DRREDDY",    "av": "DRREDDY.BSE",   "name": "Dr. Reddy's Laboratories",   "sector": "Healthcare"},
    {"symbol": "EICHERMOT",  "av": "EICHERMOT.BSE", "name": "Eicher Motors Ltd",           "sector": "Auto"},
    {"symbol": "GRASIM",     "av": "GRASIM.BSE",    "name": "Grasim Industries Ltd",       "sector": "Cement"},
    {"symbol": "HEROMOTOCO", "av": "HEROMOTOCO.BSE","name": "Hero MotoCorp Ltd",           "sector": "Auto"},
    {"symbol": "HINDALCO",   "av": "HINDALCO.BSE",  "name": "Hindalco Industries",         "sector": "Metals"},
    {"symbol": "INDUSINDBK", "av": "INDUSINDBK.BSE","name": "IndusInd Bank Ltd",           "sector": "Finance"},
    {"symbol": "TATACONSUM", "av": "TATACONSUM.BSE","name": "Tata Consumer Products",      "sector": "FMCG"},
    {"symbol": "CIPLA",      "av": "CIPLA.BSE",     "name": "Cipla Ltd",                   "sector": "Healthcare"},
    {"symbol": "APOLLOHOSP", "av": "APOLLOHOSP.BSE","name": "Apollo Hospitals Enterprise", "sector": "Healthcare"},
    {"symbol": "BPCL",       "av": "BPCL.BSE",      "name": "Bharat Petroleum Corp",       "sector": "Energy"},
    {"symbol": "BRITANNIA",  "av": "BRITANNIA.BSE", "name": "Britannia Industries Ltd",    "sector": "FMCG"},
    {"symbol": "SHRIRAMFIN", "av": "SHRIRAMFIN.BSE","name": "Shriram Finance Ltd",         "sector": "Finance"},
    {"symbol": "TRENT",      "av": "TRENT.BSE",     "name": "Trent Ltd",                   "sector": "Retail"},
    {"symbol": "ZOMATO",     "av": "ZOMATO.BSE",    "name": "Zomato Ltd",                  "sector": "Technology"},
    {"symbol": "ADANIPORTS", "av": "ADANIPORTS.BSE","name": "Adani Ports & SEZ",           "sector": "Infrastructure"},
    {"symbol": "BEL",        "av": "BEL.BSE",       "name": "Bharat Electronics Ltd",      "sector": "Defense"},
    {"symbol": "LTIM",       "av": "LTIM.BSE",      "name": "LTIMindtree Ltd",             "sector": "Technology"},
    {"symbol": "MM",         "av": "MM.BSE",         "name": "Mahindra & Mahindra",         "sector": "Auto"},
]

SYMBOL_META = {s["symbol"]: s for s in NIFTY50}
AV_TO_SYMBOL = {s["av"]: s["symbol"] for s in NIFTY50}


def _api_key() -> str:
    from app.config import get_settings
    return get_settings().ALPHA_VANTAGE_API_KEY


def _safe(val, cast=float, default=None):
    try:
        return cast(str(val).replace("%", "").strip()) if val not in (None, "", "N/A", "0.0000") else default
    except Exception:
        return default


def _quote_one(av_symbol: str) -> dict | None:
    """Fetch a single GLOBAL_QUOTE from Alpha Vantage. Returns raw quote dict or None."""
    try:
        r = requests.get(AV_BASE, params={
            "function": "GLOBAL_QUOTE",
            "symbol": av_symbol,
            "apikey": _api_key(),
        }, timeout=15)
        r.raise_for_status()
        data = r.json()
        q = data.get("Global Quote", {})
        if not q or not q.get("05. price"):
            return None
        return q
    except Exception as e:
        logger.warning("Alpha Vantage quote failed for %s: %s", av_symbol, e)
        return None


def _parse_quote(q: dict, symbol: str, meta: dict) -> dict:
    """Parse a GLOBAL_QUOTE dict into a screener row dict."""
    ltp        = _safe(q.get("05. price"))
    change     = _safe(q.get("09. change"))
    change_pct = _safe(q.get("10. change percent"))
    volume     = _safe(q.get("06. volume"), cast=int)
    prev_close = _safe(q.get("08. previous close"))
    high       = _safe(q.get("03. high"))
    low        = _safe(q.get("04. low"))

    return {
        "symbol": symbol,
        "name": meta.get("name", symbol),
        "sector": meta.get("sector", "—"),
        "ltp": round(ltp, 2) if ltp else None,
        "change": round(change, 2) if change else None,
        "change_pct": round(change_pct, 2) if change_pct else None,
        "volume": volume,
        "market_cap": None,
        "pe_ratio": None,
        "week52_high": round(high, 2) if high else None,
        "week52_low": round(low, 2) if low else None,
        "week52_change_pct": None,
        "prev_close": round(prev_close, 2) if prev_close else None,
    }


def fetch_screener(symbols: list[str]) -> list[dict]:
    """
    Fetch screener data for given NSE symbols via Alpha Vantage GLOBAL_QUOTE.
    Rate limit: 5 requests/minute, 25/day. Fetches up to 5 symbols with 12s delay between each.
    """
    rows = []
    for i, sym in enumerate(symbols):
        meta = SYMBOL_META.get(sym, {"symbol": sym, "name": sym, "sector": "—", "av": f"{sym}.BSE"})
        av_sym = meta.get("av", f"{sym}.BSE")

        if i > 0 and i % 5 == 0:
            time.sleep(61)  # wait for per-minute limit to reset
        elif i > 0:
            time.sleep(13)  # ~5 requests/minute spacing

        q = _quote_one(av_sym)
        if q:
            rows.append(_parse_quote(q, sym, meta))
        else:
            rows.append({
                "symbol": sym, "name": meta.get("name", sym), "sector": meta.get("sector", "—"),
                "ltp": None, "change": None, "change_pct": None,
                "volume": None, "market_cap": None, "pe_ratio": None,
                "week52_high": None, "week52_low": None, "week52_change_pct": None,
            })

    return rows


def fetch_quotes(symbols: list[str]) -> dict[str, QuoteData]:
    """Live quotes for the price streamer — fetches up to 5 symbols respecting rate limits."""
    result = {}
    for i, sym in enumerate(symbols[:5]):  # hard cap at 5 for streamer
        meta = SYMBOL_META.get(sym, {"av": f"{sym}.BSE"})
        av_sym = meta.get("av", f"{sym}.BSE")

        if i > 0:
            time.sleep(13)

        q = _quote_one(av_sym)
        if not q:
            continue

        ltp        = _safe(q.get("05. price"))
        change     = _safe(q.get("09. change")) or 0.0
        change_pct = _safe(q.get("10. change percent")) or 0.0
        if not ltp:
            continue

        result[sym] = QuoteData(
            symbol=sym,
            exchange="BSE",
            ltp=ltp,
            open_price=_safe(q.get("02. open")) or ltp,
            high_price=_safe(q.get("03. high")) or ltp,
            low_price=_safe(q.get("04. low")) or ltp,
            prev_close=_safe(q.get("08. previous close")) or ltp,
            change=change,
            change_pct=change_pct,
            volume=_safe(q.get("06. volume"), cast=int) or 0,
        )

    return result
