"""
Smart Alerts — CRUD + evaluation endpoint.

Evaluation is intentionally lightweight: the frontend (or a future cron)
calls POST /alerts/evaluate to check all active alerts against current
market prices fetched from broker-service.
"""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user, CurrentUser
from app.database import get_db
from app.models.alert import Alert, AlertCondition, AlertStatus
from app.models.notification import Notification, NotificationType
from app.services.connection_manager import manager

router = APIRouter(prefix="/alerts", tags=["Alerts"])


async def _auth(authorization: str = Header(default="")) -> CurrentUser:
    return await get_current_user(authorization)


class AlertCreate(BaseModel):
    symbol:      str | None = None
    client_id:   UUID | None = None
    condition:   AlertCondition
    threshold:   float = Field(..., gt=0)
    label:       str | None = None
    repeat_count: int | None = 1


class AlertResponse(BaseModel):
    id: str
    symbol: str | None
    client_id: str | None
    condition: str
    threshold: float
    label: str | None
    status: str
    fired_count: int
    repeat_count: int | None
    triggered_at: str | None
    created_at: str

    @classmethod
    def from_orm(cls, a: Alert) -> "AlertResponse":
        return cls(
            id=str(a.id),
            symbol=a.symbol,
            client_id=str(a.client_id) if a.client_id else None,
            condition=a.condition.value,
            threshold=float(a.threshold),
            label=a.label,
            status=a.status.value,
            fired_count=a.fired_count,
            repeat_count=a.repeat_count,
            triggered_at=a.triggered_at.isoformat() if a.triggered_at else None,
            created_at=a.created_at.isoformat() if a.created_at else "",
        )


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    if not body.symbol and not body.client_id:
        raise HTTPException(400, "Either symbol or client_id must be provided")

    alert = Alert(
        user_id=UUID(current_user.user_id),
        symbol=body.symbol.upper() if body.symbol else None,
        client_id=body.client_id,
        condition=body.condition,
        threshold=Decimal(str(body.threshold)),
        label=body.label,
        repeat_count=body.repeat_count,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    await db.commit()
    return AlertResponse.from_orm(alert)


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    q = select(Alert).where(Alert.user_id == UUID(current_user.user_id))
    if status:
        try:
            q = q.where(Alert.status == AlertStatus(status))
        except ValueError:
            pass
    q = q.order_by(Alert.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [AlertResponse.from_orm(a) for a in rows]


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    alert = (await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == UUID(current_user.user_id))
    )).scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alert not found")

    allowed = {"label", "threshold", "status", "repeat_count"}
    for k, v in body.items():
        if k in allowed:
            if k == "status":
                try:
                    setattr(alert, k, AlertStatus(v))
                except ValueError:
                    pass
            elif k == "threshold":
                alert.threshold = Decimal(str(v))
            else:
                setattr(alert, k, v)
    await db.flush()
    await db.refresh(alert)
    await db.commit()
    return AlertResponse.from_orm(alert)


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    alert = (await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == UUID(current_user.user_id))
    )).scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.DELETED
    await db.commit()


@router.post("/evaluate")
async def evaluate_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(_auth),
):
    """
    Evaluate all active alerts for this user against live prices from broker-service.
    Call this periodically (e.g., every minute from the frontend via setInterval).
    """
    active = (await db.execute(
        select(Alert).where(
            Alert.user_id == UUID(current_user.user_id),
            Alert.status == AlertStatus.ACTIVE,
        )
    )).scalars().all()

    if not active:
        return {"evaluated": 0, "triggered": 0}

    # Fetch live prices for all symbols in one batch
    symbols = list({a.symbol for a in active if a.symbol})
    prices: dict[str, float] = {}
    if symbols:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{settings.BROKER_SERVICE_URL}/api/v1/market/quotes",
                    json={"symbols": symbols},
                    headers={"Authorization": f"Bearer _internal_"},
                )
            if resp.status_code == 200:
                for item in resp.json().get("quotes", []):
                    prices[item["symbol"]] = float(item.get("ltp", 0))
        except Exception:
            pass

    triggered_count = 0
    now = datetime.now(timezone.utc)

    for alert in active:
        fired = False
        price = prices.get(alert.symbol, 0) if alert.symbol else 0
        thresh = float(alert.threshold)

        if alert.condition == AlertCondition.PRICE_ABOVE and alert.symbol:
            fired = price > thresh
        elif alert.condition == AlertCondition.PRICE_BELOW and alert.symbol:
            fired = 0 < price < thresh
        elif alert.condition == AlertCondition.CHANGE_PCT_UP and alert.symbol:
            # ltp > threshold % gain — approximated from price level
            fired = price > thresh
        elif alert.condition == AlertCondition.CHANGE_PCT_DN and alert.symbol:
            fired = 0 < price < thresh

        if not fired:
            continue

        # Fire: create notification + send via WebSocket
        title = f"Alert: {alert.symbol or 'Portfolio'}"
        msg = f"{alert.label or alert.condition.value} — threshold {thresh}, current {price:.2f}"

        notif = Notification(
            user_id=UUID(current_user.user_id),
            type=NotificationType.SYSTEM,
            title=title,
            message=msg,
        )
        db.add(notif)

        alert.fired_count += 1
        alert.triggered_at = now

        max_fires = alert.repeat_count
        if max_fires is not None and alert.fired_count >= max_fires:
            alert.status = AlertStatus.TRIGGERED

        # Push via WebSocket (best effort)
        try:
            await manager.send_to_user(current_user.user_id, {
                "type": "ALERT_TRIGGERED",
                "title": title,
                "message": msg,
            })
        except Exception:
            pass

        triggered_count += 1

    await db.commit()
    return {"evaluated": len(active), "triggered": triggered_count}
