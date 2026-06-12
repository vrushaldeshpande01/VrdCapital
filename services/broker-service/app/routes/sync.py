from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.broker import SyncLog
from app.schemas.broker import SyncRequest, SyncResult, SyncLogResponse
from app.core.dependencies import get_current_user, require_portfolio_manager, CurrentUser
from app.services.sync_engine import sync_client_holdings

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/{client_id}", response_model=SyncResult)
async def trigger_sync(
    client_id: UUID,
    body: SyncRequest = SyncRequest(),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_manager()),
):
    # Extract auth token to forward to portfolio-service
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""

    result = await sync_client_holdings(
        client_id=client_id,
        db=db,
        auth_token=token,
        credential_ids=body.credential_ids,
    )
    return SyncResult(**result)


@router.get("/{client_id}/logs", response_model=list[SyncLogResponse])
async def get_sync_logs(
    client_id: UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(SyncLog)
        .where(SyncLog.client_id == client_id)
        .order_by(SyncLog.started_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    response = []
    for log in logs:
        duration = None
        if log.completed_at and log.started_at:
            duration = (log.completed_at - log.started_at).total_seconds()
        response.append(SyncLogResponse(
            id=log.id,
            credential_id=log.credential_id,
            client_id=log.client_id,
            broker=log.broker,
            sync_type=log.sync_type,
            status=log.status,
            records_synced=log.records_synced or 0,
            error_message=log.error_message,
            started_at=log.started_at,
            completed_at=log.completed_at,
            duration_seconds=duration,
        ))
    return response
