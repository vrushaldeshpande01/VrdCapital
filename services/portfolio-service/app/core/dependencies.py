from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import get_settings

settings = get_settings()
security = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: UUID, role: str, email: str):
        self.user_id = user_id
        self.role = role
        self.email = email

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_portfolio_manager(self) -> bool:
        return self.role in ("admin", "portfolio_manager")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        email: str = payload.get("email", "")
        if not user_id or not role:
            raise exc
    except JWTError:
        raise exc
    return CurrentUser(user_id=UUID(user_id), role=role, email=email)


def require_portfolio_manager():
    async def check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.is_portfolio_manager:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return check
