# Pag0 Smart Proxy — Hackathon CLAUDE.md

> Pag0 = The only smart proxy layer in the x402 ecosystem. A 3-in-1 middleware providing Spend Firewall + API Curation + Smart Cache.

## Product Summary

- **Core Value**: Provides policy-based budget management, real-usage data-driven API curation, and intelligent caching (40%+ cost savings) so AI Agents can use x402 APIs safely and efficiently
- **Feature Priority**: Spend Firewall > API Curation > Smart Cache
- **Goal**: Complete Working MVP within 3-day hackathon (all core features working + 3 scenario demos + deployment)

---

## Tech Stack

| Layer      | Technology                            | npm Packages                                        |
| ---------- | ------------------------------------- | --------------------------------------------------- |
| Runtime    | Bun                                   | -                                                   |
| Framework  | Hono                                  | `hono`, `@hono/node-server`                         |
| x402 SDK   | x402 fetch                            | `@x402/fetch`                                       |
| Cache      | Redis (Upstash)                       | `ioredis` (TCP, for Fly.io)                         |
| Database   | PostgreSQL (Supabase)                 | `postgres` (NOT `pg`)                               |
| Blockchain | SKALE (Zero Gas)                      | `ethers`                                            |
| Dashboard  | Next.js + Tailwind                    | `recharts`, `@tanstack/react-query`, `lucide-react` |
| Hosting    | Fly.io (backend) / Vercel (dashboard) | -                                                   |
| Dev        | TypeScript strict                     | `@types/node`, `typescript`                         |

> **Note**: Use `ioredis` (TCP) for Redis client. Only switch to `@upstash/redis` (REST) when migrating to Cloudflare Workers.

---

## Project Structure

```
pag0-proxy/
├── src/
│   ├── index.ts              # Entry point + Hono routes + middleware (auth, rate-limit)
│   ├── proxy/
│   │   ├── core.ts           # ProxyCore class (request relay orchestration)
│   │   └── x402.ts           # x402 SDK wrapper (X402Integration)
│   ├── policy/
│   │   ├── engine.ts         # PolicyEngine (budget/whitelist/blacklist validation)
│   │   └── budget.ts         # BudgetTracker (daily/monthly spending tracking)
│   ├── curation/
│   │   └── engine.ts         # CurationEngine (scoring, recommendation, comparison)
│   ├── cache/
│   │   ├── redis.ts          # Redis client configuration
│   │   └── layer.ts          # CacheLayer (key generation, TTL, invalidation)
│   ├── analytics/
│   │   └── collector.ts      # AnalyticsCollector (metrics collection/storage)
│   ├── db/
│   │   ├── postgres.ts       # PostgreSQL client
│   │   └── schema.sql        # DDL scripts
│   └── types/
│       └── index.ts          # Shared TypeScript interfaces
├── .env                      # Environment variables (git ignore)
└── package.json

pag0-dashboard/               # Next.js + Tailwind (separate project)
├── app/
│   ├── dashboard/page.tsx    # Metrics visualization
│   ├── policies/page.tsx     # Policy management UI
│   └── rankings/page.tsx     # API ranking board
├── components/               # Reusable components
└── lib/api.ts                # API client

pag0-mcp/                     # Demo Agent — MCP Server (separate project)
├── src/
│   ├── index.ts              # MCP Server entry (stdio transport)
│   ├── tools/
│   │   ├── wallet.ts         # pag0_wallet_status
│   │   ├── proxy.ts          # pag0_request (402→sign→retry core)
│   │   ├── policy.ts         # pag0_check_budget, pag0_check_policy
│   │   ├── curation.ts       # pag0_recommend, pag0_compare
│   │   └── analytics.ts      # pag0_spending, pag0_cache_stats
│   ├── client.ts             # Pag0 Proxy API HTTP client
│   └── wallet.ts             # ethers.Wallet wrapper
├── .env                      # PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY
└── package.json
```

> **Middleware**: Auth (API Key validation) and Rate Limiter are implemented as integrated Hono middleware in `index.ts`.

---

## Commands

