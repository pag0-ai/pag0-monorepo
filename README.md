# Pag0 - Smart Proxy Layer for x402

> AI 에이전트의 유료 API 사용을 제어하는 스마트 프록시 플랫폼

**3-in-1 Middleware**: Spend Firewall + API Curation + Smart Cache

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Bun](https://bun.sh/) (proxy runtime)
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/) (local PostgreSQL + Redis)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. One-command setup: Docker up + DB migrate + seed
pnpm setup

# 3. Start proxy (port 3000) + dashboard (port 3001)
pnpm dev
```

That's it. The `setup` command starts PostgreSQL (port 5433) and Redis (port 6380) via Docker, runs the schema migration, and inserts seed data (demo user, categories, sample endpoint scores).

## Local Development

### Environment Variables

All environment variables live in `.env.local` (root, gitignored). This file is created during initial setup and is the single source of truth for all packages.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://pag0:pag0secret@localhost:5433/pag0` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection |
| `PORT` | `3000` | Proxy server port |
| `CORS_ORIGINS` | `http://localhost:3001` | Allowed CORS origins |
| `PAG0_API_KEY` | `pag0_test_local_dev_key_here` | Demo API key for testing |

See `.env.local` for the full list including x402, SKALE, and auth settings.

### Commands

```bash
# Development
pnpm dev              # Start proxy + dashboard concurrently
pnpm dev:proxy        # Proxy only (localhost:3000)
pnpm dev:dashboard    # Dashboard only (localhost:3001)
pnpm dev:mcp          # MCP server (stdio, separate terminal)

# Database
pnpm db:migrate       # Apply schema (idempotent)
pnpm db:seed          # Insert seed data (idempotent)

# Docker
pnpm docker:up        # Start Postgres + Redis containers
pnpm docker:down      # Stop containers (data preserved)
pnpm docker:reset     # Full reset: drop volumes + recreate + migrate + seed
pnpm docker:logs      # Tail container logs

# Build & Test
pnpm build            # Build all packages
pnpm test             # Run proxy tests
pnpm lint             # TypeScript type check
```

### Docker Services

| Service | Image | Host Port | Container Port |
|---------|-------|-----------|----------------|
| PostgreSQL | `postgres:16-alpine` | 5433 | 5432 |
| Redis | `redis:7-alpine` | 6380 | 6379 |

Non-standard ports (5433/6380) are used to avoid conflicts with system-level instances.

### Database

The schema includes 10 tables: `users`, `projects`, `policies`, `budgets`, `requests`, `endpoint_metrics_hourly`, `endpoint_metrics_daily`, `endpoint_metrics_monthly`, `endpoint_scores`, `categories`.

Seed data includes:
- 8 API categories (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)
- Demo user (`demo@pag0.dev`, tier: pro)
- Demo project with default policy (5 USDC/request, 50 USDC/day, 500 USDC/month)
- 5 sample endpoint scores (OpenAI, Anthropic, Infura, CoinGecko, Google Storage)

### Testing the Setup

```bash
# Verify containers are healthy
docker compose ps

# Test proxy health endpoint
curl http://localhost:3000/health

# Test with demo API key
curl -H "X-Pag0-API-Key: pag0_test_local_dev_key_here" http://localhost:3000/api/policies
```

## Structure

```
pag0-monorepo/
├── packages/
│   ├── proxy/         # @pag0/proxy — Hono + Bun backend
│   │   └── src/
│   │       ├── db/    # schema.sql, seed.sql, migrate.ts, seed.ts
│   │       └── ...    # proxy, policy, curation, cache, analytics
│   ├── dashboard/     # @pag0/dashboard — Next.js + Tailwind frontend
│   └── mcp/           # @pag0/mcp — MCP Server for Claude Code demo
├── docs/              # Product & technical documentation
├── docker-compose.yml # Local Postgres + Redis
├── .env.local         # Environment variables (gitignored)
└── package.json       # Monorepo scripts
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Backend | Hono |
| Database | PostgreSQL (Supabase) |
| Cache | Redis (Upstash, ioredis TCP) |
| Blockchain | SKALE (Zero Gas) |
| Frontend | Next.js + Tailwind + Recharts |
| x402 | @x402/fetch SDK |

## License

MIT
