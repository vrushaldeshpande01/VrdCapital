import logging
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings
from app.database import engine, Base
from app.routes import auth, users, system

settings = get_settings()

# Metrics
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("http_request_duration_seconds", "HTTP request duration")

# Structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("auth_service_starting", environment=settings.ENVIRONMENT)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_admin_user()
    logger.info("auth_service_started")
    yield
    logger.info("auth_service_stopping")
    await engine.dispose()


async def seed_admin_user():
    """Create default admin user on first boot."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import AsyncSessionLocal
    from app.models.user import User, UserRole, UserStatus
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.is_superuser == True))
        if result.scalar_one_or_none():
            return

        admin = User(
            email="admin@vrdcapital.com",
            username="admin",
            hashed_password=hash_password("Admin@123456"),
            first_name="System",
            last_name="Admin",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
            is_superuser=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("default_admin_created", email="admin@vrdcapital.com")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Authentication & User Management Service for VrdCapital PMS",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    redirect_slashes=False,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()
    REQUEST_DURATION.observe(duration)

    logger.info(
        "request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )
    return response


# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")


# Health endpoints (required for K8s)
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "service": settings.SERVICE_NAME, "version": settings.VERSION}


@app.get("/ready", tags=["Health"])
async def ready():
    try:
        from app.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ready", "service": settings.SERVICE_NAME}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Service not ready: {str(e)}")


@app.get("/live", tags=["Health"])
async def live():
    return {"status": "alive", "service": settings.SERVICE_NAME}


@app.get("/metrics", tags=["Metrics"])
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
