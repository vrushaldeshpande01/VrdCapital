"""
Margin / fund management for order placement.
Blocks margin on order placement, releases on cancel or rejection.
"""
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fund import ClientFund


async def _get_or_create_fund(client_id: UUID, db: AsyncSession) -> ClientFund:
    fund = (await db.execute(select(ClientFund).where(ClientFund.client_id == client_id))).scalar_one_or_none()
    if not fund:
        fund = ClientFund(client_id=client_id)
        db.add(fund)
        await db.flush()
    return fund


async def validate_margin(client_id: UUID, estimated_cost: Decimal, db: AsyncSession) -> ClientFund:
    fund = await _get_or_create_fund(client_id, db)
    if Decimal(str(fund.available)) < estimated_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient funds. Available: ₹{fund.available:.2f}, Required: ₹{estimated_cost:.2f}",
        )
    return fund


async def block_margin(client_id: UUID, amount: Decimal, db: AsyncSession) -> ClientFund:
    fund = await _get_or_create_fund(client_id, db)
    fund.available = Decimal(str(fund.available)) - amount
    fund.used = Decimal(str(fund.used)) + amount
    await db.flush()
    return fund


async def release_margin(client_id: UUID, amount: Decimal, db: AsyncSession) -> ClientFund:
    fund = await _get_or_create_fund(client_id, db)
    release = min(Decimal(str(fund.used)), amount)
    fund.used = Decimal(str(fund.used)) - release
    fund.available = Decimal(str(fund.available)) + release
    await db.flush()
    return fund
