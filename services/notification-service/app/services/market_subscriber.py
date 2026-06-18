"""
Subscribes to the Redis 'market:ticks' pub/sub channel published by broker-service
and broadcasts each tick to all connected WebSocket clients.

Reconnects automatically on Redis disconnects.
"""
import asyncio
import json
import logging

import redis.asyncio as aioredis
from app.services.connection_manager import manager

logger = logging.getLogger(__name__)
TICK_CHANNEL = "market:ticks"


async def start_market_subscriber(redis_url: str):
    while True:
        try:
            client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.subscribe(TICK_CHANNEL)
            logger.info("MarketSubscriber listening on channel '%s'", TICK_CHANNEL)

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    await manager.broadcast(data)
                except Exception as e:
                    logger.warning("MarketSubscriber broadcast error: %s", e)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("MarketSubscriber error: %s — reconnecting in 5 s", e)
            await asyncio.sleep(5)
