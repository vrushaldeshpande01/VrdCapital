from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import HTTPException

from app.config import settings


@dataclass
class CurrentUser:
    user_id: str
    email: str
    role: str
    is_admin: bool


async def get_current_user(authorization: str = "") -> CurrentUser:
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            f"{settings.AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    data = r.json()
    return CurrentUser(
        user_id=data["id"],
        email=data["email"],
        role=data.get("role", "viewer"),
        is_admin=data.get("role") == "admin",
    )
