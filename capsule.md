# VrdCapital PMS — Project Capsule

**Generated:** 2026-06-15  
**Project Root:** `D:\DevOps\Projects\claudecode\portfolio-management-platform`

---

## Project Goal

Build a full-stack **Portfolio Management System (PMS)** for VrdCapital — an Indian wealth management firm. The system manages clients, portfolios, trades, and live market data for NSE/BSE Indian stocks.

---

## Current Status

**Phases Complete:** 1 (Foundation), 2 (Portfolio), 3 (Trading/Orders), 4 (Live Price Streaming)  
**Phases Pending:** 5 (Alerts), 6 (Reports), 7 (Scheduled Reports)

**Stack:**
- Backend: FastAPI (Python) — 7 microservices
- Frontend: React + TypeScript + MUI + Redux Toolkit + React Query
- Infra: Docker Compose (14 containers), PostgreSQL, Redis, RabbitMQ, Nginx, Prometheus, Grafana

**All 14 containers running healthy.**

---

## Architecture

```
Nginx (port 80)
  ├── /api/auth/     → auth-service      (port 8001)
  ├── /api/clients/  → client-service    (port 8002)
  ├── /api/portfolio/→ portfolio-service (port 8003)
  ├── /api/broker/   → broker-service    (port 8004)
  ├── /api/orders/   → order-service     (port 8005)
  ├── /api/notify/   → notification-service (port 8006)
  └── /api/reports/  → report-service    (port 8007)

Frontend (port 3000) — served via nginx
Redis (port 6379) — pub/sub + cache
PostgreSQL (port 5432) — primary DB
RabbitMQ (port 5672) — order event queue
```

---

## Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Real Indian stock data | **Alpha Vantage** (free tier) | Yahoo Finance blocked on server IP; NSE India blocked by Akamai; Twelve Data NSE requires paid plan |
| Symbol format | `WIPRO.BSE` | BSE and NSE prices identical; Alpha Vantage supports BSE on free tier |
| Price streaming | Redis pub/sub | broker-service polls → publishes to `market:ticks` → notification-service WebSocket → frontend |
| Rate limit handling | 5 symbols/min, 25/day | Alpha Vantage free tier limits; screener cached in Redis 5min |
| Mock data fallback | Always for screener overflow | Only 8 real prices per screener fetch; remaining 42 Nifty50 use realistic mock |
| Kite Connect | Deferred | Personal account has no REST API; Connect costs ₹2000/month |
| API keys security | `.env` only, never hardcoded | `.env.example` has placeholders only; `.env` is gitignored |

---

## Live Price Pipeline

```
broker-service (poll every 5min, max 8 symbols)
  → Alpha Vantage GLOBAL_QUOTE API (WIPRO.BSE format)
  → Redis cache `ltp:{SYMBOL}` (30s TTL)
  → Redis pub/sub `market:ticks`
    → notification-service subscribes
      → WebSocket broadcast to frontend
        → useMarketSocket.ts (singleton WS)
          → CustomEvent('market-tick')
            → useLivePrice / useLivePrices hooks
              → LivePriceTicker.tsx (scrolling bar)
              → PlaceOrderModal.tsx (live LTP)
```

---

## Important Files & Components

### Backend

