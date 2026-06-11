import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.models.user import User, RefreshToken, AuditLog, UserStatus
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserTokenInfo,
    RefreshTokenRequest, ChangePasswordRequest
)
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    hash_token, hash_password, get_refresh_token_expiry
)
from app.core.dependencies import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


async def create_audit_log(
    db: AsyncSession,
    user_id: UUID | None,
    action: str,
    resource: str = None,
    details: str = None,
    ip_address: str = None,
    status: str = "success",
    error_message: str = None,
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
        status=status,
        error_message=error_message,
    )
    db.add(log)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    ip_address = request.client.host

    # Find user by email or username
    result = await db.execute(
        select(User).where(
            (User.email == body.username) | (User.username == body.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            await db.flush()
        await create_audit_log(
            db, user.id if user else None, "login",
            ip_address=ip_address, status="failure",
            error_message="Invalid credentials"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value}. Contact administrator.",
        )

    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    user.last_login_ip = ip_address

    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value, "email": user.email}
    )
    raw_refresh_token = create_refresh_token()
    token_hash = hash_token(raw_refresh_token)

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        ip_address=ip_address,
        expires_at=get_refresh_token_expiry(),
    )
    db.add(refresh_token_record)

    await create_audit_log(db, user.id, "login", ip_address=ip_address)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserTokenInfo(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            is_superuser=user.is_superuser,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    token_hash = hash_token(body.refresh_token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record or token_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(select(User).where(User.id == token_record.user_id))
    user = result.scalar_one_or_none()

    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate refresh token
    token_record.revoked = True
    token_record.revoked_at = datetime.now(timezone.utc)

    new_access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value, "email": user.email}
    )
    new_raw_refresh = create_refresh_token()
    new_hash = hash_token(new_raw_refresh)

    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        ip_address=request.client.host,
        expires_at=get_refresh_token_expiry(),
    )
    db.add(new_token_record)
    await db.flush()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserTokenInfo(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            is_superuser=user.is_superuser,
        ),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    body: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token_record = result.scalar_one_or_none()
    if token_record:
        token_record.revoked = True
        token_record.revoked_at = datetime.now(timezone.utc)

    await create_audit_log(db, current_user.id, "logout", ip_address=request.client.host)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(body.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)


@router.get("/me", response_model=UserTokenInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserTokenInfo(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        is_superuser=current_user.is_superuser,
    )
