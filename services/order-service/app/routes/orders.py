import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.order import Order, OrderStatus, OrderSide, PriceType, ProductType
from app.models.instrument import Instrument, InstrumentType
from app.models.trade import Trade
from app.schemas.order import (
    OrderCreate, OrderResponse, OrderListResponse,
    OrderCancelRequest, OrderModifyRequest,
)
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser
from app.services.order_executor import execute_order
from app.services.publisher import publish_order_event
from app.services.margin_service import validate_margin, block_margin, release_margin
from prometheus_client import Counter as _Counter

ORDERS_PLACED = _Counter("orders_placed_total", "Total orders placed", ["side", "price_type", "status"])

router = APIRouter(prefix="/orders", tags=["Orders"])


async def _validate_order(body: OrderCreate, db: AsyncSession) -> Instrument | None:
    """Apply business rules; return Instrument row if found, else None."""
    # Price rules by order type
    if body.price_type == PriceType.MARKET and body.price is not None:
        raise HTTPException(400, "MARKET orders must not have a price")
    if body.price_type == PriceType.LIMIT and (body.price is None or body.price <= 0):
        raise HTTPException(400, "LIMIT orders require price > 0")
    if body.price_type in (PriceType.SL, PriceType.SL_M) and not body.trigger_price:
        raise HTTPException(400, "SL/SL_M orders require triggerPrice")

    # Fetch instrument for further validation
    instr = (await db.execute(
        select(Instrument).where(Instrument.symbol == body.symbol.upper())
    )).scalar_one_or_none()

    if instr:
        # CNC only for EQUITY
        if body.product_type == ProductType.CNC and instr.instrument_type != InstrumentType.EQUITY:
            raise HTTPException(400, "CNC product type is only allowed for EQUITY instruments")
        # F&O lot size validation
        if instr.instrument_type in (InstrumentType.FUTURES, InstrumentType.OPTIONS):
            if body.quantity % instr.lot_size != 0:
                raise HTTPException(
                    400,
                    f"Quantity must be a multiple of lot size ({instr.lot_size}) for F&O instruments",
                )

    return instr


