import math
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.order import BasketOrder, BasketOrderItem, Order, BasketStatus, OrderStatus
from app.schemas.order import (
    BasketCreate, BasketResponse, BasketDetailResponse,
    BasketExecuteRequest, BasketItemResponse, OrderResponse,
)
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser
from app.services.order_executor import execute_order

router = APIRouter(prefix="/baskets", tags=["Basket Orders"])


@router.post("", response_model=BasketDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_basket(
    body: BasketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    basket = BasketOrder(
        name=body.name,
        description=body.description,
        created_by=current_user.user_id,
        status=BasketStatus.DRAFT,
        total_orders=0,
    )
    db.add(basket)
    await db.flush()

    items = []
    for item in body.items:
        bi = BasketOrderItem(
            basket_id=basket.id,
            symbol=item.symbol.upper(),
            exchange=item.exchange.upper(),
            side=item.side,
            price_type=item.price_type,
            quantity=item.quantity,
            price=item.price,
        )
        db.add(bi)
        items.append(bi)

    await db.flush()
    await db.refresh(basket)
    for bi in items:
        await db.refresh(bi)

    result = BasketDetailResponse.model_validate(basket)
    result.items = [BasketItemResponse.model_validate(bi) for bi in items]
    return result


@router.get("", response_model=list[BasketResponse])
async def list_baskets(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(BasketOrder)
    if not current_user.is_admin:
        q = q.where(BasketOrder.created_by == current_user.user_id)
    q = q.order_by(BasketOrder.created_at.desc())
    baskets = (await db.execute(q)).scalars().all()
    return list(baskets)


@router.get("/{basket_id}", response_model=BasketDetailResponse)
async def get_basket(
    basket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    basket = (await db.execute(select(BasketOrder).where(BasketOrder.id == basket_id))).scalar_one_or_none()
    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")

    items = (await db.execute(
        select(BasketOrderItem).where(BasketOrderItem.basket_id == basket_id)
    )).scalars().all()

    result = BasketDetailResponse.model_validate(basket)
    result.items = [BasketItemResponse.model_validate(i) for i in items]
    return result


@router.post("/{basket_id}/execute")
async def execute_basket(
    basket_id: UUID,
    body: BasketExecuteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    basket = (await db.execute(select(BasketOrder).where(BasketOrder.id == basket_id))).scalar_one_or_none()
    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")

    items = (await db.execute(
        select(BasketOrderItem).where(BasketOrderItem.basket_id == basket_id)
    )).scalars().all()

    if not items:
        raise HTTPException(status_code=400, detail="Basket has no items")
    if not body.client_ids:
        raise HTTPException(status_code=400, detail="No clients selected")

    basket.status = BasketStatus.EXECUTING
    basket.total_orders = len(items) * len(body.client_ids)
    await db.flush()

    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    executed = 0
    failed = 0
    created_orders = []

    for client_id in body.client_ids:
        for item in items:
            order = Order(
                client_id=client_id,
                broker="sandbox",
                managed_by=current_user.user_id,
                symbol=item.symbol,
                exchange=item.exchange,
                side=item.side,
                price_type=item.price_type,
                quantity=item.quantity,
                price=item.price,
                basket_id=basket_id,
                status=OrderStatus.PENDING,
            )
            db.add(order)
            await db.flush()

            try:
                result = await execute_order(order, token)
                order.status = OrderStatus(result["status"])
                order.broker_order_id = result.get("broker_order_id")
                order.executed_quantity = result.get("executed_quantity", 0)
                if result.get("average_price"):
                    from decimal import Decimal
                    order.average_price = Decimal(str(result["average_price"]))
                if result.get("executed_at"):
                    order.executed_at = datetime.fromisoformat(result["executed_at"])
                if order.status == OrderStatus.EXECUTED:
                    executed += 1
                else:
                    executed += 1  # OPEN counts as placed successfully
            except Exception as e:
                order.status = OrderStatus.FAILED
                order.rejection_reason = str(e)
                failed += 1

            await db.flush()
            created_orders.append(order)

    basket.executed_orders = executed
    basket.failed_orders = failed
    basket.status = BasketStatus.COMPLETED if failed == 0 else BasketStatus.PARTIALLY_COMPLETED
    basket.executed_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "basket_id": str(basket_id),
        "basket_name": basket.name,
        "total_orders": basket.total_orders,
        "executed": executed,
        "failed": failed,
        "status": basket.status.value,
        "order_ids": [str(o.id) for o in created_orders],
    }


@router.get("/{basket_id}/orders", response_model=list[OrderResponse])
async def get_basket_orders(
    basket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    orders = (await db.execute(
        select(Order).where(Order.basket_id == basket_id).order_by(Order.placed_at.desc())
    )).scalars().all()
    return list(orders)
