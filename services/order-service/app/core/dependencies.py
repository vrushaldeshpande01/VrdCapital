from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx

from app.config import settings

bearer = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, email: str, role: str, is_admin: bool):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.is_admin = is_admin


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    token = credentials.credentials
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                f"{settings.AUTH_SERVICE_URL}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0,
            )
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Auth service unavailable")

    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    data = r.json()
    return CurrentUser(
        user_id=data["id"],
        email=data["email"],
        role=data["role"],
        is_admin=data.get("role") == "admin" or data.get("is_superuser", False),
    )


def require_portfolio_manager():
    async def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in ("admin", "portfolio_manager"):
            raise HTTPException(status_code=403, detail="Portfolio manager access required")
        return user
    return _dep
