import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.broker import MarketPrice, BrokerCredential
from app.schemas.broker import MarketQuote
from app.core.dependencies import get_current_user, CurrentUser
from app.services.adapter_factory import get_adapter
from app.adapters.mock_data import get_mock_quotes, NSE_STOCKS
from app.services.yahoo_finance import fetch_quotes, fetch_screener, NIFTY50, SYMBOL_META

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/quote/{symbol}", response_model=MarketQuote)
async def get_quote(
    symbol: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    # Try cache first
    result = await db.execute(select(MarketPrice).where(MarketPrice.symbol == symbol.upper()))
    cached = result.scalar_one_or_none()
    if cached:
        return cached

    # Fall back to mock
    quotes = get_mock_quotes([symbol.upper()])
    if symbol.upper() not in quotes:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")

    q = quotes[symbol.upper()]
    from datetime import datetime, timezone
    price = MarketPrice(
        symbol=q.symbol,
        exchange=q.exchange,
        ltp=q.ltp,
        open_price=q.open_price,
        high_price=q.high_price,
        low_price=q.low_price,
        prev_close=q.prev_close,
        change=q.change,
        change_pct=q.change_pct,
        volume=q.volume,
    )
    db.add(price)
    await db.flush()
    return price


@router.post("/quotes", response_model=dict[str, MarketQuote])
async def get_bulk_quotes(
    symbols: list[str],
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    symbols = [s.upper() for s in symbols]
    quotes = get_mock_quotes(symbols)

    result = {}
    from datetime import datetime, timezone
    for sym, q in quotes.items():
        price = MarketPrice(
            symbol=q.symbol, exchange=q.exchange,
            ltp=q.ltp, open_price=q.open_price, high_price=q.high_price,
            low_price=q.low_price, prev_close=q.prev_close,
            change=q.change, change_pct=q.change_pct, volume=q.volume,
        )
        result[sym] = price
    return result


@router.get("/search")
async def search_symbols(
    q: str = Query(..., min_length=1),
    _: CurrentUser = Depends(get_current_user),
):
    term = q.upper()
    matches = [
        {"symbol": s["symbol"], "name": s["name"], "exchange": "NSE", "sector": s["sector"]}
        for s in NSE_STOCKS
        if term in s["symbol"] or term in s["name"].upper()
    ]
    return {"results": matches[:10]}


@router.get("/nse/all")
async def get_all_nse_symbols(_: CurrentUser = Depends(get_current_user)):
    return {
        "symbols": [
            {"symbol": s["symbol"], "name": s["name"], "exchange": "NSE", "sector": s["sector"]}
            for s in NIFTY50
        ]
    }


SCREENER_CACHE_KEY = "screener:nifty50"
SCREENER_CACHE_TTL = 300  # 5 minutes


_screener_fetch_lock = asyncio.Lock()
_screener_fetching = False


async def _background_screener_fetch(redis):
    """Fetch real Alpha Vantage prices in background and update cache."""
    global _screener_fetching
    import json as _json
    import random
    from app.adapters.mock_data import STOCK_MAP

    async with _screener_fetch_lock:
        if _screener_fetching:
            return
        _screener_fetching = True

    try:
        all_symbols = [s["symbol"] for s in NIFTY50]
        # Only fetch top 5 live symbols (Alpha Vantage: 5 req/min, 25/day)
        rows_live = await asyncio.to_thread(fetch_screener, all_symbols[:5])
        live_map = {r["symbol"]: r for r in rows_live if r.get("ltp") is not None}

        all_rows = []
        for s_meta in NIFTY50:
            sym = s_meta["symbol"]
            meta = SYMBOL_META.get(sym, {"name": sym, "sector": "—"})
            if sym in live_map:
                all_rows.append(live_map[sym])
            else:
                s = STOCK_MAP.get(sym)
                if s:
                    ltp = round(s["base"] * (1 + random.uniform(-0.003, 0.003)), 2)
                    prev = s["prev"]
                    all_rows.append({
                        "symbol": sym, "name": meta["name"], "sector": meta["sector"],
                        "ltp": ltp, "change": round(ltp - prev, 2),
                        "change_pct": round((ltp - prev) / prev * 100, 2),
                        "volume": None, "market_cap": None, "pe_ratio": None,
                        "week52_high": None, "week52_low": None, "week52_change_pct": None,
                    })

        if redis and all_rows:
            await redis.setex(SCREENER_CACHE_KEY, SCREENER_CACHE_TTL, _json.dumps(all_rows))
    finally:
        _screener_fetching = False


def _build_mock_screener() -> list:
    """Build a complete mock screener response for all Nifty 50 stocks."""
    import random
    from app.adapters.mock_data import STOCK_MAP
    rows = []
    for s_meta in NIFTY50:
        sym = s_meta["symbol"]
        meta = SYMBOL_META.get(sym, {"name": sym, "sector": "—"})
        s = STOCK_MAP.get(sym)
        if s:
            ltp = round(s["base"] * (1 + random.uniform(-0.003, 0.003)), 2)
            prev = s["prev"]
            rows.append({
                "symbol": sym, "name": meta["name"], "sector": meta["sector"],
                "ltp": ltp, "change": round(ltp - prev, 2),
                "change_pct": round((ltp - prev) / prev * 100, 2),
                "volume": None, "market_cap": None, "pe_ratio": None,
                "week52_high": None, "week52_low": None, "week52_change_pct": None,
            })
    return rows


@router.get("/screener")
async def market_screener(
    sector: Optional[str] = Query(None, description="Filter by sector"),
    search: Optional[str] = Query(None, description="Search by symbol or name"),
    limit: int = Query(50, ge=1, le=50),
    _: CurrentUser = Depends(get_current_user),
):
    """
    Returns NSE market data for Nifty 50 stocks.
    Serves from Redis cache instantly; triggers background Alpha Vantage refresh on cache miss.
    Alpha Vantage free tier: 25 req/day, 5/min.
    """
    import json as _json
    from app.services.price_streamer import price_streamer

    redis = price_streamer._redis
    cached_raw = await redis.get(SCREENER_CACHE_KEY) if redis else None

    if cached_raw:
        all_rows = _json.loads(cached_raw)
        source = "Alpha Vantage (cached)"
    else:
        # Return mock data immediately — don't block the request
        all_rows = _build_mock_screener()
        source = "mock (refreshing in background)"
        # Kick off background fetch to populate cache for next request
        asyncio.create_task(_background_screener_fetch(redis))

    # Apply filters
    rows = all_rows
    if sector:
        rows = [r for r in rows if r.get("sector", "").lower() == sector.lower()]
    if search:
        q = search.upper()
        rows = [r for r in rows if q in r["symbol"] or q in r.get("name", "").upper()]
    rows = rows[:limit]

    return {
        "stocks": rows,
        "count": len(rows),
        "source": source,
        "note": "Live prices from Alpha Vantage BSE (free: 25 req/day, top 5 symbols). All 50 stocks show indicative prices. Cached 5 min.",
    }


@router.get("/sectors")
async def list_sectors(_: CurrentUser = Depends(get_current_user)):
    """Return unique sectors from the Nifty 50 list."""
    sectors = sorted({s["sector"] for s in NIFTY50})
    return {"sectors": sectors}