```bash
# Backend
bun install                    # Install dependencies
bun run dev                    # Development server (localhost:3000)
bun test                       # Run tests
bun run build                  # Build

# Database
bun run db:migrate             # Schema migration
bun run db:seed                # Insert seed data

# Deployment
fly launch && fly deploy       # Backend → Fly.io
fly secrets set KEY=VALUE      # Set environment variables
vercel --prod                  # Dashboard → Vercel
```

### Environment Variables (names only, values in .env)

```
# Server
PORT, NODE_ENV, LOG_LEVEL

# Database (Supabase)
DATABASE_URL, DIRECT_URL

# Redis (Upstash) — for ioredis TCP connection
REDIS_URL, REDIS_TOKEN

# x402
X402_FACILITATOR_URL, X402_NETWORK, X402_CHAIN_ID

# SKALE + ERC-8004 Audit Trail
SKALE_RPC_URL, ERC8004_SIGNER_KEY, ERC8004_REPUTATION_REGISTRY, ERC8004_VALIDATION_REGISTRY, ERC8004_SUBGRAPH_URL

# Auth & Security
JWT_SECRET, API_KEY_SALT, ENCRYPTION_KEY, CORS_ORIGINS
```

> **Important**: Redis credentials may already exist in `pag0/.env`. Extend the existing file rather than creating a new one.

---

## Deployment Strategy

### Deployment Targets & Platforms

| Component      | Project           | Platform     | URL Pattern                 | Notes                       |
| -------------- | ----------------- | ------------ | --------------------------- | --------------------------- |
| **Proxy API**  | `pag0-proxy/`     | **Fly.io**   | `pag0-proxy.fly.dev`        | Hono + Bun, main backend    |
| **Dashboard**  | `pag0-dashboard/` | **Vercel**   | `pag0-dashboard.vercel.app` | Next.js + Tailwind          |
| **MCP Server** | `pag0-mcp/`       | **Local**    | stdio (Claude Code integration) | Demo agent              |
| **PostgreSQL** | -                 | **Supabase** | Pooler URL (port 6543)      | Already provisioned         |
| **Redis**      | -                 | **Upstash**  | `rediss://` TLS             | Already provisioned         |

### Proxy API → Fly.io

```bash
# 1. Initialize (one-time)
cd pag0-proxy
fly auth login
fly launch --name pag0-proxy --region nrt --no-deploy

# 2. Set environment variables
fly secrets set \
  REDIS_URL="rediss://..." \
  POSTGRES_URL="postgresql://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  --app pag0-proxy

# 3. Deploy
fly deploy --app pag0-proxy

# 4. Verify
fly status --app pag0-proxy
curl https://pag0-proxy.fly.dev/health
```

**fly.toml Core Configuration**:

- `internal_port = 3000` (Hono default port)
- `min_machines_running = 1` (always running during hackathon)
- Health check: `GET /health`
- VM: `shared-cpu-1x`, 256MB (within Free tier)

### Dashboard → Vercel

```bash
# 1. Initialize (one-time)
cd pag0-dashboard
npx vercel link

# 2. Set environment variables (Vercel Dashboard or CLI)
npx vercel env add NEXT_PUBLIC_API_URL     # → https://pag0-proxy.fly.dev
npx vercel env add NEXT_PUBLIC_APP_NAME    # → Pag0

# 3. Deploy
npx vercel --prod

# 4. Verify
# Visit the URL that Vercel outputs
```

**Vercel Configuration**:

- Framework: Next.js (auto-detected)
- Build: `next build`
- Output: `.next/`
- Environment: `NEXT_PUBLIC_API_URL` = Fly.io proxy URL

### Dashboard → Proxy Connection

```
Dashboard (Vercel)  ──HTTPS──>  Proxy API (Fly.io)  ──TCP──>  Redis (Upstash)
                                                     ──TCP──>  PostgreSQL (Supabase)
                                                     ──HTTPS─> x402 Facilitator (Coinbase)
```

- Dashboard calls Proxy API via `NEXT_PUBLIC_API_URL`
- Must add Dashboard URL to Proxy CORS settings: `CORS_ORIGINS=https://pag0-dashboard.vercel.app`
- Dashboard must NOT directly access DB/Redis — all data goes through Proxy API

### Hackathon Deployment Timeline

