"""
Broker-service order placement endpoint.
Order-service calls this to route orders to the correct broker adapter.
Sandbox credentials: returns a simulated fill immediately.
Live credentials: calls the real broker API.
"""
from uuid import UUID
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.broker import BrokerCredential
from app.services.adapter_factory import get_adapter
from app.core.dependencies import get_current_user, CurrentUser

router = APIRouter(prefix="/orders", tags=["Order Routing"])


class PlaceOrderRequest(BaseModel):
    credential_id: UUID
    symbol: str
    exchange: str = "NSE"
    side: str          # BUY / SELL
    price_type: str    # MARKET / LIMIT / SL / SL_M
    quantity: int
    price: Optional[str] = None
    trigger_price: Optional[str] = None


@router.post("/place")
async def place_order(
    body: PlaceOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerCredential).where(
            BrokerCredential.id == body.credential_id,
            BrokerCredential.is_active == True,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Broker credential not found")

    adapter = get_adapter(cred)

    try:
        order_result = await adapter.place_order(
            symbol=body.symbol,
            exchange=body.exchange,
            side=body.side,
            price_type=body.price_type,
            quantity=body.quantity,
            price=Decimal(body.price) if body.price else None,
            trigger_price=Decimal(body.trigger_price) if body.trigger_price else None,
        )
        return order_result
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Order placement not supported for this broker in current mode")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Broker error: {str(e)}")
