from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.order import OrderStatus, OrderSide, PriceType, BasketStatus


class OrderCreate(BaseModel):
    client_id: UUID
    broker_credential_id: Optional[UUID] = None
    broker: str
    symbol: str
    exchange: str = "NSE"
    side: OrderSide
    price_type: PriceType = PriceType.MARKET
    quantity: int
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    basket_id: Optional[UUID] = None


class OrderResponse(BaseModel):
    id: UUID
    client_id: UUID
    broker_credential_id: Optional[UUID]
    broker: str
    managed_by: UUID
    symbol: str
    exchange: str
    side: OrderSide
    price_type: PriceType
    quantity: int
    price: Optional[Decimal]
    trigger_price: Optional[Decimal]
    status: OrderStatus
    broker_order_id: Optional[str]
    executed_quantity: int
    average_price: Optional[Decimal]
    rejection_reason: Optional[str]
    basket_id: Optional[UUID]
    placed_at: datetime
    executed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    size: int
    pages: int


class OrderCancelRequest(BaseModel):
    reason: Optional[str] = None


# Basket schemas
class BasketItemCreate(BaseModel):
    symbol: str
    exchange: str = "NSE"
    side: OrderSide
    price_type: PriceType = PriceType.MARKET
    quantity: int
    price: Optional[Decimal] = None


class BasketCreate(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[BasketItemCreate]


class BasketExecuteRequest(BaseModel):
    client_ids: List[UUID]
    broker_credential_ids: Optional[List[UUID]] = None


class BasketItemResponse(BaseModel):
    id: UUID
    basket_id: UUID
    symbol: str
    exchange: str
    side: OrderSide
    price_type: PriceType
    quantity: int
    price: Optional[Decimal]

    model_config = {"from_attributes": True}


class BasketResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    status: BasketStatus
    total_orders: int
    executed_orders: int
    failed_orders: int
    created_at: datetime
    executed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class BasketDetailResponse(BasketResponse):
    items: List[BasketItemResponse] = []