| Timing           | Action                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Day 1 PM**     | First Proxy API deploy (Fly.io) — verify `/health` + `/proxy` working |
| **Day 2 Evening** | Proxy API update — all API endpoints working                          |
| **Day 3 AM**     | First Dashboard deploy (Vercel) — verify API integration              |
| **Day 3 PM**     | Final deploy — demo scenario data seeding + live demo                 |

### Deployment Failure Fallbacks

- **Fly.io failure**: Demo on `localhost:3000` + screen recording
- **Vercel failure**: Demo on `localhost:3001` with Next.js dev server
- **Both fail**: Pitch with test script execution results + architecture diagrams

---

## Demo Agent — MCP Server

### Why is it needed?

Track 1 (Best Agentic App) judging criteria requires agents to perform the **discover → decide → pay/settle → outcome** workflow. Pag0 Proxy alone is just "infrastructure", not an "agent". **Connecting Claude Code as the agent with Pag0 as an MCP tool** provides:

- Claude performs **reasoning** in natural language — "Choose anthropic with costScore 88, higher than openai(75)"
- Budget/policy checks before every call — **concrete evidence of guardrails** (judging criteria: Trust+Safety)
- Complete tool call logs — **audit trail** (judging criteria: Receipts/Logs)
- MCP is an open protocol — not Anthropic-dependent (also supports OpenAI, Cursor, etc.)

### Where does it run?

```
Claude Code ──MCP(stdio)──> Pag0 MCP Server ──HTTP──> Pag0 Proxy API (Fly.io)
                                │                        ├──TCP──> Redis (Upstash)
                                │                        ├──TCP──> PostgreSQL (Supabase)
                                │                        └──HTTPS─> x402 API Servers
                                │
                                ├── ethers.Wallet (PK from env)
                                │   └── x402 payment signing
                                │
                                └── .env
                                    ├── PAG0_API_URL
                                    ├── PAG0_API_KEY
                                    └── WALLET_PRIVATE_KEY
```

> **Core Principle**: The proxy NEVER signs payments. The MCP Server holds the Agent's wallet and is the entity that signs x402 payments (= Agent's hands).

### Tool List

#### Tier 1 — Required (minimum demo requirements, Day 3 AM ~2h)

| Tool | Input | Output | Pag0 API |
| --- | --- | --- | --- |
| `pag0_wallet_status` | (none) | `{ address, balanceUSDC, network }` | Direct (ethers RPC) |
| `pag0_request` | `{ url, method, headers?, body? }` | `{ response, cost, cached, latency, budgetRemaining }` | `POST /proxy` + wallet signing |
| `pag0_check_budget` | (none) | `{ daily: {spent, limit, remaining}, monthly: {...} }` | `GET /api/analytics/summary` |
| `pag0_recommend` | `{ category, sort_by?, limit? }` | `EndpointScore[]` | `GET /api/curation/recommend` |
| `pag0_compare` | `{ endpoints: string[] }` | `{ overall, cost, latency, reliability }` winner per category | `GET /api/curation/compare` |

> **`pag0_request` internal flow**: 1) Request to Proxy → 2) Parse PaymentRequired on 402 response → 3) Sign with ethers.Wallet → 4) Retry with signature header → 5) Return response + cost metadata. Uses `wrapFetch` from `@x402/fetch` but routes through Proxy URL.

#### Tier 2 — Enhanced Demo Impact (Day 3 AM remaining ~1h)

| Tool | Input | Output | Pag0 API |
| --- | --- | --- | --- |
| `pag0_check_policy` | `{ url, estimatedCost }` | `{ allowed, reason, policyName }` | dry-run or `GET /api/policies` |
| `pag0_spending` | `{ period?: "day"\|"month" }` | `{ totalSpent, totalSaved, requestCount, cacheHitRate }` | `GET /api/analytics/summary` |
| `pag0_cache_stats` | (none) | `{ hitRate, hitCount, missCount, savedAmount }` | `GET /api/analytics/cache` |
| `pag0_tx_history` | `{ limit? }` | `{ endpoint, cost, cached, timestamp }[]` | `GET /api/analytics/endpoints` |
| `pag0_list_policies` | (none) | `Policy[]` | `GET /api/policies` |

#### Tier 3 — If time permits

| Tool | Pag0 API |
| --- | --- |
| `pag0_rankings` | `GET /api/curation/rankings` |
| `pag0_score` | `GET /api/curation/score/:endpoint` |
| `pag0_create_policy` | `POST /api/policies` |

