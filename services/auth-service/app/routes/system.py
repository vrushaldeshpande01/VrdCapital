"""
System health aggregator — checks all microservices in parallel.
Used by the frontend Observability page.
"""
import asyncio
import time
from fastapi import APIRouter
import httpx

router = APIRouter(prefix="/system", tags=["System"])

SERVICES = [
    {"name": "auth-service",          "url": "http://auth-service:8000/health"},
    {"name": "client-service",        "url": "http://client-service:8000/health"},
    {"name": "portfolio-service",     "url": "http://portfolio-service:8000/health"},
    {"name": "broker-service",        "url": "http://broker-service:8000/health"},
    {"name": "order-service",         "url": "http://order-service:8000/health"},
    {"name": "notification-service",  "url": "http://notification-service:8000/health"},
    {"name": "report-service",        "url": "http://report-service:8000/health"},
]

async def _probe(client: httpx.AsyncClient, svc: dict) -> dict:
    start = time.time()
    try:
        r = await client.get(svc["url"], timeout=3.0)
        latency_ms = round((time.time() - start) * 1000)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        return {
            "name": svc["name"],
            "status": "healthy" if r.status_code == 200 else "degraded",
            "latency_ms": latency_ms,
            "details": body,
        }
    except Exception as e:
        return {
            "name": svc["name"],
            "status": "unreachable",
            "latency_ms": None,
            "details": {"error": str(e)},
        }

@router.get("/health")
async def system_health():
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_probe(client, svc) for svc in SERVICES])

    healthy   = sum(1 for r in results if r["status"] == "healthy")
    degraded  = sum(1 for r in results if r["status"] == "degraded")
    unreachable = sum(1 for r in results if r["status"] == "unreachable")

    overall = "healthy" if unreachable == 0 and degraded == 0 else \
              "degraded" if healthy > 0 else "down"

    return {
        "overall": overall,
        "services": list(results),
        "summary": {"healthy": healthy, "degraded": degraded, "unreachable": unreachable},
    }
