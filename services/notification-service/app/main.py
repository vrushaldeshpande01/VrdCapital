import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

from app.database import engine, Base
from app.routes.notifications import router
from app.routes.alerts import router as alerts_router
from app.models import alert as _alert_model  # ensure table is registered in Base.metadata
from app.services.consumer import start_consumer
from app.services.market_subscriber import start_market_subscriber

logging.basicConfig(level=logging.INFO)

REQUEST_COUNT      = Counter("http_requests_total",            "Total HTTP requests",       ["method", "endpoint", "status", "service"])
REQUEST_DURATION   = Histogram("http_request_duration_seconds","HTTP request duration",      ["service"])
NOTIFICATIONS_SENT = Counter("notifications_sent_total",       "Total notifications sent",  ["notif_type"])
WS_CONNECTIONS     = Gauge("websocket_connections_active",     "Active WebSocket connections",["service"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS notifications"))
        await conn.run_sync(Base.metadata.create_all)

    from app.config import settings as _cfg
    # Start background tasks
    consumer_task = asyncio.create_task(start_consumer())
    market_task = asyncio.create_task(start_market_subscriber(_cfg.REDIS_URL))
    app.state.consumer_task = consumer_task
    app.state.market_task = market_task

    yield

    for t in (consumer_task, market_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    await engine.dispose()


app = FastAPI(
    title="VrdCapital Notification Service",
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
    REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=response.status_code, service="notification-service").inc()
    REQUEST_DURATION.labels(service="notification-service").observe(duration)
    return response


app.include_router(router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health")
async def health():
    from app.services.connection_manager import manager
    return {
        "status": "ok",
        "service": "notification-service",
        "connected_ws_users": manager.connected_users,
    }
