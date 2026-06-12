"""
Upstox V2 API adapter.

Sandbox mode: returns realistic mock data — no API keys needed.
Live mode:    calls the Upstox V2 REST API using access_token (OAuth2).

To switch to live:
  1. Set is_sandbox=False on the credential
  2. Complete OAuth2 flow: redirect to auth URL → capture auth_code → exchange for access_token
  3. Store access_token (valid for one trading day, refresh daily)
  4. Upstox API docs: https://upstox.com/developer/api-documentation/
"""
from typing import Optional
import httpx

from app.adapters.base import BrokerAdapter, HoldingData, PositionData, FundsData, QuoteData, ProfileData
from app.adapters.mock_data import get_mock_holdings, get_mock_quotes

UPSTOX_BASE = "https://api.upstox.com/v2"


class UpstoxAdapter(BrokerAdapter):

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    async def test_connection(self) -> tuple[bool, str, Optional[ProfileData]]:
        if self.is_sandbox:
            return True, "Sandbox mode active — mock data will be used", ProfileData(
                broker="upstox",
                account_id=self.api_key or "SANDBOX",
                client_name="Sandbox User",
                email="sandbox@upstox.com",
                exchanges=["NSE", "BSE", "NFO"],
            )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{UPSTOX_BASE}/profile", headers=self._headers())
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return True, "Connected successfully", ProfileData(
                    broker="upstox",
                    account_id=data.get("user_id", ""),
                    client_name=data.get("user_name", ""),
                    email=data.get("email", ""),
                    exchanges=data.get("exchanges", []),
                )
            return False, f"Authentication failed: {resp.status_code}", None
        except Exception as e:
            return False, f"Connection error: {str(e)}", None

    async def get_holdings(self) -> list[HoldingData]:
        if self.is_sandbox:
            return get_mock_holdings(self.api_key or "upstox_sandbox")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{UPSTOX_BASE}/portfolio/long-term-holdings", headers=self._headers())
        resp.raise_for_status()
        holdings = []
        for h in resp.json().get("data", []):
            holdings.append(HoldingData(
                symbol=h["tradingsymbol"],
                name=h.get("company_name", h["tradingsymbol"]),
                exchange=h.get("exchange", "NSE"),
                sector="",
                quantity=float(h["quantity"]),
                average_buy_price=float(h["average_price"]),
                current_price=float(h["last_price"]),
                previous_close=float(h.get("close_price", h["last_price"])),
                isin=h.get("isin"),
            ))
        return holdings

    async def get_positions(self) -> list[PositionData]:
        if self.is_sandbox:
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{UPSTOX_BASE}/portfolio/short-term-positions", headers=self._headers())
        resp.raise_for_status()
        return []

    async def get_funds(self) -> FundsData:
        if self.is_sandbox:
            return FundsData(available_cash=500000.0, used_margin=0.0, total_balance=500000.0)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{UPSTOX_BASE}/user/fund-and-margin", headers=self._headers())
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("equity", {})
        return FundsData(
            available_cash=float(data.get("available_margin", 0)),
            used_margin=float(data.get("used_margin", 0)),
            total_balance=float(data.get("notional_cash", 0)),
        )

    async def get_quotes(self, symbols: list[str]) -> dict[str, QuoteData]:
        if self.is_sandbox:
            return get_mock_quotes(symbols)
        instrument_keys = [f"NSE_EQ|{s}" for s in symbols]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{UPSTOX_BASE}/market-quote/quotes",
                params={"instrument_key": ",".join(instrument_keys)},
                headers=self._headers(),
            )
        resp.raise_for_status()
        result = {}
        for key, q in resp.json().get("data", {}).items():
            sym = key.split("|")[-1]
            result[sym] = QuoteData(
                symbol=sym, exchange="NSE",
                ltp=float(q.get("last_price", 0)),
                open_price=float(q.get("open_price", 0)),
                high_price=float(q.get("high_price", 0)),
                low_price=float(q.get("low_price", 0)),
                prev_close=float(q.get("prev_close_price", 0)),
                change=float(q.get("net_change", 0)),
                change_pct=float(q.get("percent_change", 0)),
                volume=int(q.get("volume", 0)),
            )
        return result
