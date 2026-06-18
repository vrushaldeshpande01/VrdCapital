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
from decimal import Decimal
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
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            h_resp = await client.get(f"{KITE_BASE}/portfolio/holdings", headers=self._headers())
            p_resp = await client.get(f"{KITE_BASE}/portfolio/positions", headers=self._headers())
        h_resp.raise_for_status()
        p_resp.raise_for_status()

        holdings: dict[str, HoldingData] = {}

        # Settled holdings (T+1 and beyond)
        for h in h_resp.json().get("data", []):
            qty = float(h["quantity"]) + float(h.get("t1_quantity", 0))
            if qty <= 0:
                continue
            holdings[h["tradingsymbol"]] = HoldingData(
                symbol=h["tradingsymbol"],
                name=h["tradingsymbol"],
                exchange=h.get("exchange", "NSE"),
                sector="",
                quantity=qty,
                average_buy_price=float(h["average_price"]),
                current_price=float(h["last_price"]),
                previous_close=float(h.get("close_price", h["last_price"])),
                isin=h.get("isin"),
            )

        # Today's CNC buys (not yet settled — live in positions until T+1)
        for p in p_resp.json().get("data", {}).get("net", []):
            if p.get("product") != "CNC":
                continue
            qty = float(p.get("quantity", 0))
            if qty <= 0:
                continue
            sym = p["tradingsymbol"]
            if sym not in holdings:
                # New today — add as pending holding
                buy_price = float(p.get("buy_price") or p.get("average_price") or 0)
                ltp = float(p.get("last_price") or buy_price)
                holdings[sym] = HoldingData(
                    symbol=sym,
                    name=sym,
                    exchange=p.get("exchange", "NSE"),
                    sector="",
                    quantity=qty,
                    average_buy_price=buy_price,
                    current_price=ltp,
                    previous_close=float(p.get("close_price") or ltp),
                    isin=None,
                )
            else:
                # Already have a settled holding — add today's quantity
                existing = holdings[sym]
                total_qty = existing.quantity + qty
                holdings[sym] = HoldingData(
                    symbol=sym,
                    name=existing.name,
                    exchange=existing.exchange,
                    sector=existing.sector,
                    quantity=total_qty,
                    average_buy_price=existing.average_buy_price,
                    current_price=existing.current_price,
                    previous_close=existing.previous_close,
                    isin=existing.isin,
                )

        return list(holdings.values())

    async def get_positions(self) -> list[PositionData]:
        if self.is_sandbox:
            return []
        from datetime import date
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{KITE_BASE}/portfolio/positions", headers=self._headers())
        resp.raise_for_status()
        positions = []
        for p in resp.json().get("data", {}).get("net", []):
            qty = float(p.get("quantity", 0))
            if qty == 0:
                continue
            positions.append(PositionData(
                symbol=p["tradingsymbol"],
                exchange=p.get("exchange", "NSE"),
                quantity=qty,
                buy_price=float(p.get("buy_price", 0)),
                sell_price=float(p.get("sell_price", 0)) or None,
                trade_date=date.today(),
                is_open=qty != 0,
                product=p.get("product", "CNC"),
            ))
        return positions

    async def get_funds(self) -> FundsData:
        if self.is_sandbox:
            return FundsData(available_cash=0.0, used_margin=0.0, total_balance=0.0)
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

    async def place_order(
        self,
        symbol: str,
        exchange: str,
        side: str,
        price_type: str,
        quantity: int,
        price: Optional[Decimal] = None,
        trigger_price: Optional[Decimal] = None,
    ) -> dict:
        if self.is_sandbox:
            return await super().place_order(symbol, exchange, side, price_type, quantity, price, trigger_price)

        # Map internal price_type to Kite order_type
        ORDER_TYPE_MAP = {
            "MARKET": "MARKET",
            "LIMIT": "LIMIT",
            "SL": "SL",
            "SL_M": "SL-M",
        }
        payload = {
            "tradingsymbol": symbol,
            "exchange": exchange,
            "transaction_type": side.upper(),  # BUY / SELL
            "order_type": ORDER_TYPE_MAP.get(price_type, "MARKET"),
            "quantity": quantity,
            "product": "CNC",
            "validity": "DAY",
        }
        if price and price_type in ("LIMIT", "SL"):
            payload["price"] = str(price)
        if trigger_price and price_type in ("SL", "SL_M"):
            payload["trigger_price"] = str(trigger_price)

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{KITE_BASE}/orders/regular",
                data=payload,
                headers=self._headers(),
            )

        if resp.status_code not in (200, 201):
            raise Exception(f"Kite order failed {resp.status_code}: {resp.text}")

        data = resp.json().get("data", {})
        order_id = data.get("order_id", "")

        return {
            "status": "OPEN",
            "broker_order_id": order_id,
            "executed_quantity": 0,
            "average_price": None,
            "executed_at": None,
        }
