import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog

from app.database import engine, Base
from app.routes import orders, baskets

REQUEST_COUNT    = Counter("http_requests_total",            "Total HTTP requests",  ["method", "endpoint", "status", "service"])
REQUEST_DURATION = Histogram("http_request_duration_seconds","HTTP request duration", ["service"])

structlog.configure(processors=[
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.stdlib.add_log_level,
    structlog.processors.JSONRenderer(),
])
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS orders"))
        await conn.run_sync(Base.metadata.create_all)
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


app.include_router(orders.router, prefix="/api/v1")
app.include_router(baskets.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "order-service"}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
