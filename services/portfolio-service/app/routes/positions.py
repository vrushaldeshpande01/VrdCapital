from typing import Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.portfolio import Position
from app.schemas.portfolio import PositionCreate, PositionResponse
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser

router = APIRouter(prefix="/positions", tags=["Positions"])


@router.post("", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def create_position(
    body: PositionCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    position = Position(**body.model_dump())
    if not position.trade_date:
        position.trade_date = date.today()
    db.add(position)
    await db.flush()
    await db.refresh(position)
    return position


@router.get("", response_model=list[PositionResponse])
async def list_positions(
    client_id: UUID = Query(...),
    trade_date: Optional[date] = None,
    is_open: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(Position).where(Position.client_id == client_id)
    if trade_date:
        q = q.where(Position.trade_date == trade_date)
    if is_open is not None:
        q = q.where(Position.is_open == is_open)
    q = q.order_by(Position.trade_date.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{position_id}", response_model=PositionResponse)
async def update_position(
    position_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(Position).where(Position.id == position_id))
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    for field, value in body.items():
        if hasattr(position, field):
            setattr(position, field, value)
    await db.flush()
    await db.refresh(position)
    return position
