import math
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.client import Client, BrokerAccount, ClientStatus
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientListResponse,
    BrokerAccountCreate, BrokerAccountUpdate, BrokerAccountResponse
)
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(Client).where(Client.email == body.email, Client.deleted_at == None))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Client with this email already exists")

    if body.pan_number:
        result = await db.execute(select(Client).where(Client.pan_number == body.pan_number, Client.deleted_at == None))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Client with this PAN already exists")

    client = Client(
        **body.model_dump(),
        managed_by=current_user.user_id,
    )
    db.add(client)
    await db.flush()
    result = await db.execute(
        select(Client).options(selectinload(Client.broker_accounts)).where(Client.id == client.id)
    )
    return result.scalar_one()


@router.get("", response_model=ClientListResponse)
async def list_clients(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[ClientStatus] = None,
    search: Optional[str] = None,
    managed_by: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    query = select(Client).where(Client.deleted_at == None)

    # Portfolio managers only see their own clients unless admin
    if not current_user.is_admin:
        query = query.where(Client.managed_by == current_user.user_id)
    elif managed_by:
        query = query.where(Client.managed_by == managed_by)

    if status:
        query = query.where(Client.status == status)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Client.full_name.ilike(search_term),
                Client.email.ilike(search_term),
                Client.phone.ilike(search_term),
                Client.pan_number.ilike(search_term),
            )
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.options(selectinload(Client.broker_accounts)).offset((page - 1) * size).limit(size).order_by(Client.created_at.desc())
    result = await db.execute(query)
    clients = result.scalars().all()

    return ClientListResponse(
        items=clients,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/stats")
async def get_client_stats(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    base_query = select(Client).where(Client.deleted_at == None)
    if not current_user.is_admin:
        base_query = base_query.where(Client.managed_by == current_user.user_id)

    total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar()

    active_query = base_query.where(Client.status == ClientStatus.ACTIVE)
    active_result = await db.execute(select(func.count()).select_from(active_query.subquery()))
    active = active_result.scalar()

    kyc_query = base_query.where(Client.kyc_verified == True)
    kyc_result = await db.execute(select(func.count()).select_from(kyc_query.subquery()))
    kyc_verified = kyc_result.scalar()

    return {
        "total_clients": total,
        "active_clients": active,
        "inactive_clients": total - active,
        "kyc_verified": kyc_verified,
        "kyc_pending": total - kyc_verified,
    }


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Client).options(selectinload(Client.broker_accounts)).where(Client.id == client_id, Client.deleted_at == None)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    if not current_user.is_admin and str(client.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return client


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    body: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(
        select(Client).options(selectinload(Client.broker_accounts)).where(Client.id == client_id, Client.deleted_at == None)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    if not current_user.is_admin and str(client.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = body.model_dump(exclude_unset=True)

    if "pan_number" in update_data and update_data["pan_number"]:
        dup = await db.execute(
            select(Client).where(Client.pan_number == update_data["pan_number"], Client.id != client_id, Client.deleted_at == None)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another client already has this PAN number")

    if update_data.get("kyc_verified") and not client.kyc_verified:
        update_data["kyc_verified_at"] = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(client, field, value)

    await db.flush()
    result = await db.execute(
        select(Client).options(selectinload(Client.broker_accounts)).where(Client.id == client_id)
    )
    return result.scalar_one()


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.deleted_at == None)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    if not current_user.is_admin and str(client.managed_by) != str(current_user.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    client.deleted_at = datetime.now(timezone.utc)
    client.status = ClientStatus.INACTIVE


# Broker Account endpoints
@router.post("/{client_id}/broker-accounts", response_model=BrokerAccountResponse, status_code=status.HTTP_201_CREATED)
async def add_broker_account(
    client_id: UUID,
    body: BrokerAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.deleted_at == None)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    # Check duplicate broker account
    result = await db.execute(
        select(BrokerAccount).where(
            BrokerAccount.client_id == client_id,
            BrokerAccount.broker == body.broker,
            BrokerAccount.account_id == body.account_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Broker account already exists")

    account = BrokerAccount(client_id=client_id, **body.model_dump())
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


@router.get("/{client_id}/broker-accounts", response_model=list[BrokerAccountResponse])
async def list_broker_accounts(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerAccount).where(BrokerAccount.client_id == client_id)
    )
    return result.scalars().all()


@router.delete("/{client_id}/broker-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_broker_account(
    client_id: UUID,
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(
        select(BrokerAccount).where(
            BrokerAccount.id == account_id,
            BrokerAccount.client_id == client_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker account not found")
    await db.delete(account)
