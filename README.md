# VrdCapital — Portfolio Management Platform

A microservices-based portfolio management system for professional portfolio managers, built with FastAPI, React, and Docker.

---

## Architecture

```
                          ┌─────────────┐
                          │   Browser   │
                          └──────┬──────┘
                                 │ :80
                          ┌──────▼──────┐
                          │    Nginx    │  reverse proxy + static assets
                          └──────┬──────┘
              ┌──────────────────┼──────────────────────┐
              │                  │                       │
       ┌──────▼──────┐   ┌───────▼──────┐   ┌──────────▼──────┐
       │ auth-service│   │client-service│   │portfolio-service│
       │   :8001     │   │    :8002     │   │     :8003       │
       └─────────────┘   └──────────────┘   └─────────────────┘
              │                  │                       │
       ┌──────▼──────┐   ┌───────▼──────┐   ┌──────────▼──────┐
       │broker-service│  │ order-service│   │ report-service  │
       │   :8004     │   │    :8005     │   │     :8007       │
       └─────────────┘   └──────┬───────┘   └─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   notification-service │
                    │         :8006          │
                    └───────────┬────────────┘
                                │
         ┌──────────────────────┼──────────────────┐
         │                      │                  │
  ┌──────▼─────┐     ┌─────────▼──────┐   ┌───────▼────┐
  │ PostgreSQL │     │     Redis      │   │  RabbitMQ  │
  │   :5432    │     │     :6379      │   │    :5672   │
  └────────────┘     └────────────────┘   └────────────┘
```

**Services**

| Service | Port | Purpose |
|---------|------|---------|
| auth-service | 8001 | JWT auth, user management, audit logs |
| client-service | 8002 | Client profiles, KYC, broker accounts |
| portfolio-service | 8003 | Holdings, positions, cash balances |
| broker-service | 8004 | Zerodha/Upstox/AngelOne adapter + sync |
| order-service | 8005 | Order placement, trades, instruments |
| notification-service | 8006 | WebSocket push, RabbitMQ consumer |
| report-service | 8007 | PDF/XLSX report generation |
| nginx | 80 | Reverse proxy |
| frontend | 3000 | React + TypeScript SPA |

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Docker | 24+ |
| Docker Compose | v2 (bundled with Docker Desktop) |
| Node.js | 20+ (for local frontend dev only) |
| Python | 3.11+ (for local service dev only) |

---

## Local Setup

### 1. Clone and configure

```bash
git clone https://github.com/vrushaldeshpande01/VrdCapital.git
cd VrdCapital
cp .env.example .env
```

Edit `.env` — at minimum set strong values for:
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `RABBITMQ_PASSWORD`
- `SECRET_KEY`  →  generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- `GRAFANA_PASSWORD`

### 2. Start all services

```bash
docker compose up -d
```

First run takes ~3–5 minutes to build all images. Subsequent starts are fast.

### 3. Verify everything is running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

All 14 containers should show `Up` or `Up (healthy)`.

### 4. Open the app

| URL | What |
|-----|------|
| http://localhost | Frontend (main app) |
| http://localhost/grafana | Grafana dashboards |
| http://localhost:15672 | RabbitMQ management UI |
| http://localhost:9090 | Prometheus metrics |
| http://localhost:8001/docs | Auth service Swagger |
| http://localhost:8005/docs | Order service Swagger |

Default admin credentials are created on first boot — check `auth-service` logs:
```bash
docker logs vrdcapital-auth | grep "admin"
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `REDIS_PASSWORD` | Yes | Redis auth password |
| `RABBITMQ_USER` | Yes | RabbitMQ username |
| `RABBITMQ_PASSWORD` | Yes | RabbitMQ password |
| `SECRET_KEY` | Yes | JWT signing key — min 32 chars, random |
| `GRAFANA_PASSWORD` | Yes | Grafana admin password |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT access token TTL (default: 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | JWT refresh token TTL (default: 7) |
| `ENVIRONMENT` | No | `development` or `production` |
| `VITE_API_BASE_URL` | No | Frontend API base (default: `http://localhost/api`) |

---

## API Overview

All APIs are proxied through nginx at `/api/<service>/api/v1/`.

### Auth (`/api/auth/api/v1/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Obtain access + refresh tokens |
| POST | `/auth/refresh` | Rotate tokens silently |
| GET | `/auth/me` | Current user profile |
| GET | `/users` | List users (admin) |

### Clients (`/api/clients/api/v1/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/clients` | List clients (paginated, searchable) |
| POST | `/clients` | Create client |
| GET | `/clients/:id` | Client detail |
| PATCH | `/clients/:id` | Update client |
| DELETE | `/clients/:id` | Soft-delete client |

### Orders (`/api/orders/api/v1/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Place order (MARKET/LIMIT/SL/SL_M) |
| GET | `/orders` | List orders (filterable) |
| PATCH | `/orders/:id` | Modify open order |
| PATCH | `/orders/:id/cancel` | Cancel order |
| GET | `/instruments` | Search instruments |
| GET | `/trades` | Trade fill history |
| GET | `/trading/positions` | Day / net positions with P&L |
| GET | `/trading/holdings` | CNC holdings |
| GET | `/funds/:client_id` | Available margin |

### Reports (`/api/reports/api/v1/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/reports/generate` | Generate PDF or XLSX report |
| GET | `/reports` | List generated reports |

---

## Running Tests

```bash
# Auth service
docker compose exec auth-service pytest tests/ -v

# Portfolio service
docker compose exec portfolio-service pytest tests/ -v
```

---

## Stopping / Resetting

```bash
# Stop all containers (preserve data)
docker compose down

# Stop and wipe all data volumes
docker compose down -v
```
