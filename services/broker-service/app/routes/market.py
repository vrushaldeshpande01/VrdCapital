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
            for s in NSE_STOCKS
        ]
    }
