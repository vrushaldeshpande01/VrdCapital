from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.fund import ClientFund
from app.services.margin_service import _get_or_create_fund
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser

router = APIRouter(prefix="/funds", tags=["Funds"])


class FundResponse(BaseModel):
    id: UUID
    client_id: UUID
    available: Decimal
    used: Decimal
    total: Decimal

    model_config = {"from_attributes": True}


class FundSetRequest(BaseModel):
    available: Decimal
    total: Decimal


@router.get("/{client_id}", response_model=FundResponse)
async def get_fund(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    fund = await _get_or_create_fund(client_id, db)
    return fund


@router.put("/{client_id}", response_model=FundResponse)
async def set_fund(
    client_id: UUID,
    body: FundSetRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    """Set or reset available / total funds for a client (admin/PM only)."""
    fund = await _get_or_create_fund(client_id, db)
    fund.total     = body.total
    fund.available = body.available
    fund.used      = body.total - body.available
    await db.flush()
    await db.refresh(fund)
    return fund