### Demo Scenarios (2-3 min video, split-screen: terminal + Dashboard)

```
Scenario A: Smart API Selection + Payment (40s)
─────────────────────────────────────────────────
User: "Choose the most efficient AI API and summarize this text"

1. pag0_wallet_status        → "Balance 5.0 USDC, base-sepolia"
2. pag0_check_budget          → "Used 2 USDC of 10 USDC daily limit"
3. pag0_recommend(AI)         → [anthropic:92 score, openai:85 score, cohere:78 score]
4. pag0_compare(anth, openai) → anthropic wins with cost 88, latency 95
5. pag0_request(anthropic...) → x402 payment → response + {cost:0.5 USDC}

→ Judging criteria match: discover(3) → decide(4) → pay(5) → outcome(response)

Scenario B: Policy Enforcement (30s)
──────────────────────────────────────
User: "Call this expensive API" (exceeds limit)

1. pag0_check_budget          → "Remaining 1 USDC"
2. pag0_check_policy(url, 2)  → "Denied: daily budget exceeded"
3. Claude: "Budget limit exceeded. I'll find an alternative"
4. pag0_recommend(same category) → Suggests cheaper alternative
5. pag0_request(alternative)  → Success

→ Judging criteria match: Trust+Safety (guardrails actually working)

Scenario C: Cache Savings (30s)
─────────────────────────────────
User: Execute same request twice

1. pag0_request(first)        → {cost:0.5 USDC, cached:false, latency:200ms}
2. pag0_request(same request) → {cost:0 USDC, cached:true, latency:5ms}
3. pag0_spending              → "Saved 0.5 USDC via cache, 50% hit rate"

→ Judging criteria match: Real utility (evidence of cost savings)
```

### When to build

| Timing | Action | Prerequisite |
| --- | --- | --- |
| **Day 2 Evening** | Prepare wallet PK, get testnet USDC, scaffold `pag0-mcp/` project | Testnet faucet |
| **Day 3 AM (0-2h)** | Implement Tier 1 tools (5 tools) | Proxy API deployment complete |
| **Day 3 AM (2-3h)** | Tier 2 tools + demo rehearsal | Tier 1 working verification |
| **Day 3 PM** | Demo video recording (split-screen) | Both MCP + Dashboard working |

### `.mcp.json` Configuration (Claude Code Integration)

```jsonc
{
  "mcpServers": {
    "pag0": {
      "command": "npx",
      "args": ["tsx", "pag0-mcp/src/index.ts"],
      "env": {
        "PAG0_API_URL": "https://pag0-proxy.fly.dev",
        "PAG0_API_KEY": "${PAG0_API_KEY}",
        "WALLET_PRIVATE_KEY": "${WALLET_PRIVATE_KEY}"
      }
    }
  }
}
```

### MCP Failure Fallbacks

- **Proxy API not deployed**: Use local Proxy with `PAG0_API_URL=http://localhost:3000`
- **Wallet insufficient balance**: Re-run testnet faucet or switch to mock 402 server
- **MCP itself fails**: Demo direct Proxy API calls from terminal with `curl`

---

## Architecture & Core Concepts

### 5 Core Components

1. **Proxy Core** — x402 request relay, 402 response parsing, payment relay
2. **Policy Engine (Spend Firewall)** — Budget limits, whitelist/blacklist, approval workflow
3. **Curation Engine** — Endpoint scoring (cost/latency/reliability), recommendations, comparison
4. **Cache Layer** — Redis response caching, TTL management, pattern-based rules
5. **Analytics Collector** — Request metrics collection/aggregation/storage (async)

### Request Flow

```
Agent → Pag0 Proxy → Auth Check → Policy Check → Cache Check
  → [Cache HIT] → Response + metadata (cost=0)
  → [Cache MISS] → x402 Server → 402 response → Agent signs → Facilitator verification
    → Post-processing: Cache Store + Analytics Log (async) + Budget Update
    → Response + metadata (cost, latency, cache info)
```

### CRITICAL INVARIANTS