async def _create_trade(order: Order, fill_price: Decimal, db: AsyncSession) -> Trade:
    trade = Trade(
        order_id=order.id,
        client_id=order.client_id,
        managed_by=order.managed_by,
        symbol=order.symbol,
        exchange=order.exchange,
        side=order.side,
        fill_qty=order.executed_quantity,
        fill_price=fill_price,
        product_type=order.product_type,
    )
    db.add(trade)
    await db.flush()
    return trade


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def place_order(
    body: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    instr = await _validate_order(body, db)

    # Estimate cost for margin check
    if body.price_type == PriceType.MARKET:
        ltp = Decimal(str(instr.ltp)) if instr else Decimal("1000")
        estimated_cost = ltp * body.quantity
    else:
        estimated_cost = (body.price or Decimal("0")) * body.quantity

    await validate_margin(body.client_id, estimated_cost, db)

    order = Order(
        client_id=body.client_id,
        broker_credential_id=body.broker_credential_id,
        broker=body.broker,
        managed_by=current_user.user_id,
        symbol=body.symbol.upper(),
        exchange=body.exchange.upper(),
        instrument_id=instr.id if instr else None,
        side=body.side,
        price_type=body.price_type,
        product_type=body.product_type,
        validity=body.validity,
        quantity=body.quantity,
        price=body.price,
        trigger_price=body.trigger_price,
        tag=body.tag,
        basket_id=body.basket_id,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()

    # Block margin
    await block_margin(body.client_id, estimated_cost, db)

    # Execute via broker-service / sandbox simulation
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    result = await execute_order(order, token)

    order.status = OrderStatus(result["status"])
    order.broker_order_id = result.get("broker_order_id")
    order.executed_quantity = result.get("executed_quantity", 0)
    fill_price = None
    if result.get("average_price"):
        fill_price = Decimal(str(result["average_price"]))
        order.average_price = fill_price
    if result.get("executed_at"):
        order.executed_at = datetime.fromisoformat(result["executed_at"])

    # Create trade record on execution
    if order.status == OrderStatus.EXECUTED and fill_price:
        await _create_trade(order, fill_price, db)
        # Release blocked margin (cost settled at actual fill price)
        actual_cost = fill_price * order.executed_quantity
        await release_margin(body.client_id, estimated_cost, db)
        await block_margin(body.client_id, actual_cost, db)

    # Release margin fully on rejection/failure
    if order.status in (OrderStatus.REJECTED, OrderStatus.FAILED):
        await release_margin(body.client_id, estimated_cost, db)

    await db.flush()
    await db.refresh(order)

    ORDERS_PLACED.labels(side=order.side.value, price_type=order.price_type.value, status=order.status.value).inc()

    routing_key = {
        "EXECUTED": "order.executed",
        "FAILED":   "order.failed",
        "CANCELLED": "order.cancelled",
    }.get(order.status.value, "order.submitted")

    await publish_order_event(routing_key, {
        "order_id":    str(order.id),
        "managed_by":  str(order.managed_by),
        "symbol":      order.symbol,
        "exchange":    order.exchange,
        "side":        order.side.value,
        "quantity":    order.quantity,
        "average_price": str(order.average_price) if order.average_price else None,
        "broker":      order.broker,
        "status":      order.status.value,
        "product_type": order.product_type.value,
    })

    return order


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    client_id: Optional[UUID] = None,
    broker: Optional[str] = None,
    side: Optional[OrderSide] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    symbol: Optional[str] = None,
    basket_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Order)

    if not current_user.is_admin:
        q = q.where(Order.managed_by == current_user.user_id)

    if client_id:
        q = q.where(Order.client_id == client_id)
    if broker:
        q = q.where(Order.broker == broker)
    if side:
        q = q.where(Order.side == side)
    if status_filter:
        statuses = [OrderStatus(s.strip()) for s in status_filter.split(",")]
        q = q.where(Order.status.in_(statuses))
    if symbol:
        q = q.where(Order.symbol.ilike(f"%{symbol}%"))
    if basket_id:
        q = q.where(Order.basket_id == basket_id)
    if date_from:
        q = q.where(Order.placed_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(Order.placed_at <= datetime.fromisoformat(date_to))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()

    q = q.order_by(Order.placed_at.desc()).offset((page - 1) * size).limit(size)
    orders = (await db.execute(q)).scalars().all()

    return OrderListResponse(
        items=list(orders),
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/stats/summary")
async def order_stats(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Order)
    if not current_user.is_admin:
        q = q.where(Order.managed_by == current_user.user_id)

    all_orders = (await db.execute(q)).scalars().all()
    today = datetime.now(timezone.utc).date()
    today_orders = [o for o in all_orders if o.placed_at.date() == today]

    return {
        "total": len(all_orders),
        "today": len(today_orders),
        "executed": sum(1 for o in all_orders if o.status == OrderStatus.EXECUTED),
        "pending": sum(1 for o in all_orders if o.status in (OrderStatus.PENDING, OrderStatus.OPEN, OrderStatus.SUBMITTED)),
        "cancelled": sum(1 for o in all_orders if o.status == OrderStatus.CANCELLED),
        "rejected": sum(1 for o in all_orders if o.status in (OrderStatus.REJECTED, OrderStatus.FAILED)),
        "today_executed": sum(1 for o in today_orders if o.status == OrderStatus.EXECUTED),
        "today_pending": sum(1 for o in today_orders if o.status in (OrderStatus.PENDING, OrderStatus.OPEN)),
    }


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_admin and str(order.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return order


@router.patch("/{order_id}", response_model=OrderResponse)
async def modify_order(
    order_id: UUID,
    body: OrderModifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_admin and str(order.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    modifiable = {OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.OPEN}
    if order.status not in modifiable:
        raise HTTPException(status_code=400, detail=f"Cannot modify order with status {order.status.value}")

    if body.quantity is not None:
        order.quantity = body.quantity
    if body.price is not None:
        order.price = body.price
    if body.trigger_price is not None:
        order.trigger_price = body.trigger_price
    if body.validity is not None:
        order.validity = body.validity

    await db.flush()
    await db.refresh(order)
    return order


@router.patch("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: UUID,
    body: OrderCancelRequest = OrderCancelRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not current_user.is_admin and str(order.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    cancellable = {OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.OPEN}
    if order.status not in cancellable:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status {order.status.value}")

    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    if body.reason:
        order.rejection_reason = body.reason

    # Release blocked margin
    if order.price and order.quantity:
        await release_margin(order.client_id, Decimal(str(order.price)) * order.quantity, db)

    await db.flush()
    await db.refresh(order)
    return order


@router.post("/{order_id}/execute", response_model=OrderResponse)
async def force_execute_order(
    order_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    """Dev/test endpoint — manually trigger execution of a LIMIT/SL order (simulates exchange fill)."""
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.SUBMITTED):
        raise HTTPException(status_code=400, detail=f"Order is not in an executable state ({order.status.value})")

    fill_price = order.price or Decimal("1000")
    order.status = OrderStatus.EXECUTED
    order.executed_quantity = order.quantity
    order.average_price = fill_price
    order.executed_at = datetime.now(timezone.utc)

    await _create_trade(order, fill_price, db)

    await db.flush()
    await db.refresh(order)
    return order