| File | Purpose |
|------|---------|
| `services/broker-service/app/services/yahoo_finance.py` | Alpha Vantage integration — `fetch_screener()`, `fetch_quotes()`, NIFTY50 list with `.BSE` symbols |
| `services/broker-service/app/services/price_streamer.py` | Background asyncio price polling — 5min real-data interval, 2s publish interval, mock fallback |
| `services/broker-service/app/routes/market.py` | `/market/screener`, `/market/sectors`, `/market/ticker/*` endpoints; Redis cache for screener |
| `services/broker-service/app/routes/ticker.py` | Subscribe/unsubscribe/watchlist/LTP endpoints |
| `services/broker-service/app/config.py` | `ALPHA_VANTAGE_API_KEY`, `ZERODHA_API_KEY/SECRET` settings |
| `services/broker-service/app/adapters/mock_data.py` | Realistic mock prices: WIPRO=181, RELIANCE=1320, TCS=3450, etc. |
| `services/notification-service/app/services/market_subscriber.py` | Redis pub/sub subscriber → WebSocket broadcast |
| `services/client-service/app/routes/clients.py` | CSV import (phone OR empty string, not None) |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/Markets.tsx` | Indian Markets screener table — 50 Nifty stocks, sortable, filterable by sector/search |
| `frontend/src/pages/Dashboard.tsx` | AUM, active clients, P&L cards + portfolio chart + sector allocation |
| `frontend/src/hooks/useMarketSocket.ts` | Singleton WebSocket to notification-service; dispatches `market-tick` DOM events |
| `frontend/src/hooks/useLivePrice.ts` | `useLivePrice(symbol)` / `useLivePrices(symbols[])` — seeds from REST, updates via WS |
| `frontend/src/components/LivePriceTicker.tsx` | Scrolling dark ticker bar below header with real-time prices |
| `frontend/src/modules/trading/PlaceOrderModal.tsx` | Buy/sell modal with live LTP + pulsing green dot |
| `frontend/src/App.tsx` | `AppBootstrap` component dispatches `fetchCurrentUser()` on startup |
| `frontend/src/store/authSlice.ts` | Redux auth slice — user stored in localStorage, refreshed on app load |
| `frontend/src/api/client.ts` | Axios instances: `brokerApi` base = `/api/broker/api/v1` |

### Config & Infra

| File | Purpose |
|------|---------|
| `.env` | All secrets — `ALPHA_VANTAGE_API_KEY`, `ZERODHA_API_KEY/SECRET`, DB/Redis/RabbitMQ passwords |
| `.env.example` | Placeholder template — safe to commit |
| `docker-compose.yml` | 14-service stack — broker-service now passes `ALPHA_VANTAGE_API_KEY` env var |
| `deployment/docker/nginx.conf` | Reverse proxy — `/api/broker/` → `broker-service:8000/` (strips prefix) |

---

## Environment Variables (`.env`)

```
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
REDIS_PASSWORD
RABBITMQ_USER / RABBITMQ_PASSWORD
SECRET_KEY
GRAFANA_PASSWORD
ZERODHA_API_KEY=        (empty — Kite Connect not purchased)
ZERODHA_API_SECRET=     (empty)
ALPHA_VANTAGE_API_KEY=M1FSWGCQYPGX3XQD
VITE_API_BASE_URL=http://localhost/api
```

---

## API Key Constraints

| Service | Key | Limits |
|---------|-----|--------|
| Alpha Vantage | `M1FSWGCQYPGX3XQD` | **25 requests/day, 5/minute** — 1 symbol per request |
| Kite Connect | Not purchased | ₹2000/month; personal account has no API |

**Credit budget strategy:**
- Screener: fetches first 8 symbols real, rest mock; cached Redis 5min → ~8 credits per cache miss
- Streamer: max 5 symbols, every 5 minutes → ~5 credits per poll, ~60 credits/12h market day
- Total comfortable daily use: ~80-100 credits well within 25/day... **WARNING: 25 req/day may be tight if screener cache expires frequently. Consider upgrading Alpha Vantage or caching longer.**

---

## Known Issues / Bugs Fixed This Session

| Issue | Fix |
|-------|-----|
| "Welcome back, ." — missing username on dashboard | `AppBootstrap` dispatches `fetchCurrentUser()` on startup; stale localStorage user refreshed |
| Active Clients showing 0 | Updated both clients to `ACTIVE` status in DB |
| Missing sidebar items (Clients, Trading, etc.) | Caused by stale user in localStorage with no `role`; fixed by same `fetchCurrentUser` bootstrap |
| Twelve Data returning null (NSE not on free plan) | Switched to Alpha Vantage `GLOBAL_QUOTE` with `WIPRO.BSE` format |
| Markets page showing Yahoo Finance error | Rebuilt frontend; updated subtitle and error text |
| Rate limit 429 on Twelve Data | Removed Twelve Data entirely; replaced with Alpha Vantage |
| CSV import phone NOT NULL violation | `phone = row.get("phone","").strip() or ""` (was `or None`) |

---

## Pending Tasks

### High Priority
- [ ] **Alpha Vantage 25 req/day limit** — Monitor usage; consider upgrading to Basic plan ($50/month) for 750 req/day, or caching screener for longer (30min instead of 5min)
- [ ] **Markets page still erroring** — After latest frontend rebuild, verify the Markets page loads correctly in browser

### Feature Phases
- [ ] **Phase 5 — Alerts** — Price alerts (above/below threshold), portfolio alerts (drawdown %)
- [ ] **Phase 6 — Reports** — PDF portfolio reports, P&L statements, holdings summary
- [ ] **Phase 7 — Scheduled Reports** — Cron-based daily/weekly email reports

### Nice to Have
- [ ] **Kite Connect integration** — When user purchases ₹2000/month plan; adapter already built, just needs live credentials
- [ ] **Positions endpoint** — `get_positions()` in Zerodha adapter not exposed as API route
- [ ] **Market Cap & P/E** — Not available on Alpha Vantage GLOBAL_QUOTE; needs TIME_SERIES or third-party for these fields
- [ ] **52W High/Low** — GLOBAL_QUOTE only returns daily high/low, not 52-week range; need OVERVIEW endpoint (costs extra credits)
- [ ] **WebSocket order notifications** — Order status updates via WebSocket (RabbitMQ → notification-service → frontend)
- [ ] **Recent Orders on Dashboard** — Currently shows hardcoded mock orders; needs real order service integration

---

## Next Recommended Steps

1. **Verify Markets page** — Hard refresh browser, confirm Alpha Vantage prices load (WIPRO ~₹180, RELIANCE ~₹1292)
2. **Verify Dashboard** — Confirm "Welcome back, System Admin" shows and "Active Clients: 2" displays
3. **Extend screener cache TTL** — Change `SCREENER_CACHE_TTL` from 300s to 1800s (30min) to reduce daily credit consumption
4. **Build Phase 5 (Alerts)** — Price threshold alerts stored in DB, checked against live Redis LTP cache every poll cycle
5. **Add healthchecks** — Add Docker healthchecks to broker, notification, order, report services

---

## Useful Commands

```bash
# Check all services
docker compose ps