- **Proxy NEVER signs payments** — only performs payment relay, Agent signs directly
- **USDC always BIGINT 6 decimals** — 1 USDC = 1,000,000. Absolutely NO floating point
- **Authentication**: `X-Pag0-API-Key` header, DB lookup with SHA-256 hash
- **API Key**: SHA-256 → `users.api_key_hash` VARCHAR(64). Password: bcrypt(12) → `users.password_hash`. No separate `api_keys` table in MVP

### Cache Conditions (isCacheable)

Cache only when ALL 4 conditions are met:

1. HTTP status 2xx
2. GET or idempotent method
3. No `Cache-Control: no-store` header
4. Response size < `maxCacheSizeBytes`

### Performance Goals (P95)

| Operation       | Target                  |
| --------------- | ----------------------- |
| Cache Hit       | <10ms                   |
| Policy Check    | <5ms                    |
| Analytics Write | <50ms (async)           |
| Full API Response | <300ms                |
| Throughput      | 1,000+ req/sec/instance |

---

## DB Quick Reference

### PostgreSQL 10 Tables

| Table                      | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `users`                    | User accounts, api_key_hash (SHA-256), password_hash (bcrypt) |
| `projects`                 | Projects (multiple per user)                                |
| `policies`                 | Spending policies (budget, whitelist, blacklist)            |
| `budgets`                  | Budget tracking (daily_spent, monthly_spent)                |
| `requests`                 | Request logs (monthly partitioning)                         |
| `endpoint_scores`          | Endpoint scores (overall, cost, latency, reliability)       |
| `categories`               | API categories                                              |
| `endpoint_metrics_hourly`  | Hourly aggregation                                          |
| `endpoint_metrics_daily`   | Daily aggregation                                           |
| `endpoint_metrics_monthly` | Monthly aggregation                                         |

> **categories seed data**: AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage (8 categories)

### Redis 6 Key Patterns

```
cache:{sha256(url+method+body)}           → JSON response    (TTL: configurable, default 300s)
budget:{projectId}:daily                   → spent amount     (TTL: midnight UTC)
budget:{projectId}:monthly                 → spent amount     (TTL: end of month)
rate:{projectId}:{window}                  → request count    (TTL: 60s)
score:{endpoint}                           → EndpointScore    (TTL: 300s)
metrics:{projectId}:{endpoint}:hourly      → hash counters    (TTL: 7200s)
nonce:{paymentId}                          → "1"              (TTL: 3600s, replay prevention)
```

---

## API Quick Reference

### Endpoint List

| Method | Path                            | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| POST   | `/proxy`                        | x402 request relay (core)      |
| GET    | `/api/policies`                 | List policies                  |
| POST   | `/api/policies`                 | Create policy                  |
| GET    | `/api/policies/:id`             | Policy details                 |
| PUT    | `/api/policies/:id`             | Update policy                  |
| DELETE | `/api/policies/:id`             | Delete policy                  |
| GET    | `/api/analytics/summary`        | Overall summary statistics     |
| GET    | `/api/analytics/endpoints`      | Per-endpoint statistics        |
| GET    | `/api/analytics/costs`          | Cost time series               |
| GET    | `/api/analytics/cache`          | Cache performance              |
| GET    | `/api/curation/recommend`       | Recommendations by category    |
| GET    | `/api/curation/compare`         | Endpoint comparison            |
| GET    | `/api/curation/rankings`        | Rankings by category           |
| GET    | `/api/curation/categories`      | Category list                  |
| GET    | `/api/curation/score/:endpoint` | Individual endpoint score      |
| POST   | `/api/auth/register`            | User registration              |
| POST   | `/api/auth/login`               | Login                          |
| GET    | `/api/auth/me`                  | Current user info              |
| GET    | `/health`                       | Health check                   |

### Authentication & Rate Limit

- **Auth Header**: `X-Pag0-API-Key: pag0_live_{32_char_random}`
- **Rate Limit**:
  - Free: 60 req/min, 1,000 req/day
  - Pro: 1,000 req/min, Unlimited req/day
- **Response Format**: `application/json`

> **Note**: The `04-API-SPEC.md` TL;DR states "1,000/min freemium", but the detailed Rate Limiting table shows Free=60/min as the accurate value.

---

## Coding Conventions

