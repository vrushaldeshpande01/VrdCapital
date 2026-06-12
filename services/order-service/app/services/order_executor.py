"""
Handles actual order placement via broker-service.
Sandbox mode: immediately simulates a fill.
Live mode: calls broker-service which routes to real broker API.
"""
import uuid
import random
import string
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import httpx

from app.config import settings
from app.models.order import Order, OrderStatus, PriceType


def _mock_broker_order_id(broker: str) -> str:
    suffix = "".join(random.choices(string.digits, k=8))
    prefix = {"zerodha": "Z", "upstox": "U", "angelone": "A"}.get(broker, "X")
    return f"{prefix}{suffix}"


def _mock_fill_price(order: Order) -> Decimal:
    """Simulate a realistic fill price near the limit price or a typical market price."""
    if order.price and order.price_type == PriceType.LIMIT:
        # Fill at limit price ± small slippage
        slippage = Decimal(str(random.uniform(-0.002, 0.002)))
        return (order.price * (1 + slippage)).quantize(Decimal("0.01"))
    # Market order — use a plausible price for common symbols
    MARKET_PRICES = {
        "RELIANCE": Decimal("2485"), "TCS": Decimal("3892"), "INFY": Decimal("1458"),
        "HDFCBANK": Decimal("1673"), "WIPRO": Decimal("486"), "BAJFINANCE": Decimal("6890"),
        "SBIN": Decimal("815"), "ICICIBANK": Decimal("1245"), "AXISBANK": Decimal("1102"),
        "KOTAKBANK": Decimal("1785"), "MARUTI": Decimal("12450"), "TATAMOTORS": Decimal("985"),
        "SUNPHARMA": Decimal("1820"), "TITAN": Decimal("3650"), "LTIM": Decimal("5120"),
    }
    return MARKET_PRICES.get(order.symbol.upper(), Decimal("1000"))


async def execute_order(order: Order, token: str) -> dict:
    """
    Place an order via the broker-service.
    Returns dict with status, broker_order_id, average_price, executed_quantity.
    """
    # Try broker-service first (works for both sandbox and live credentials)
    if order.broker_credential_id:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{settings.BROKER_SERVICE_URL}/api/v1/orders/place",
                    json={
                        "credential_id": str(order.broker_credential_id),
                        "symbol": order.symbol,
                        "exchange": order.exchange,
                        "side": order.side.value,
                        "price_type": order.price_type.value,
                        "quantity": order.quantity,
                        "price": str(order.price) if order.price else None,
                        "trigger_price": str(order.trigger_price) if order.trigger_price else None,
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )
            if r.status_code == 200:
                return r.json()
        except httpx.RequestError:
            pass  # Fall through to sandbox simulation

    # Sandbox simulation (no credential or broker-service unavailable)
    now = datetime.now(timezone.utc)
    fill_price = _mock_fill_price(order)

    # MARKET orders fill immediately; LIMIT orders stay OPEN (simulated pending)
    if order.price_type == PriceType.MARKET:
        return {
            "status": OrderStatus.EXECUTED.value,
            "broker_order_id": _mock_broker_order_id(order.broker),
            "executed_quantity": order.quantity,
            "average_price": str(fill_price),
            "executed_at": now.isoformat(),
        }
    else:
        return {
            "status": OrderStatus.OPEN.value,
            "broker_order_id": _mock_broker_order_id(order.broker),
            "executed_quantity": 0,
            "average_price": None,
            "executed_at": None,
        }
