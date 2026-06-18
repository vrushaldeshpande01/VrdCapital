import csv
import io
import math
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
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

# Required CSV columns and their aliases
_CSV_REQUIRED = {"full_name", "email"}
_CSV_OPTIONAL = {
    "phone", "pan_number", "risk_profile", "annual_income",
    "investment_goal", "investment_horizon_years", "notes",
    "city", "state", "country",
}
_RISK_PROFILES = {"conservative", "moderate", "aggressive"}


def _parse_csv_row(row: dict, managed_by: str) -> tuple[Client | None, str | None]:
    """Return (Client, None) on success or (None, error_message) on failure."""
    full_name = row.get("full_name", "").strip()
    email = row.get("email", "").strip().lower()
    if not full_name or not email:
        return None, "full_name and email are required"

    risk = row.get("risk_profile", "moderate").strip().lower() or "moderate"
    if risk not in _RISK_PROFILES:
        risk = "moderate"

    annual_income = None
    if row.get("annual_income"):
        try:
            annual_income = float(row["annual_income"])
        except ValueError:
            pass

    horizon = None
    if row.get("investment_horizon_years"):
        try:
            horizon = int(row["investment_horizon_years"])
        except ValueError:
            pass

    client = Client(
        full_name=full_name,
        email=email,
        phone=row.get("phone", "").strip() or "",
        pan_number=row.get("pan_number", "").strip().upper() or None,
        risk_profile=risk,
        annual_income=annual_income,
        investment_goal=row.get("investment_goal", "").strip() or None,
        investment_horizon_years=horizon,
        notes=row.get("notes", "").strip() or None,
        city=row.get("city", "").strip() or None,
        state=row.get("state", "").strip() or None,
        country=row.get("country", "India").strip() or "India",
        managed_by=managed_by,
    )
    return client, None


@router.post("/import", status_code=200)
async def bulk_import_clients(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    """
    Bulk-import clients from a CSV file.
    Required columns: full_name, email
    Optional: phone, pan_number, risk_profile, annual_income, investment_goal,
              investment_horizon_years, notes, city, state, country
    Skips rows with duplicate email/PAN. Returns per-row results.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")  # strip BOM if present
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no header row")

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = _CSV_REQUIRED - headers
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {', '.join(sorted(missing))}",
        )

    created, skipped, errors = [], [], []

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
        email = row.get("email", "").lower().strip()
        pan = row.get("pan_number", "").upper().strip() or None

        # Duplicate check
        dup_email = (await db.execute(
            select(Client).where(Client.email == email, Client.deleted_at.is_(None))
        )).scalar_one_or_none()
        if dup_email:
            skipped.append({"row": row_num, "email": email, "reason": "email already exists"})
            continue

        if pan:
            dup_pan = (await db.execute(
                select(Client).where(Client.pan_number == pan, Client.deleted_at.is_(None))
            )).scalar_one_or_none()
            if dup_pan:
                skipped.append({"row": row_num, "email": email, "reason": f"PAN {pan} already exists"})
                continue

        client, err = _parse_csv_row(row, current_user.user_id)
        if err:
            errors.append({"row": row_num, "email": email, "reason": err})
            continue

        db.add(client)
        try:
            await db.flush()
            created.append({"row": row_num, "id": str(client.id), "email": email, "name": client.full_name})
        except Exception as exc:
            await db.rollback()
            errors.append({"row": row_num, "email": email, "reason": str(exc)})

    await db.commit()
    return {
        "created": len(created),
        "skipped": len(skipped),
        "errors": len(errors),
        "rows_created": created,
        "rows_skipped": skipped,
        "rows_errored": errors,
    }


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
