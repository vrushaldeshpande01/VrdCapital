from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instrument import Instrument, InstrumentType
from app.core.dependencies import get_current_user, CurrentUser
from app.services.price_feed import update_ltp

router = APIRouter(prefix="/instruments", tags=["Instruments"])


class InstrumentResponse(BaseModel):
    id: UUID
    symbol: str
    name: str
    exchange: str
    instrument_type: InstrumentType
    lot_size: int
    tick_size: Decimal
    ltp: Decimal

    model_config = {"from_attributes": True}


class LtpUpdateRequest(BaseModel):
    price: Decimal


@router.get("", response_model=list[InstrumentResponse])
async def search_instruments(
    q: Optional[str] = Query(None, description="Search by symbol or name"),
    exchange: Optional[str] = None,
    instrument_type: Optional[InstrumentType] = None,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    stmt = select(Instrument)
    if q:
        term = f"%{q.upper()}%"
        stmt = stmt.where(or_(
            Instrument.symbol.ilike(term),
            Instrument.name.ilike(f"%{q}%"),
        ))
    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange.upper())
    if instrument_type:
        stmt = stmt.where(Instrument.instrument_type == instrument_type)
    stmt = stmt.order_by(Instrument.symbol).limit(20)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.get("/{instrument_id}", response_model=InstrumentResponse)
async def get_instrument(
    instrument_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    row = (await db.execute(select(Instrument).where(Instrument.id == instrument_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return row


@router.patch("/{symbol}/ltp", response_model=InstrumentResponse)
async def set_ltp(
    symbol: str,
    body: LtpUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    """Dev/test endpoint — simulate a price change."""
    found = await update_ltp(symbol, body.price, db)
    if not found:
        raise HTTPException(status_code=404, detail="Instrument not found")
    row = (await db.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))).scalar_one_or_none()
    return row
