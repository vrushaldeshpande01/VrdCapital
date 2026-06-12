from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.broker import BrokerCredential
from app.schemas.broker import CredentialCreate, CredentialUpdate, CredentialResponse, ConnectionTestResult
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser
from app.core.encryption import encrypt
from app.services.adapter_factory import get_adapter

router = APIRouter(prefix="/credentials", tags=["Broker Credentials"])
bearer = HTTPBearer()


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def add_credential(
    body: CredentialCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    # Prevent duplicate broker accounts for same client
    existing = await db.execute(
        select(BrokerCredential).where(
            BrokerCredential.client_id == body.client_id,
            BrokerCredential.broker == body.broker,
            BrokerCredential.account_id == body.account_id,
            BrokerCredential.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Broker account already exists for this client")

    cred = BrokerCredential(
        client_id=body.client_id,
        broker=body.broker,
        account_id=body.account_id,
        display_name=body.display_name or f"{body.broker.value.title()} - {body.account_id}",
        api_key_encrypted=encrypt(body.api_key) if body.api_key else None,
        api_secret_encrypted=encrypt(body.api_secret) if body.api_secret else None,
        is_sandbox=body.is_sandbox,
    )
    db.add(cred)
    await db.flush()
    await db.refresh(cred)
    return _to_response(cred)


@router.get("/{client_id}", response_model=list[CredentialResponse])
async def list_credentials(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(BrokerCredential).where(BrokerCredential.client_id == client_id)
        .order_by(BrokerCredential.created_at.desc())
    )
    return [_to_response(c) for c in result.scalars().all()]


@router.patch("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: UUID,
    body: CredentialUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(BrokerCredential).where(BrokerCredential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    if body.display_name is not None:
        cred.display_name = body.display_name
    if body.api_key is not None:
        cred.api_key_encrypted = encrypt(body.api_key)
    if body.api_secret is not None:
        cred.api_secret_encrypted = encrypt(body.api_secret)
    if body.access_token is not None:
        cred.access_token_encrypted = encrypt(body.access_token)
    if body.is_sandbox is not None:
        cred.is_sandbox = body.is_sandbox
    if body.is_active is not None:
        cred.is_active = body.is_active

    await db.flush()
    await db.refresh(cred)
    return _to_response(cred)


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_portfolio_manager()),
):
    result = await db.execute(select(BrokerCredential).where(BrokerCredential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    cred.is_active = False


@router.post("/{credential_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    credential_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(BrokerCredential).where(BrokerCredential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    adapter = get_adapter(cred)
    success, message, profile = await adapter.test_connection()

    return ConnectionTestResult(
        success=success,
        broker=cred.broker,
        account_id=cred.account_id,
        mode="sandbox" if cred.is_sandbox else "live",
        message=message,
        profile=vars(profile) if profile else None,
    )


def _to_response(cred: BrokerCredential) -> CredentialResponse:
    return CredentialResponse(
        id=cred.id,
        client_id=cred.client_id,
        broker=cred.broker,
        account_id=cred.account_id,
        display_name=cred.display_name,
        is_sandbox=cred.is_sandbox,
        is_active=cred.is_active,
        has_api_key=bool(cred.api_key_encrypted),
        has_access_token=bool(cred.access_token_encrypted),
        token_expiry=cred.token_expiry,
        last_sync_at=cred.last_sync_at,
        last_sync_status=cred.last_sync_status,
        total_syncs=cred.total_syncs or 0,
        created_at=cred.created_at,
    )
