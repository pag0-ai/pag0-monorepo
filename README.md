# Pag0 - Smart Proxy Layer for x402

> A smart proxy platform that controls paid API usage for AI agents

**3-in-1 Middleware**: Spend Firewall + API Curation + Smart Cache

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Bun](https://bun.sh/) (proxy runtime)
- [pnpm](https://pnpm.io/) >= 9

## Guides

- [MCP Agent Demo Script Setup Guide](guides/1-RUN-MCP-AGENT-SCRIPT.md)

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Backend | Hono |
| Database | PostgreSQL (Supabase) |
| ERC-8004 Layer | SKALE (Zero Gas) |
| x402 Payment Layer | @x402/fetch SDK |
| Cache | Redis (Upstash, ioredis TCP) |
| Frontend | Next.js + Tailwind + Recharts |

## Structure

```
pag0-monorepo/
├── packages/
│   ├── proxy/         # @pag0/proxy — Hono + Bun backend
│   │   └── src/
│   │       ├── proxy/       # ProxyCore (request relay), X402Integration, transparent relay
│   │       ├── policy/      # PolicyEngine (budget/whitelist/blacklist), BudgetTracker
│   │       ├── curation/    # CurationEngine (scoring, recommendations, comparisons)
│   │       ├── cache/       # CacheLayer (Redis, TTL, isCacheable), Redis client
│   │       ├── analytics/   # AnalyticsCollector (async metrics)
│   │       ├── middleware/   # Auth (API Key + JWT), Rate Limit, Chain ID
│   │       ├── routes/      # REST API routes (policies, analytics, curation, auth, smart-request, reputation)
│   │       ├── audit/       # ERC-8004 on-chain audit trail (SKALE)
│   │       ├── subgraph/    # The Graph subgraph client (GraphQL)
│   │       ├── db/          # schema.sql, seed.sql, migrations, seed.ts
│   │       └── types/       # Shared TypeScript interfaces
│   ├── dashboard/     # @pag0/dashboard — Next.js + Tailwind frontend
│   ├── mcp/           # @pag0/mcp — MCP Server for AI agent demo
│   │   └── src/
│   │       ├── tools/       # 16 MCP tools (wallet, proxy, policy, curation, analytics, smart, audit)
│   │       ├── proxy-fetch.ts   # x402 SDK integration (wrapFetchWithPayment → /relay)
│   │       ├── x402-payment.ts  # Payment payload creation (ExactEvmSchemeV1)
│   │       ├── wallet.ts        # Local ethers.Wallet (Base Sepolia / BSC)
│   │       ├── cdp-wallet.ts    # Coinbase CDP Server Wallet (auto-faucet)
│   │       ├── client.ts        # Pag0 Proxy API HTTP client
│   │       └── index.ts         # MCP Server entry (stdio transport)
│   └── contracts/     # @pag0/contracts — Foundry (ERC-8004 Solidity on SKALE)
├── docs/              # Product & technical documentation
├── docker-compose.yml # Local Postgres + Redis
├── .env.local         # Environment variables (gitignored)
└── package.json       # Monorepo scripts
```

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

- 8 API categories (AI Agents, Data & Analytics, IPFS & Storage, Content & Media, Web & Automation, Agent Infrastructure, Crypto & NFT, Developer Tools)
- Demo user (`demo@pag0.dev`, tier: pro)
- Demo project with default policy (5 USDC/request, 50 USDC/day, 500 USDC/month)
- 20 endpoint scores from real x402 Base Sepolia APIs (dctx.link, grapevine, pinata, etc.)
- ~70 synthetic request logs across 7 days for realistic analytics display

### Testing the Setup

```bash
# Verify containers are healthy
docker compose ps

# Test proxy health endpoint
curl http://localhost:3000/health

# Test with demo API key
curl -H "X-Pag0-API-Key: pag0_test_local_dev_key_here" http://localhost:3000/api/policies
```

## License

MIT
