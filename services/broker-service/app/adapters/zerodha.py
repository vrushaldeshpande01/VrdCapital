"""
Zerodha (KiteConnect) adapter.

Sandbox mode: returns realistic mock data — no API keys needed.
Live mode:    calls the KiteConnect REST API using api_key + access_token.
              access_token is obtained via the Kite login flow (separate OAuth step).

To switch to live:
  1. Set is_sandbox=False on the credential
  2. Store api_key and access_token (obtained via KiteConnect login URL flow)
  3. The adapter will call https://api.kite.trade/ with real data
"""
from typing import Optional
import httpx

from app.adapters.base import BrokerAdapter, HoldingData, PositionData, FundsData, QuoteData, ProfileData
from app.adapters.mock_data import get_mock_holdings, get_mock_quotes

KITE_BASE = "https://api.kite.trade"


class ZerodhaAdapter(BrokerAdapter):

    def _headers(self) -> dict:
        return {
            "X-Kite-Version": "3",
            "Authorization": f"token {self.api_key}:{self.access_token}",
        }

    async def test_connection(self) -> tuple[bool, str, Optional[ProfileData]]:
        if self.is_sandbox:
            return True, "Sandbox mode active — mock data will be used", ProfileData(
                broker="zerodha",
                account_id=self.api_key or "SANDBOX",
                client_name="Sandbox User",
                email="sandbox@zerodha.com",
                exchanges=["NSE", "BSE", "NFO"],
            )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{KITE_BASE}/user/profile", headers=self._headers())
            if resp.status_code == 200:
                data = resp.json()["data"]
                return True, "Connected successfully", ProfileData(
                    broker="zerodha",
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
            return get_mock_holdings(self.api_key or "zerodha_sandbox")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{KITE_BASE}/portfolio/holdings", headers=self._headers())
        resp.raise_for_status()
        holdings = []
        for h in resp.json().get("data", []):
            holdings.append(HoldingData(
                symbol=h["tradingsymbol"],
                name=h["tradingsymbol"],
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
            resp = await client.get(f"{KITE_BASE}/portfolio/positions", headers=self._headers())
        resp.raise_for_status()
        return []  # Parse positions similar to holdings if needed

    async def get_funds(self) -> FundsData:
        if self.is_sandbox:
            return FundsData(available_cash=500000.0, used_margin=0.0, total_balance=500000.0)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{KITE_BASE}/user/margins", headers=self._headers())
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("equity", {})
        return FundsData(
            available_cash=float(data.get("available", {}).get("cash", 0)),
            used_margin=float(data.get("utilised", {}).get("debits", 0)),
            total_balance=float(data.get("net", 0)),
        )

    async def get_quotes(self, symbols: list[str]) -> dict[str, QuoteData]:
        if self.is_sandbox:
            return get_mock_quotes(symbols)
        instruments = [f"NSE:{s}" for s in symbols]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{KITE_BASE}/quote",
                params={"i": instruments},
                headers=self._headers(),
            )
        resp.raise_for_status()
        result = {}
        for key, q in resp.json().get("data", {}).items():
            sym = key.replace("NSE:", "")
            result[sym] = QuoteData(
                symbol=sym, exchange="NSE",
                ltp=float(q["last_price"]),
                open_price=float(q.get("ohlc", {}).get("open", 0)),
                high_price=float(q.get("ohlc", {}).get("high", 0)),
                low_price=float(q.get("ohlc", {}).get("low", 0)),
                prev_close=float(q.get("ohlc", {}).get("close", 0)),
                change=float(q.get("net_change", 0)),
                change_pct=float(q.get("change", 0)),
                volume=int(q.get("volume_traded", 0)),
            )
        return result
