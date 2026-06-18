"""
Zerodha Kite Connect OAuth flow.

How it works:
  1. Frontend calls GET /api/v1/broker/zerodha/login?credential_id=<uuid>&client_id=<uuid>
     → marks the credential as oauth_state='pending' in DB
     → returns the Kite login URL

  2. User logs in on kite.zerodha.com
     → Zerodha redirects to the registered callback URL with:
        ?action=login&type=login&status=success&request_token=<token>
     NOTE: Zerodha does NOT pass back credential_id — we look it up by oauth_state='pending'

  3. GET /api/v1/broker/zerodha/callback?request_token=<token>&status=success
     → finds the pending credential from DB
     → exchanges request_token for access_token (SHA-256 checksum)
     → stores encrypted access_token
     → redirects user back to the client detail page
"""
import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.dependencies import get_current_user, CurrentUser
from app.core.encryption import encrypt
from app.database import get_db
from app.models.broker import BrokerCredential

router = APIRouter(prefix="/broker/zerodha", tags=["Zerodha OAuth"])
settings = get_settings()

KITE_LOGIN_URL = "https://kite.zerodha.com/connect/login"
KITE_TOKEN_URL = "https://api.kite.trade/session/token"


def _checksum(api_key: str, request_token: str, api_secret: str) -> str:
    """Kite requires SHA-256(api_key + request_token + api_secret)."""
    return hashlib.sha256(f"{api_key}{request_token}{api_secret}".encode()).hexdigest()


@router.get("/login")
async def zerodha_login(
    credential_id: UUID = Query(...),
    client_id: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark credential as pending and return the Kite login URL."""
    api_key = settings.ZERODHA_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="ZERODHA_API_KEY not configured on server")

    result = await db.execute(select(BrokerCredential).where(BrokerCredential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Mark as pending so the callback can find it (Zerodha doesn't pass back credential_id)
    cred.oauth_state = "pending"
    cred.oauth_initiated_at = datetime.now(timezone.utc)
    await db.commit()

    login_url = f"{KITE_LOGIN_URL}?api_key={api_key}&v=3"
    return {"login_url": login_url, "credential_id": str(credential_id), "client_id": client_id}


@router.get("/callback")
async def zerodha_callback(
    request_token: str = Query(...),
    status: str = Query("success"),
    action: str = Query("login"),
    db: AsyncSession = Depends(get_db),
):
    """
    Zerodha redirects here after login. credential_id is NOT passed by Zerodha —
    we find the pending credential from the DB instead.
    """
    if status != "success":
        return RedirectResponse(url="/dashboard?error=zerodha_login_failed")

    api_key = settings.ZERODHA_API_KEY
    api_secret = settings.ZERODHA_API_SECRET
    if not api_key or not api_secret:
        return RedirectResponse(url="/dashboard?error=zerodha_not_configured")

    # Find the credential that initiated OAuth in the last 10 minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    result = await db.execute(
        select(BrokerCredential).where(
            and_(
                BrokerCredential.oauth_state == "pending",
                BrokerCredential.oauth_initiated_at >= cutoff,
            )
        ).order_by(BrokerCredential.oauth_initiated_at.desc())
    )
    cred = result.scalars().first()
    if not cred:
        return RedirectResponse(url="/dashboard?error=no_pending_oauth_session")

    # Exchange request_token → access_token
    checksum = _checksum(api_key, request_token, api_secret)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                KITE_TOKEN_URL,
                data={"api_key": api_key, "request_token": request_token, "checksum": checksum},
                headers={"X-Kite-Version": "3"},
            )
        if resp.status_code != 200:
            cred.oauth_state = None
            await db.commit()
            return RedirectResponse(url=f"/clients/{cred.client_id}?error=token_exchange_failed")

        data = resp.json().get("data", {})
        access_token = data.get("access_token")
        if not access_token:
            cred.oauth_state = None
            await db.commit()
            return RedirectResponse(url=f"/clients/{cred.client_id}?error=no_access_token")

    except Exception:
        cred.oauth_state = None
        await db.commit()
        return RedirectResponse(url=f"/clients/{cred.client_id}?error=token_exchange_error")

    # Persist encrypted access_token and clear pending state
    cred.access_token_encrypted = encrypt(access_token)
    cred.token_expiry = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)
    cred.is_active = True
    cred.oauth_state = None
    cred.oauth_initiated_at = None
    await db.commit()

    return RedirectResponse(url=f"/clients/{cred.client_id}?zerodha=connected")


@router.post("/revoke/{credential_id}")
async def zerodha_revoke(
    credential_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Invalidate the stored access_token (logout from Kite)."""
    result = await db.execute(select(BrokerCredential).where(BrokerCredential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    api_key = settings.ZERODHA_API_KEY
    if api_key and cred.access_token_encrypted:
        from app.core.encryption import decrypt
        try:
            access_token = decrypt(cred.access_token_encrypted)
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"https://api.kite.trade/session/token?api_key={api_key}&access_token={access_token}",
                    headers={"X-Kite-Version": "3", "Authorization": f"token {api_key}:{access_token}"},
                )
        except Exception:
            pass

    cred.access_token_encrypted = None
    cred.token_expiry = None
    cred.is_active = False
    cred.oauth_state = None
    await db.commit()
    return {"message": "Access token revoked"}