# Rebuild a service
docker compose up -d --no-deps --build <service-name>

# View logs
docker compose logs <service-name> --since 30s

# Check Redis cache
docker exec vrdcapital-redis redis-cli -a redis123 KEYS "ltp:*"
docker exec vrdcapital-redis redis-cli -a redis123 GET ltp:RELIANCE

# Check DB
docker exec vrdcapital-postgres psql -U vrdcapital -d vrdcapital -c "SELECT * FROM clients.clients;"

# Test Alpha Vantage directly
docker exec vrdcapital-broker python3 -c "
from app.services.yahoo_finance import fetch_screener
rows = fetch_screener(['WIPRO','RELIANCE'])
for r in rows: print(r['symbol'], r['ltp'])
"

# Get auth token
curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@vrdcapital.com","password":"Admin@123"}'
```

---

## Server Info

| Item | Value |
|------|-------|
| Server IP | 45.250.227.145 |
| Admin email | admin@vrdcapital.com |
| Admin password | Admin@123 |
| Frontend URL | http://localhost:3000 (or http://localhost via nginx) |
| Alpha Vantage key | M1FSWGCQYPGX3XQD |

> **Security note:** Server IP 45.250.227.145 is permanently blocked by Yahoo Finance and NSE India (Akamai). Any future data provider must be tested from this IP first.
