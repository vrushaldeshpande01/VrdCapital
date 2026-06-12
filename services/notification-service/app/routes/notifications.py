import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Header, Query
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import Notification
from app.core.dependencies import get_current_user, CurrentUser
from app.services.connection_manager import manager
from app.config import settings
import httpx

router = APIRouter(tags=["Notifications"])


# ── WebSocket ──────────────────────────────────────────────────────────────────

@router.websocket("/ws/notifications")
async def websocket_notifications(ws: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint. Client connects with ?token=<jwt>
    Stays open to receive real-time notification pushes.
    """
    # Validate token via auth-service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code != 200:
            await ws.close(code=4001, reason="Unauthorized")
            return
        user_data = r.json()
        user_id = user_data["id"]
    except Exception:
        await ws.close(code=4001, reason="Auth error")
        return

    await manager.connect(user_id, ws)
    try:
        # Send ping periodically to keep alive
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, ws)


# ── REST ───────────────────────────────────────────────────────────────────────

async def _auth(authorization: str = Header(default="")) -> CurrentUser:
    return await get_current_user(authorization)


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = False,
    page: int = 1,
    size: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    q = select(Notification).where(Notification.user_id == UUID(current_user.user_id))
    if unread_only:
        q = q.where(Notification.is_read == False)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    unread = (await db.execute(
        select(func.count()).select_from(
            select(Notification)
            .where(Notification.user_id == UUID(current_user.user_id))
            .where(Notification.is_read == False)
            .subquery()
        )
    )).scalar()

    q = q.order_by(Notification.created_at.desc()).offset((page - 1) * size).limit(size)
    items = (await db.execute(q)).scalars().all()

    return {
        "items": [_serialize(n) for n in items],
        "total": total,
        "unread": unread,
        "page": page,
        "size": size,
    }


@router.patch("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    notif = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == UUID(current_user.user_id),
        )
    )).scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    return _serialize(notif)


@router.patch("/notifications/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == UUID(current_user.user_id),
            Notification.is_read == False,
        )
        .values(is_read=True, read_at=now)
    )
    return {"message": "All notifications marked as read"}


@router.get("/notifications/stats")
async def notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    unread = (await db.execute(
        select(func.count()).where(
            Notification.user_id == UUID(current_user.user_id),
            Notification.is_read == False,
        )
    )).scalar()
    return {"unread": unread}


def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type.value,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "read_at": n.read_at.isoformat() if n.read_at else None,
    }
