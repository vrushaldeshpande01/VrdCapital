"""
Sync engine: pulls holdings/positions from broker and pushes to portfolio-service.
"""
import time
from datetime import datetime, timezone
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.broker import BrokerCredential, SyncLog, SyncStatus, SyncType
from app.services.adapter_factory import get_adapter

logger = structlog.get_logger()
settings = get_settings()


async def sync_client_holdings(
    client_id: UUID,
    db: AsyncSession,
    auth_token: str,
    credential_ids: list[UUID] | None = None,
) -> dict:
    """
    Sync holdings for all active credentials of a client.
    Returns a summary dict.
    """
    started = time.time()
    errors = []
    total_holdings = 0
    credentials_synced = 0

    query = select(BrokerCredential).where(
        BrokerCredential.client_id == client_id,
        BrokerCredential.is_active == True,
    )
    if credential_ids:
        query = query.where(BrokerCredential.id.in_(credential_ids))

    result = await db.execute(query)
    credentials = result.scalars().all()

    if not credentials:
        return {
            "client_id": str(client_id),
            "credentials_synced": 0,
            "holdings_synced": 0,
            "prices_updated": 0,
            "errors": ["No active broker credentials found"],
            "duration_seconds": 0,
        }

    for cred in credentials:
        log = SyncLog(
            credential_id=cred.id,
            client_id=client_id,
            broker=cred.broker.value,
            sync_type=SyncType.HOLDINGS,
            status=SyncStatus.RUNNING,
        )
        db.add(log)
        await db.flush()

        try:
            adapter = get_adapter(cred)
            holdings = await adapter.get_holdings()
            funds = await adapter.get_funds()

            # Replace semantics: clear existing holdings before inserting fresh data
            # so stale positions (sold stocks) are removed automatically
            await _clear_broker_holdings(broker_account_id=cred.id, auth_token=auth_token)

            synced = await _push_holdings_to_portfolio(
                client_id=client_id,
                broker_account_id=cred.id,
                holdings=holdings,
                funds=funds,
                auth_token=auth_token,
            )
            total_holdings += synced

            # Update credential sync state
            cred.last_sync_at = datetime.now(timezone.utc)
            cred.last_sync_status = "success"
            cred.total_syncs = (cred.total_syncs or 0) + 1

            log.status = SyncStatus.SUCCESS
            log.records_synced = synced
            log.completed_at = datetime.now(timezone.utc)
            credentials_synced += 1

            logger.info("sync_complete", client_id=str(client_id), broker=cred.broker.value, holdings=synced)

        except Exception as e:
            err_msg = str(e)
            errors.append(f"{cred.broker.value}: {err_msg}")
            cred.last_sync_status = "failed"
            log.status = SyncStatus.FAILED
            log.error_message = err_msg
            log.completed_at = datetime.now(timezone.utc)
            logger.error("sync_failed", client_id=str(client_id), broker=cred.broker.value, error=err_msg)

    await db.flush()

    # Sync prices for all symbols after holdings are updated
    prices_updated = await _sync_prices_for_client(client_id, credentials, auth_token)

    return {
        "client_id": str(client_id),
        "credentials_synced": credentials_synced,
        "holdings_synced": total_holdings,
        "prices_updated": prices_updated,
        "errors": errors,
        "duration_seconds": round(time.time() - started, 2),
    }


async def _clear_broker_holdings(broker_account_id: UUID, auth_token: str) -> None:
    """Delete all active holdings for a broker account before re-importing."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0, base_url=settings.PORTFOLIO_SERVICE_URL) as client:
            await client.delete(f"/api/v1/holdings/by-broker/{broker_account_id}", headers=headers)
    except Exception as e:
        logger.warning("clear_broker_holdings_failed", broker_account_id=str(broker_account_id), error=str(e))


async def _push_holdings_to_portfolio(
    client_id: UUID,
    broker_account_id: UUID,
    holdings,
    funds,
    auth_token: str,
) -> int:
    """POST each holding to portfolio-service for upsert."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    synced = 0

    async with httpx.AsyncClient(timeout=15.0, base_url=settings.PORTFOLIO_SERVICE_URL) as client:
        # Update holdings
        for h in holdings:
            payload = {
                "client_id": str(client_id),
                "broker_account_id": str(broker_account_id),
                "symbol": h.symbol,
                "name": h.name,
                "exchange": h.exchange,
                "sector": h.sector or "",
                "quantity": h.quantity,
                "average_buy_price": h.average_buy_price,
                "current_price": h.current_price,
                "previous_close": h.previous_close,
                "isin": h.isin or "",
            }
            resp = await client.post("/api/v1/holdings", json=payload, headers=headers)
            if resp.status_code in (200, 201):
                synced += 1
            else:
                logger.warning("holding_push_failed", symbol=h.symbol, status=resp.status_code)

        # Update cash balance
        cash_payload = {
            "client_id": str(client_id),
            "broker_account_id": str(broker_account_id),
            "available_cash": funds.available_cash,
            "used_margin": funds.used_margin,
            "total_balance": funds.total_balance,
        }
        await client.post("/api/v1/portfolio/cash", json=cash_payload, headers=headers)

    return synced


async def _sync_prices_for_client(client_id: UUID, credentials, auth_token: str) -> int:
    """Fetch latest prices from first available adapter and update all holdings."""
    if not credentials:
        return 0

    # Use first active credential's adapter to fetch prices
    try:
        cred = credentials[0]
        adapter = get_adapter(cred)
        headers = {"Authorization": f"Bearer {auth_token}"}

        # Get all symbols for this client from portfolio-service
        async with httpx.AsyncClient(timeout=10.0, base_url=settings.PORTFOLIO_SERVICE_URL) as client:
            resp = await client.get(
                "/api/v1/holdings",
                params={"client_id": str(client_id)},
                headers=headers,
            )
            if resp.status_code != 200:
                return 0
            holdings_data = resp.json()

        symbols = list({h["symbol"] for h in holdings_data})
        if not symbols:
            return 0

        quotes = await adapter.get_quotes(symbols)

        # Update prices in portfolio-service
        updated = 0
        async with httpx.AsyncClient(timeout=15.0, base_url=settings.PORTFOLIO_SERVICE_URL) as client:
            for holding in holdings_data:
                sym = holding["symbol"]
                if sym in quotes:
                    q = quotes[sym]
                    resp = await client.patch(
                        f"/api/v1/holdings/{holding['id']}/price",
                        json={
                            "current_price": q.ltp,
                            "previous_close": q.prev_close,
                        },
                        headers=headers,
                    )
                    if resp.status_code == 200:
                        updated += 1

        return updated
    except Exception as e:
        logger.error("price_sync_failed", error=str(e))
        return 0
