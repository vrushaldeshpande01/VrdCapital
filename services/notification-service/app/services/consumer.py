"""
RabbitMQ consumer.
Connects to the vrdcapital.events exchange (topic), binds queues for:
  - order.executed / order.failed / order.cancelled
  - basket.completed / basket.failed
  - kyc.updated / client.created
Creates a Notification record and pushes it via WebSocket.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import aio_pika
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationType
from app.services.connection_manager import manager

logger = logging.getLogger(__name__)

# Routing key -> (NotificationType, title_template)
ROUTING_MAP = {
    "order.executed":   (NotificationType.ORDER_EXECUTED,   "Order Executed"),
    "order.failed":     (NotificationType.ORDER_FAILED,      "Order Failed"),
    "order.cancelled":  (NotificationType.ORDER_CANCELLED,   "Order Cancelled"),
    "basket.completed": (NotificationType.BASKET_COMPLETED,  "Basket Completed"),
    "basket.failed":    (NotificationType.BASKET_FAILED,     "Basket Failed"),
    "kyc.updated":      (NotificationType.KYC_UPDATED,       "KYC Status Updated"),
    "client.created":   (NotificationType.CLIENT_ADDED,      "New Client Added"),
}


async def _handle_message(message: aio_pika.abc.AbstractIncomingMessage):
    async with message.process(requeue=False):
        try:
            body = json.loads(message.body.decode())
            routing_key = message.routing_key or ""
            notif_type, title = ROUTING_MAP.get(routing_key, (NotificationType.SYSTEM, "System Event"))

            user_id = body.get("managed_by") or body.get("user_id") or body.get("created_by")
            if not user_id:
                return  # No target user — skip

            msg_text = body.get("message") or _build_message(routing_key, body)

            async with AsyncSessionLocal() as db:
                async with db.begin():
                    notif = Notification(
                        user_id=uuid.UUID(user_id),
                        type=notif_type,
                        title=title,
                        message=msg_text,
                        metadata_json=json.dumps(body),
                    )
                    db.add(notif)

            # Push real-time
            await manager.send_to_user(user_id, {
                "type": "notification",
                "id": str(notif.id),
                "notif_type": notif_type.value,
                "title": title,
                "message": msg_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_read": False,
            })
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)


def _build_message(routing_key: str, body: dict) -> str:
    symbol = body.get("symbol", "")
    qty = body.get("quantity", "")
    side = body.get("side", "")
    price = body.get("average_price") or body.get("price", "")
    basket_name = body.get("basket_name", "basket")

    templates = {
        "order.executed":   f"{side} {qty} {symbol} @ ₹{price} — executed",
        "order.failed":     f"{side} {qty} {symbol} — failed: {body.get('reason', 'unknown')}",
        "order.cancelled":  f"{side} {qty} {symbol} — cancelled",
        "basket.completed": f"Basket '{basket_name}' completed — {body.get('executed', 0)} orders executed",
        "basket.failed":    f"Basket '{basket_name}' failed",
        "kyc.updated":      f"KYC status updated for {body.get('client_name', 'client')}",
        "client.created":   f"New client {body.get('full_name', '')} added",
    }
    return templates.get(routing_key, f"Event: {routing_key}")


async def start_consumer():
    """Starts the RabbitMQ consumer loop with reconnect on failure."""
    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=10)

            exchange = await channel.declare_exchange(
                settings.RABBITMQ_EXCHANGE,
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )

            queue = await channel.declare_queue(
                "notification-service.events",
                durable=True,
                arguments={"x-message-ttl": 86_400_000},  # 24h TTL
            )

            for routing_key in ROUTING_MAP:
                await queue.bind(exchange, routing_key=routing_key)

            logger.info("RabbitMQ consumer started")
            await queue.consume(_handle_message)

            # Keep running until connection drops
            await asyncio.Future()

        except Exception as e:
            logger.warning(f"RabbitMQ consumer error: {e} — retrying in 5s")
            await asyncio.sleep(5)
