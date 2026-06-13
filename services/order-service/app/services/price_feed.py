"""
Mock price feed service.
Updates Instrument.ltp in the database; returns current LTP for margin estimates.
"""
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instrument import Instrument


async def get_ltp(symbol: str, db: AsyncSession) -> Decimal:
    row = (await db.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))).scalar_one_or_none()
    return Decimal(str(row.ltp)) if row and row.ltp else Decimal("0")


async def update_ltp(symbol: str, price: Decimal, db: AsyncSession) -> bool:
    row = (await db.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))).scalar_one_or_none()
    if not row:
        return False
    row.ltp = price
    await db.flush()
    return True
