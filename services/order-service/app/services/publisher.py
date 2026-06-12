"""
RabbitMQ event publisher for order-service.
Publishes order lifecycle events to the vrdcapital.events topic exchange.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_connection = None
_channel = None
_exchange = None


async def _get_exchange():
    global _connection, _channel, _exchange
    try:
        import aio_pika
        from app.config import settings

        if _connection is None or _connection.is_closed:
            _connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            _channel = await _connection.channel()
            _exchange = await _channel.declare_exchange(
                "vrdcapital.events",
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
        return _exchange
    except Exception as e:
        logger.warning(f"RabbitMQ not available: {e}")
        return None


async def publish_order_event(routing_key: str, payload: dict):
    """Publish an order event. Silently skips if RabbitMQ is unavailable."""
    try:
        import aio_pika
        exchange = await _get_exchange()
        if exchange is None:
            return
        body = json.dumps({**payload, "published_at": datetime.now(timezone.utc).isoformat()}).encode()
        await exchange.publish(
            aio_pika.Message(body=body, content_type="application/json", delivery_mode=2),
            routing_key=routing_key,
        )
    except Exception as e:
        logger.warning(f"Failed to publish {routing_key}: {e}")
