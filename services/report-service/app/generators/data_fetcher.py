"""
Fetches report data from other microservices.
Each function returns the raw data dict that generators consume.
"""
import httpx
from app.config import settings

async def _get(url: str, token: str) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()

async def _get_safe(url: str, token: str, default=None):
    try:
        return await _get(url, token)
    except Exception:
        return default or {}

async def fetch_portfolio_data(token: str) -> dict:
    summary  = await _get_safe(f"{settings.PORTFOLIO_SERVICE_URL}/api/v1/portfolio/summary", token, {})
    holdings_resp = await _get_safe(f"{settings.PORTFOLIO_SERVICE_URL}/api/v1/portfolio/holdings", token, {})
    history  = await _get_safe(f"{settings.PORTFOLIO_SERVICE_URL}/api/v1/portfolio/history?period=1y", token, [])

    # Normalise holdings — service may return list or dict with items key
    holdings = holdings_resp if isinstance(holdings_resp, list) else holdings_resp.get("items", holdings_resp.get("holdings", []))
    if isinstance(history, dict):
        history = history.get("history", history.get("items", []))

    return {"summary": summary, "holdings": holdings, "history": history}

async def fetch_order_data(token: str, date_from: str = "", date_to: str = "") -> dict:
    params = "?size=500"
    if date_from: params += f"&date_from={date_from}T00:00:00"
    if date_to:   params += f"&date_to={date_to}T23:59:59"
    resp = await _get_safe(f"{settings.ORDER_SERVICE_URL}/api/v1/orders{params}", token, {})
    orders = resp.get("items", []) if isinstance(resp, dict) else resp
    return {"orders": orders}

async def fetch_client_data(token: str) -> dict:
    resp = await _get_safe(f"{settings.CLIENT_SERVICE_URL}/api/v1/clients?size=100", token, {})
    clients_list = resp.get("items", []) if isinstance(resp, dict) else resp

    # For each client fetch holdings (best effort, skip on error)
    enriched = []
    for c in clients_list[:20]:
        client_id = c.get("id")
        holdings = []
        if client_id:
            h_resp = await _get_safe(
                f"{settings.PORTFOLIO_SERVICE_URL}/api/v1/portfolio/holdings?client_id={client_id}",
                token, {}
            )
            if isinstance(h_resp, dict):
                holdings = h_resp.get("items", h_resp.get("holdings", []))
            elif isinstance(h_resp, list):
                holdings = h_resp
        enriched.append({**c, "holdings": holdings})

    return {"clients": enriched}
