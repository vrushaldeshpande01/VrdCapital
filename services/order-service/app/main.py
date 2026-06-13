import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog

from app.database import engine, Base
from app.routes import orders, baskets
from app.routes import instruments, trades, funds, trading_positions, trading_holdings

# Import all models so create_all picks them up
import app.models.order        # noqa: F401
import app.models.instrument   # noqa: F401
import app.models.trade        # noqa: F401
import app.models.fund         # noqa: F401

from app.services.seed import seed_instruments
from app.database import AsyncSessionLocal

REQUEST_COUNT    = Counter("http_requests_total",            "Total HTTP requests",  ["method", "endpoint", "status", "service"])
REQUEST_DURATION = Histogram("http_request_duration_seconds","HTTP request duration", ["service"])

structlog.configure(processors=[
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.stdlib.add_log_level,
    structlog.processors.JSONRenderer(),
])
logger = structlog.get_logger()

_MIGRATION_SQL = """
ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS instrument_id UUID,
    ADD COLUMN IF NOT EXISTS product_type  VARCHAR(10) DEFAULT 'CNC',
    ADD COLUMN IF NOT EXISTS validity      VARCHAR(10) DEFAULT 'DAY',
    ADD COLUMN IF NOT EXISTS tag           VARCHAR(100);
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS orders"))
        # Add new columns to existing orders table before create_all
        await conn.execute(text(_MIGRATION_SQL))
        await conn.run_sync(Base.metadata.create_all)

    # Seed reference data
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await seed_instruments(session)

    yield


app = FastAPI(
    title="VrdCapital Order Service",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    endpoint = request.url.path.split("?")[0]
    REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=response.status_code, service="order-service").inc()
    REQUEST_DURATION.labels(service="order-service").observe(duration)
    return response


app.include_router(orders.router,             prefix="/api/v1")
app.include_router(baskets.router,            prefix="/api/v1")
app.include_router(instruments.router,        prefix="/api/v1")
app.include_router(trades.router,             prefix="/api/v1")
app.include_router(funds.router,              prefix="/api/v1")
app.include_router(trading_positions.router,  prefix="/api/v1")
app.include_router(trading_holdings.router,   prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "order-service"}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
