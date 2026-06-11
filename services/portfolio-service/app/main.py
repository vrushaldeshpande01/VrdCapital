import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings
from app.database import engine, Base
from app.routes import holdings, positions, portfolio

settings = get_settings()

REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("http_request_duration_seconds", "HTTP request duration")

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
    logger.info("portfolio_service_starting", environment=settings.ENVIRONMENT)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_demo_data()
    logger.info("portfolio_service_started")
    yield
    await engine.dispose()


async def _seed_demo_data():
    """Seed realistic demo holdings so the dashboard shows real data on first boot."""
    from sqlalchemy import select, func
    from app.database import AsyncSessionLocal
    from app.models.portfolio import Holding, CashBalance, HoldingStatus
    import uuid

    DEMO_CLIENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
    DEMO_BROKER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(func.count()).select_from(Holding).where(Holding.client_id == DEMO_CLIENT_ID)
        )
        if result.scalar() > 0:
            return

        demo_holdings = [
            {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy", "quantity": 50, "avg": 2350.50, "current": 2485.60, "prev": 2460.00},
            {"symbol": "TCS", "name": "Tata Consultancy Services", "sector": "Technology", "quantity": 25, "avg": 3200.00, "current": 3892.40, "prev": 3850.00},
            {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "sector": "Finance", "quantity": 80, "avg": 1550.00, "current": 1672.80, "prev": 1650.00},
            {"symbol": "INFY", "name": "Infosys Ltd", "sector": "Technology", "quantity": 100, "avg": 1400.00, "current": 1458.20, "prev": 1440.00},
            {"symbol": "WIPRO", "name": "Wipro Ltd", "sector": "Technology", "quantity": 150, "avg": 420.00, "current": 485.60, "prev": 480.00},
            {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "sector": "Finance", "quantity": 120, "avg": 900.00, "current": 1045.30, "prev": 1030.00},
            {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "sector": "FMCG", "quantity": 40, "avg": 2400.00, "current": 2620.50, "prev": 2590.00},
            {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical", "sector": "Healthcare", "quantity": 60, "avg": 1100.00, "current": 1285.70, "prev": 1260.00},
            {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "sector": "Finance", "quantity": 20, "avg": 6200.00, "current": 6890.40, "prev": 6750.00},
            {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "sector": "Finance", "quantity": 35, "avg": 1700.00, "current": 1842.60, "prev": 1820.00},
        ]

        for d in demo_holdings:
            h = Holding(
                client_id=DEMO_CLIENT_ID,
                broker_account_id=DEMO_BROKER_ID,
                symbol=d["symbol"],
                name=d["name"],
                sector=d["sector"],
                quantity=d["quantity"],
                average_buy_price=d["avg"],
                current_price=d["current"],
                previous_close=d["prev"],
                status=HoldingStatus.ACTIVE,
            )
            h.recalculate()
            db.add(h)

        cash = CashBalance(
            client_id=DEMO_CLIENT_ID,
            broker_account_id=DEMO_BROKER_ID,
            available_cash=250000,
            used_margin=0,
            total_balance=250000,
        )
        db.add(cash)
        await db.commit()
        logger.info("demo_data_seeded", client_id=str(DEMO_CLIENT_ID))


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Portfolio Management Service — Holdings, Positions, P&L, AUM",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    redirect_slashes=False,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=response.status_code).inc()
    REQUEST_DURATION.observe(duration)
    logger.info("request", method=request.method, path=request.url.path,
                status=response.status_code, duration_ms=round(duration * 1000, 2))
    return response


app.include_router(holdings.router, prefix="/api/v1")
app.include_router(positions.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")


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
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/live", tags=["Health"])
async def live():
    return {"status": "alive", "service": settings.SERVICE_NAME}


@app.get("/metrics", tags=["Metrics"])
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
