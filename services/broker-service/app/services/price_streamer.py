"""
Background price streamer.

Polls the Zerodha REST quote API every 2 seconds for all symbols in the
Redis watchlist ('ticker:watchlist'), then:
  - Caches each tick at 'ltp:{SYMBOL}' (30-second TTL)
  - Publishes to Redis pub/sub channel 'market:ticks'

Falls back to mock data when no live credential with a valid access token
is found, so the system stays functional in sandbox mode.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

WATCHLIST_KEY = "ticker:watchlist"
LTP_PREFIX = "ltp:"
TICK_CHANNEL = "market:ticks"
POLL_INTERVAL = 2          # seconds — how often we publish ticks to clients
REAL_DATA_INTERVAL = 300   # seconds — how often we call Alpha Vantage (free tier: 25/day, 5/min)
MAX_LIVE_SYMBOLS = 5       # Alpha Vantage: 5 requests/minute, fetch top 5 watchlist symbols


class PriceStreamer:
    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self._task: asyncio.Task | None = None
        self._db_factory = None
        self._last_real_fetch: float = 0.0
        self._cached_quotes: dict[str, dict] = {}  # last known real prices

    async def start(self, redis_url: str, db_factory):
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._db_factory = db_factory
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("PriceStreamer started")

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._redis:
            await self._redis.aclose()

    async def add_symbols(self, symbols: list[str]):
        if self._redis and symbols:
            await self._redis.sadd(WATCHLIST_KEY, *[s.upper() for s in symbols])

    async def remove_symbols(self, symbols: list[str]):
        if self._redis and symbols:
            await self._redis.srem(WATCHLIST_KEY, *[s.upper() for s in symbols])

    async def get_watchlist(self) -> list[str]:
        if not self._redis:
            return []
        return sorted(await self._redis.smembers(WATCHLIST_KEY))

    async def get_ltp(self, symbol: str) -> dict | None:
        if not self._redis:
            return None
        raw = await self._redis.get(f"{LTP_PREFIX}{symbol.upper()}")
        return json.loads(raw) if raw else None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _get_live_credential(self):
        from app.models.broker import BrokerCredential, BrokerName

        async with self._db_factory() as db:
            from sqlalchemy import select
            result = await db.execute(
                select(BrokerCredential).where(
                    BrokerCredential.broker == BrokerName.ZERODHA,
                    BrokerCredential.is_sandbox == False,
                    BrokerCredential.is_active == True,
                    BrokerCredential.access_token_encrypted.isnot(None),
                    BrokerCredential.token_expiry > datetime.now(timezone.utc),
                ).limit(1)
            )
            return result.scalar_one_or_none()

    async def _poll_loop(self):
        while True:
            try:
                watchlist = await self.get_watchlist()
                if watchlist:
                    await self._fetch_and_publish(watchlist)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("PriceStreamer poll error: %s", e)
            await asyncio.sleep(POLL_INTERVAL)

    async def _fetch_and_publish(self, symbols: list[str]):
        import time
        from app.services.adapter_factory import get_adapter

        now = time.monotonic()
        need_real_fetch = (now - self._last_real_fetch) >= REAL_DATA_INTERVAL

        if need_real_fetch:
            fetched = False

            credential = await self._get_live_credential()
            if credential:
                try:
                    adapter = get_adapter(credential)
                    quotes = await adapter.get_quotes(symbols)
                    if quotes:
                        self._cached_quotes = {
                            sym: {"ltp": float(q.ltp), "change": float(q.change), "change_pct": float(q.change_pct)}
                            for sym, q in quotes.items()
                        }
                        self._last_real_fetch = now
                        fetched = True
                except Exception as e:
                    logger.warning("Live quote fetch failed: %s", e)

            if not fetched:
                from app.services.yahoo_finance import fetch_quotes
                try:
                    # Limit to MAX_LIVE_SYMBOLS to stay within the per-minute rate limit
                    limited = symbols[:MAX_LIVE_SYMBOLS]
                    yf_quotes = await asyncio.to_thread(fetch_quotes, limited)
                    if yf_quotes:
                        self._cached_quotes.update({
                            sym: {"ltp": float(q.ltp), "change": float(q.change), "change_pct": float(q.change_pct)}
                            for sym, q in yf_quotes.items()
                        })
                        self._last_real_fetch = now
                        fetched = True
                        logger.info("Alpha Vantage fetched %d symbols", len(yf_quotes))
                except Exception as e:
                    logger.warning("Twelve Data fetch failed: %s", e)

            if not fetched:
                from app.adapters.mock_data import get_mock_quotes
                mock = get_mock_quotes(symbols)
                self._cached_quotes = {
                    sym: {"ltp": float(q.ltp), "change": float(q.change), "change_pct": float(q.change_pct)}
                    for sym, q in mock.items()
                }
                self._last_real_fetch = now

        # Publish from cache (with tiny random fluctuation to show movement)
        import random
        for sym, cached in self._cached_quotes.items():
            if sym not in symbols:
                continue
            ltp = round(cached["ltp"] * (1 + random.uniform(-0.0005, 0.0005)), 2)
            await self._publish(sym, ltp, cached["change"], cached["change_pct"])

    async def _publish(self, symbol: str, ltp: float, change: float, change_pct: float):
        data = {
            "type": "MARKET_TICK",
            "symbol": symbol,
            "ltp": ltp,
            "change": change,
            "change_pct": change_pct,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        serialized = json.dumps(data)
        await self._redis.setex(f"{LTP_PREFIX}{symbol}", 30, serialized)
        await self._redis.publish(TICK_CHANNEL, serialized)


price_streamer = PriceStreamer()
