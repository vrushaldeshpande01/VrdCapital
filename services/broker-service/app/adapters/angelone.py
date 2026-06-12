"""
AngelOne SmartAPI adapter.

Sandbox mode: returns realistic mock data — no API keys needed.
Live mode:    calls the SmartAPI REST API using api_key + client_code + jwt_token.

To switch to live:
  1. Set is_sandbox=False on the credential
  2. Login via SmartAPI: POST /rest/auth/angelbroking/user/v1/loginByPassword
     with clientcode + password + totp
  3. Store jwt_token as access_token (valid for 24 hours)
  4. SmartAPI docs: https://smartapi.angelbroking.com/docs
"""
from typing import Optional
import httpx

from app.adapters.base import BrokerAdapter, HoldingData, PositionData, FundsData, QuoteData, ProfileData
from app.adapters.mock_data import get_mock_holdings, get_mock_quotes

SMARTAPI_BASE = "https://apiconnect.angelbroking.com"


class AngelOneAdapter(BrokerAdapter):

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": "127.0.0.1",
            "X-MACAddress": "00:00:00:00:00:00",
            "X-PrivateKey": self.api_key,
        }

    async def test_connection(self) -> tuple[bool, str, Optional[ProfileData]]:
        if self.is_sandbox:
            return True, "Sandbox mode active — mock data will be used", ProfileData(
                broker="angelone",
                account_id=self.api_key or "SANDBOX",
                client_name="Sandbox User",
                email="sandbox@angelone.in",
                exchanges=["NSE", "BSE", "NFO", "MCX"],
            )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{SMARTAPI_BASE}/rest/secure/angelbroking/user/v1/getProfile",
                    headers=self._headers(),
                )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return True, "Connected successfully", ProfileData(
                    broker="angelone",
                    account_id=data.get("clientcode", ""),
                    client_name=data.get("name", ""),
                    email=data.get("email", ""),
                    exchanges=data.get("exchanges", []),
                )
            return False, f"Authentication failed: {resp.status_code}", None
        except Exception as e:
            return False, f"Connection error: {str(e)}", None

    async def get_holdings(self) -> list[HoldingData]:
        if self.is_sandbox:
            return get_mock_holdings(self.api_key or "angelone_sandbox")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SMARTAPI_BASE}/rest/secure/angelbroking/portfolio/v1/getAllHolding",
                headers=self._headers(),
            )
        resp.raise_for_status()
        holdings = []
        for h in resp.json().get("data", {}).get("holdings", []):
            holdings.append(HoldingData(
                symbol=h["tradingsymbol"],
                name=h.get("symbolname", h["tradingsymbol"]),
                exchange=h.get("exchange", "NSE"),
                sector="",
                quantity=float(h["quantity"]),
                average_buy_price=float(h["averageprice"]),
                current_price=float(h["ltp"]),
                previous_close=float(h.get("close", h["ltp"])),
                isin=h.get("isin"),
            ))
        return holdings

    async def get_positions(self) -> list[PositionData]:
        if self.is_sandbox:
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SMARTAPI_BASE}/rest/secure/angelbroking/order/v1/getPosition",
                headers=self._headers(),
            )
        resp.raise_for_status()
        return []

    async def get_funds(self) -> FundsData:
        if self.is_sandbox:
            return FundsData(available_cash=500000.0, used_margin=0.0, total_balance=500000.0)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SMARTAPI_BASE}/rest/secure/angelbroking/user/v1/getRMS",
                headers=self._headers(),
            )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return FundsData(
            available_cash=float(data.get("availablecash", 0)),
            used_margin=float(data.get("utiliseddebits", 0)),
            total_balance=float(data.get("net", 0)),
        )

    async def get_quotes(self, symbols: list[str]) -> dict[str, QuoteData]:
        if self.is_sandbox:
            return get_mock_quotes(symbols)
        exchange_tokens = [{"exchange": "NSE", "symboltoken": s, "tradingsymbol": s} for s in symbols]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{SMARTAPI_BASE}/rest/secure/angelbroking/market/v1/quote/",
                json={"mode": "LTP", "exchangeTokens": {"NSE": [s for s in symbols]}},
                headers=self._headers(),
            )
        resp.raise_for_status()
        result = {}
        for q in resp.json().get("data", {}).get("fetched", []):
            sym = q.get("tradingSymbol", "")
            result[sym] = QuoteData(
                symbol=sym, exchange="NSE",
                ltp=float(q.get("ltp", 0)),
                open_price=float(q.get("open", 0)),
                high_price=float(q.get("high", 0)),
                low_price=float(q.get("low", 0)),
                prev_close=float(q.get("close", 0)),
                change=float(q.get("netChange", 0)),
                change_pct=float(q.get("percentChange", 0)),
                volume=int(q.get("tradeVolume", 0)),
            )
        return result
