from fastapi import APIRouter, Depends, Body
from app.core.dependencies import get_current_user, CurrentUser
from app.services.price_streamer import price_streamer

router = APIRouter(prefix="/market/ticker", tags=["Live Prices"])


@router.post("/subscribe")
async def subscribe(
    symbols: list[str] = Body(...),
    _: CurrentUser = Depends(get_current_user),
):
    """Add symbols to the live price watchlist."""
    await price_streamer.add_symbols(symbols)
    return {"subscribed": [s.upper() for s in symbols]}


@router.delete("/subscribe")
async def unsubscribe(
    symbols: list[str] = Body(...),
    _: CurrentUser = Depends(get_current_user),
):
    """Remove symbols from the live price watchlist."""
    await price_streamer.remove_symbols(symbols)
    return {"unsubscribed": [s.upper() for s in symbols]}


@router.get("/watchlist")
async def get_watchlist(_: CurrentUser = Depends(get_current_user)):
    """Return all currently subscribed symbols."""
    return {"symbols": await price_streamer.get_watchlist()}


@router.get("/ltp/{symbol}")
async def get_ltp(symbol: str, _: CurrentUser = Depends(get_current_user)):
    """Return the latest cached price for a symbol (up to 30 s old)."""
    data = await price_streamer.get_ltp(symbol)
    if not data:
        return {"symbol": symbol.upper(), "ltp": None, "cached": False}
    return {**data, "cached": True}