- **TypeScript strict mode** required (`strict: true` in tsconfig)
- **Naming**: camelCase (variables/functions), PascalCase (types/classes/interfaces), kebab-case (file names)
- **Hono patterns**: `app.get('/path', handler)`, `c.json()` response, `c.req.json()` body parsing
- **USDC amounts**: Always handle as `BigInt` or `string` — NO `parseFloat`
- **DB queries**: `postgres` package template literals — NO string concatenation (SQL injection prevention)
- **Async**: Use `async/await`, NO callbacks
- **Error handling**: Custom error classes (`PolicyViolationError`, `UnauthorizedError`, `RateLimitError`)
- **Error response format**: `{ error: { code: string, message: string, details?: any } }`
- **Analytics writes**: Must be async (do NOT block request response)

---

## Hackathon Constraints & Fallbacks

### Timeline

| Day   | Time | Core Goals                                                           |
| ----- | ---- | -------------------------------------------------------------------- |
| Day 0 | ~2h  | Environment setup, external service accounts, x402 SDK testing       |
| Day 1 | 8h   | Proxy Core (AM) + Policy Engine (PM)                                 |
| Day 2 | 9h   | Curation+Cache (AM) + Analytics (PM) + Integration tests (Evening)   |
| Day 3 | 8h   | Dashboard UI (AM) + Demo+Pitch+Deployment (PM)                       |

### MVP Scope (Included)

- Proxy Core, Policy Engine, Curation Engine, Cache Layer, Analytics Collector
- Web Dashboard (basic visualization, policy management, API rankings)
- 3 demo scenarios (Policy enforcement, Cache savings, API curation)

### MVP Scope (Excluded — Post-hackathon)

- Approval workflow
- Anomaly detection
- Background aggregation jobs
- SKALE on-chain metrics (optional)
- Advanced Dashboard charts/animations

### Fallback Strategy

| Risk                     | Fallback                                 |
| ------------------------ | ---------------------------------------- |
| x402 SDK integration failure | Mock x402 server (402 response simulation) |
| Upstash Redis connection failure | Local Redis (Docker) or In-memory Map |
| Supabase connection failure | Local PostgreSQL (Docker)              |
| Curation data shortage   | Seed data (synthetic metrics)            |
| Dashboard time shortage  | Basic table only (Tailwind, skip charts) |
| Deployment failure       | localhost demo + screen recording        |

> **Day 0**: Must verify actual API surface of `@x402/fetch` SDK — verify `X402Client`, `fetch()`, payment header parsing behavior.

---

## Do's and Don'ts

### DO

- Use BigInt for USDC amounts (1 USDC = `"1000000"`)
- Validate Policy before all proxy requests
- Verify all 4 cache conditions before caching
- Async log all requests to Analytics
- Store and lookup API Keys with SHA-256 hash
- Hash Passwords with bcrypt(12)
- Check existing `.env` file and extend (do NOT overwrite)

### DON'T

- Sign payments in proxy — Agent signs only
- Use `parseFloat` / `Number` for USDC
- Skip Policy validation
- Store API Key plaintext (hash only)
- Block request response with Analytics writes
- Use `pg` package (use `postgres`)
- Use `@upstash/redis` (use `ioredis` TCP for Fly.io deployment)
- Create separate `api_keys` table (MVP uses `users.api_key_hash`)

---

## Reference Documentation

| Document                                               | Content                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md)             | Product overview, positioning, target users  |
| [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) | Competitor analysis                          |
| [03-TECH-SPEC.md](03-TECH-SPEC.md)                     | Architecture, component details, performance goals |
| [04-API-SPEC.md](04-API-SPEC.md)                       | API endpoint detailed definitions            |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md)                     | DB schema DDL, Redis key patterns            |
| [06-DEV-TASKS.md](06-DEV-TASKS.md)                     | Day-by-day development tasks                 |
| [07-01-PITCH-SCRIPT.md](07-01-PITCH-SCRIPT.md)         | Pitch script                                 |
| [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md)           | Business model                               |
| [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md)   | Use cases index                              |
| [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md)         | Security design                              |
| [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md)       | Deployment guide, environment variables      |
| [12-SDK-GUIDE.md](12-SDK-GUIDE.md)                     | SDK usage guide                              |
| [00-GLOSSARY.md](00-GLOSSARY.md)                       | Glossary                                     |
