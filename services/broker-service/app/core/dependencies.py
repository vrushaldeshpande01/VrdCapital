from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings

bearer = HTTPBearer()
settings = get_settings()


@dataclass
class CurrentUser:
    user_id: UUID
    username: str
    role: str
    is_admin: bool


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    token = credentials.credentials
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Auth service unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    data = resp.json()
    return CurrentUser(
        user_id=UUID(data["id"]),
        username=data["username"],
        role=data["role"],
        is_admin=data.get("role") == "admin",
    )


def require_portfolio_manager():
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in ("admin", "portfolio_manager"):
            raise HTTPException(status_code=403, detail="Portfolio manager access required")
        return user
    return _check
