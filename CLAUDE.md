# Pag0 Smart Proxy — Hackathon CLAUDE.md

> Pag0 = The only smart proxy layer in the x402 ecosystem. A 3-in-1 middleware providing Spend Firewall + API Curation + Smart Cache in one package.

## Product Summary

- **Core Value**: Provides policy-based budget management, real-usage-data-driven API curation, and intelligent caching (40%+ cost savings) so AI Agents can use x402 APIs safely and efficiently
- **Feature Priority**: Spend Firewall > API Curation > Smart Cache
- **Goal**: Complete a working MVP within a 3-day hackathon (all core features working + 3 scenario demos + deployment)

---

## Tech Stack

| Layer | Technology | npm Package |
|-------|-----------|-------------|
| Runtime | Bun | - |
| Framework | Hono | `hono`, `@hono/node-server` |
| x402 SDK | x402 fetch | `@x402/fetch` |
| Cache | Redis (Upstash) | `ioredis` (TCP, for Fly.io) |
| Database | PostgreSQL (Supabase) | `postgres` (NOT `pg`) |
| Blockchain | SKALE (Zero Gas) | `ethers` |
| Dashboard | Next.js + Tailwind | `recharts`, `@tanstack/react-query`, `lucide-react` |
| Hosting | Fly.io (backend) / Vercel (dashboard) | - |
| MCP Server | MCP SDK + ethers + CDP SDK | `@modelcontextprotocol/sdk`, `ethers`, `@coinbase/cdp-sdk`, `@x402/fetch`, `zod` |
| Dev | TypeScript strict | `@types/node`, `typescript` |

> **Note**: Redis client uses `ioredis` (TCP). Only switch to `@upstash/redis` (REST) when migrating to Cloudflare Workers.

---

## Project Structure

```
pag0-monorepo/
├── packages/
│   ├── proxy/                    # @pag0/proxy — Hono + Bun backend
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point + Hono app + route registration
│   │   │   ├── proxy/
│   │   │   │   ├── core.ts       # ProxyCore class (8-step request relay orchestration)
│   │   │   │   ├── x402.ts       # X402Integration (forward, parse 402, payment relay)
│   │   │   │   └── relay.ts      # Transparent /relay endpoint (raw 402 pass-through)
│   │   │   ├── policy/
│   │   │   │   ├── engine.ts     # PolicyEngine (6-step validation: blacklist/whitelist/budget)
│   │   │   │   └── budget.ts     # BudgetTracker (Redis + PostgreSQL, multi-chain)
│   │   │   ├── curation/
│   │   │   │   └── engine.ts     # CurationEngine (4-dimension scoring, recommendations, comparisons)
│   │   │   ├── cache/
│   │   │   │   ├── redis.ts      # Redis client configuration (ioredis TCP)
│   │   │   │   └── layer.ts      # CacheLayer (4-condition isCacheable, TTL rules)
│   │   │   ├── analytics/
│   │   │   │   └── collector.ts  # AnalyticsCollector (fire-and-forget, dual Redis+PG storage)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts       # API Key (SHA-256) + JWT authentication
│   │   │   │   ├── rate-limit.ts # Tier-based rate limiting (60/1000/10000 req/min)
│   │   │   │   └── chain-id.ts   # X-Pag0-Chain-ID extraction (default: 56 BSC)
│   │   │   ├── routes/
│   │   │   │   ├── policies.ts   # Policy CRUD
│   │   │   │   ├── analytics.ts  # Analytics queries (summary, endpoints, costs, cache)
│   │   │   │   ├── curation.ts   # Curation API (recommend, compare, rankings, score)
│   │   │   │   ├── auth.ts       # Register / login
│   │   │   │   ├── smart-request.ts  # AI-driven endpoint selection by category
│   │   │   │   └── reputation.ts # ERC-8004 feedback submission / queries
│   │   │   ├── audit/
│   │   │   │   └── erc8004.ts    # On-chain audit trail (SKALE, retry queue)
│   │   │   ├── subgraph/
│   │   │   │   ├── client.ts     # GraphQL client for The Graph (reputation data)
│   │   │   │   ├── queries.ts    # GraphQL query definitions
│   │   │   │   └── types.ts      # Subgraph type definitions
│   │   │   ├── db/
│   │   │   │   ├── postgres.ts   # PostgreSQL client
│   │   │   │   ├── schema.sql    # DDL script (10 tables)
│   │   │   │   ├── seed.sql      # Seed data (categories, demo user, 20 endpoints, ~70 requests)
│   │   │   │   ├── seed.ts       # TypeScript seed runner
│   │   │   │   ├── seed-resources.ts  # Resource enrichment from bsc-x402-apis.json
│   │   │   │   ├── migrate.ts    # Migration runner
│   │   │   │   └── migrations/   # SQL migrations (001_add_chain_id.sql)
│   │   │   ├── demo-apis.ts      # Built-in demo x402 endpoints for testing
│   │   │   └── types/
│   │   │       └── index.ts      # Shared TypeScript interfaces
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── dashboard/                # @pag0/dashboard — Next.js + Tailwind
│   │   ├── app/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── policies/page.tsx
│   │   │   └── rankings/page.tsx
│   │   ├── components/
│   │   ├── lib/api.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── contracts/                 # @pag0/contracts — Foundry (ERC-8004 Solidity)
│   │   ├── src/
│   │   │   ├── ReputationRegistry.sol  # giveFeedback() + FeedbackGiven event (stateless)
│   │   │   └── ValidationRegistry.sol  # validationRequest() + ValidationRequested event (stateless)
│   │   ├── script/Deploy.s.sol         # Forge deploy script → deployments.json
│   │   ├── test/                       # Forge tests
│   │   ├── foundry.toml                # Solc 0.8.19, Shanghai EVM, SKALE + BSC RPC
│   │   └── deployments.json            # Deployed addresses (SKALE bite-v2-sandbox)
│   └── mcp/                      # @pag0/mcp — MCP Server for AI agent demo (16 tools)
│       ├── src/
│       │   ├── index.ts          # MCP Server entry (stdio transport)
│       │   ├── client.ts         # Pag0 Proxy API HTTP client
│       │   ├── proxy-fetch.ts    # x402 SDK integration (wrapFetchWithPayment → /relay)
│       │   ├── x402-payment.ts   # Payment payload creation (ExactEvmSchemeV1, EIP-3009)
│       │   ├── wallet.ts         # Pag0Wallet — local ethers.Wallet (Base Sepolia / BSC)
│       │   ├── cdp-wallet.ts     # CdpWallet — Coinbase CDP Server Wallet (auto-faucet)
│       │   └── tools/
│       │       ├── wallet.ts     # pag0_wallet_status
│       │       ├── wallet-fund.ts # pag0_wallet_fund (CDP faucet)
│       │       ├── proxy.ts      # pag0_request (402→sign→retry via proxyFetch)
│       │       ├── smart.ts      # pag0_smart_request (auto-select best + manual 402 handling)
│       │       ├── policy.ts     # pag0_check_budget, pag0_check_policy, pag0_list_policies
│       │       ├── curation.ts   # pag0_recommend, pag0_compare, pag0_rankings, pag0_score
│       │       ├── analytics.ts  # pag0_spending, pag0_cache_stats, pag0_tx_history
│       │       ├── audit.ts      # pag0_audit_trail, pag0_reputation
│       │       └── auth.ts       # Helper: injectAuthHeaders
│       ├── .env                  # PAG0_API_URL, PAG0_API_KEY, WALLET_MODE, WALLET_PRIVATE_KEY, CDP keys
│       ├── package.json
│       └── tsconfig.json
├── subgraph/                     # The Graph subgraph (ERC-8004 indexer)
│   ├── schema.graphql            # Agent, FeedbackEvent, ValidationRequest/Response
│   ├── subgraph.yaml             # Data sources (SKALE bite-v2-sandbox)
│   ├── src/mapping.ts            # Event handlers
│   └── package.json              # graph-cli, graph-ts
├── scripts/
│   └── subgraph-deploy.sh        # One-command: graph-node + build + deploy
├── docker-compose.yml            # postgres, redis, graph-node, graph-postgres, ipfs
├── docs/                         # Product/technical documentation (original from pag0/)
├── .env.example                  # Environment variable template
├── package.json                  # Root (pnpm workspace)
├── pnpm-workspace.yaml
└── tsconfig.json                 # Shared TS configuration
```

> **Middleware**: Auth, Rate Limiter, and Chain ID are separate Hono middleware files in `proxy/src/middleware/`.

---

## Commands

```bash
# Root (monorepo)
pnpm install                       # Install all dependencies
pnpm dev                           # Run proxy + dashboard concurrently
pnpm dev:proxy                     # Backend only (localhost:3000)
pnpm dev:dashboard                 # Dashboard only (localhost:3001)
pnpm dev:mcp                       # MCP Server (stdio, for Claude Code integration)
pnpm build                         # Build all packages
pnpm test                          # Run tests (proxy)

# Database
pnpm db:migrate                    # Run schema migration
pnpm db:seed                       # Insert seed data

# Contracts (Foundry)
cd packages/contracts && forge build    # Compile
cd packages/contracts && forge test     # Test
cd packages/contracts && forge script script/Deploy.s.sol:Deploy --rpc-url $SKALE_RPC_URL --broadcast --legacy  # Deploy

# Subgraph
./scripts/subgraph-deploy.sh            # Local graph-node + deploy
cd subgraph && npm run deploy:goldsky   # Goldsky deploy

# Deployment
fly launch && fly deploy           # Backend → Fly.io
fly secrets set KEY=VALUE          # Set environment variables
vercel --prod                      # Dashboard → Vercel
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

# MCP Server (packages/mcp)
PAG0_API_URL, PAG0_API_KEY, WALLET_MODE, WALLET_PRIVATE_KEY, NETWORK
# CDP Wallet (when WALLET_MODE=cdp)
CDP_API_KEY_ID, CDP_API_KEY_SECRET
```

> **Important**: Redis credentials may already exist in the `.env` file. Extend the existing file rather than creating a new one.

---

## Architecture & Core Concepts

### 8 Core Components

1. **Proxy Core** — x402 request relay (POST `/proxy`), transparent relay (ALL `/relay`), 402 response parsing, payment relay
2. **Policy Engine (Spend Firewall)** — 6-step validation: blacklist → whitelist → per-request limit → daily/monthly budget (multi-chain)
3. **Curation Engine** — 4-dimension scoring (cost 0.3, latency 0.25, reliability 0.25, reputation 0.2), recommendations, comparisons
4. **Cache Layer** — Redis response caching, 4-condition isCacheable, pattern-based TTL rules
5. **Analytics Collector** — fire-and-forget async metrics, dual storage (Redis real-time + PostgreSQL source of truth)
6. **ERC-8004 Audit Trail** — on-chain feedback via SKALE `ReputationRegistry.giveFeedback()`, IPFS metadata, retry queue
7. **Subgraph Client** — GraphQL client for The Graph, reputation queries, Redis-cached (300s TTL)
8. **Smart Request** — AI-driven endpoint selection by category (recommend → compare → request)

### Request Flow

```
MCP Agent → proxyFetch() rewrites URL to /relay with X-Pag0-Target-URL header
  → Pag0 Proxy /relay → Auth Check → Chain ID → Rate Limit → Policy Check → Cache Check
    → [Cache HIT] → Response + X-Pag0-* metadata headers (cost=0)
    → [Cache MISS] → Forward to x402 Server
      → [402] → Proxy returns 402 + paymentInfo to MCP → MCP signs (ExactEvmSchemeV1)
        → MCP retries with X-Payment header (base64) → Proxy forwards to x402
      → [200] → Cache Store + Analytics Log (async) + Budget Deduct + ERC-8004 Audit (async)
        → Response + X-Pag0-* metadata headers (cost, latency, cached, budget-remaining)
```

> **Key**: MCP ONLY communicates with the proxy (never directly with x402 servers). The x402 SDK's `wrapFetchWithPayment` handles the 402→sign→retry loop automatically for `pag0_request`. `pag0_smart_request` uses manual 402 handling.

### CRITICAL INVARIANTS

- **The proxy NEVER signs payments** — only performs payment relay; the Agent signs directly
- **USDC is always BIGINT with 6 decimals** — 1 USDC = 1,000,000. Never use floating point
- **Authentication**: `X-Pag0-API-Key` header, looked up in DB via SHA-256 hash
- **API Key**: SHA-256 → `users.api_key_hash` VARCHAR(64). Password: bcrypt(12) → `users.password_hash`. No separate `api_keys` table in MVP

### Cache Conditions (isCacheable)

Cache only when all 4 conditions are met:
1. HTTP status 2xx
2. GET, HEAD, or OPTIONS method
3. No `Cache-Control: no-store` header
4. Response size < `maxCacheSizeBytes` (default: 1MB)

### Performance Targets (P95)

| Operation | Target |
|-----------|--------|
| Cache Hit | <10ms |
| Policy Check | <5ms |
| Analytics Write | <50ms (async) |
| Full API Response | <300ms |
| Throughput | 1,000+ req/sec/instance |

---

## DB Quick Reference

### PostgreSQL — 10 Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts, api_key_hash (SHA-256), password_hash (bcrypt) |
| `projects` | Projects (multiple per user) |
| `policies` | Spend policies (budgets, whitelist, blacklist) |
| `budgets` | Budget tracking (daily_spent, monthly_spent) |
| `requests` | Request logs (monthly partitioning) |
| `endpoint_scores` | Endpoint scores (overall, cost, latency, reliability) |
| `categories` | API categories |
| `endpoint_metrics_hourly` | Hourly aggregations |
| `endpoint_metrics_daily` | Daily aggregations |
| `endpoint_metrics_monthly` | Monthly aggregations |

> **categories seed data**: AI Agents, Data & Analytics, IPFS & Storage, Content & Media, Web & Automation, Agent Infrastructure, Crypto & NFT, Developer Tools (8 total)

### Redis — 8 Key Patterns

```
cache:{sha256(url+method+body)}           → JSON response    (TTL: configurable, default 300s)
budget:{projectId}:{chainId}:daily         → spent amount     (TTL: midnight UTC)
budget:{projectId}:{chainId}:monthly       → spent amount     (TTL: end of month)
rate:{projectId}:{window}                  → request count    (TTL: 60s)
score:{endpoint}                           → EndpointScore    (TTL: 300s)
metrics:{projectId}:{endpoint}:hourly      → hash counters    (TTL: 7200s)
nonce:{paymentId}                          → "1"              (TTL: 3600s, replay prevention)
subgraph:{hash}                            → GraphQL result   (TTL: 300s)
```

---

## API Quick Reference

### Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| POST | `/proxy` | x402 request relay (JSON-wrapped, with payment handling) |
| ALL | `/relay` | Transparent pass-through relay (raw 402, X-Pag0-Target-URL header) |
| POST | `/api/smart-request` | AI-driven endpoint selection by category + auto-call |
| GET | `/api/policies` | List policies |
| POST | `/api/policies` | Create policy |
| GET | `/api/policies/:id` | Get policy details |
| PUT | `/api/policies/:id` | Update policy |
| DELETE | `/api/policies/:id` | Delete policy |
| GET | `/api/analytics/summary` | Overall summary statistics |
| GET | `/api/analytics/endpoints` | Per-endpoint statistics |
| GET | `/api/analytics/costs` | Cost time series |
| GET | `/api/analytics/cache` | Cache performance |
| GET | `/api/curation/recommend` | Recommendations by category |
| GET | `/api/curation/compare` | Endpoint comparison |
| GET | `/api/curation/rankings` | Rankings by category |
| GET | `/api/curation/categories` | Category list |
| GET | `/api/curation/score/:endpoint` | Individual endpoint score |
| POST | `/api/reputation/feedback` | Submit ERC-8004 feedback |
| GET | `/api/reputation/agent/:agentId` | Get agent reputation from subgraph |
| GET | `/api/reputation/leaderboard` | Reputation leaderboard |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user info |
| GET | `/health` | Health check |
| GET | `/.well-known/agent.json` | A2A protocol agent card |
| GET | `/llms.txt` | LLM-readable documentation |

### Authentication & Rate Limiting

- **Auth Header**: `X-Pag0-API-Key: pag0_live_{32_char_random}`
- **Rate Limit** (per-minute, Redis counter with 60s window):
  - Free: 60 req/min
  - Pro: 1,000 req/min
  - Enterprise: 10,000 req/min
- **Response Format**: `application/json`

> **Note**: The `04-API-SPEC.md` TL;DR states "1,000/min freemium", but per the detailed Rate Limiting table, Free=60/min is the accurate value.

---

## Coding Conventions

- **TypeScript strict mode** required (`strict: true` in tsconfig)
- **Naming**: camelCase (variables/functions), PascalCase (types/classes/interfaces), kebab-case (filenames)
- **Hono patterns**: `app.get('/path', handler)`, `c.json()` for responses, `c.req.json()` for body parsing
- **USDC amounts**: Always use `BigInt` or `string` — never `parseFloat`
- **DB queries**: Use `postgres` package template literals — no string concatenation (SQL injection prevention)
- **Async**: Use `async/await`, no callbacks
- **Error handling**: Custom error classes (`PolicyViolationError`, `UnauthorizedError`, `RateLimitError`)
- **Error response format**: `{ error: { code: string, message: string, details?: any } }`
- **Analytics writes**: Must be async (never block request responses)

---

## Hackathon Constraints & Fallbacks

### Timeline

| Day | Hours | Key Objective |
|-----|-------|---------------|
| Day 0 | ~2h | Environment setup, external service accounts, x402 SDK testing |
| Day 1 | 8h | Proxy Core (morning) + Policy Engine (afternoon) |
| Day 2 | 9h | Curation+Cache (morning) + Analytics (afternoon) + Integration tests (evening) |
| Day 3 | 8h | Dashboard UI (morning) + Demo+Pitch+Deployment (afternoon) |

### MVP Scope (Included)

- 8 core modules: Proxy Core, Policy Engine, Curation Engine, Cache Layer, Analytics Collector, ERC-8004 Audit Trail, Subgraph Client, Smart Request
- 16 MCP tools: wallet (2), proxy (1), smart (1), policy (3), curation (4), analytics (3), audit (2)
- Two wallet modes: Local ethers.Wallet + Coinbase CDP Server Wallet
- ERC-8004 smart contracts deployed on SKALE (ReputationRegistry + ValidationRegistry)
- The Graph subgraph indexing on-chain payment feedback
- Web Dashboard (analytics, policy management, API rankings)
- 10-step demo script passing end-to-end with real x402 payments
- Multi-chain support (Base Sepolia, BSC) via chain_id column

### MVP Scope (Excluded — Post-hackathon)

- Approval workflow
- Anomaly detection
- Background aggregation jobs
- Advanced Dashboard charts/animations

### Fallback Strategy

| Risk | Fallback |
|------|----------|
| x402 SDK integration failure | Mock x402 server (simulate 402 responses) |
| Upstash Redis connection failure | Local Redis (Docker) or In-memory Map |
| Supabase connection failure | Local PostgreSQL (Docker) |
| Insufficient curation data | Seed data (synthetic metrics) |
| Dashboard time shortage | Basic tables only (Tailwind, skip charts) |
| Deployment failure | localhost demo + recorded video |

> **Day 0**: Must verify the actual API surface of `@x402/fetch` SDK — confirm `X402Client`, `fetch()`, and payment header parsing behavior.

---

## Do's and Don'ts

### DO

- Use BigInt for USDC amounts (1 USDC = `"1000000"`)
- Validate Policy before every proxy request
- Verify all 4 cache conditions before storing in cache
- Log all requests to Analytics asynchronously
- Store and look up API Keys via SHA-256 hash
- Hash Passwords with bcrypt(12)
- Check existing `.env` file and extend it (never overwrite)

### DON'T

- Sign payments in the proxy — only the Agent signs
- Use `parseFloat` / `Number` for USDC
- Skip Policy validation
- Store API Keys in plaintext (hash only)
- Block request responses with Analytics writes
- Use the `pg` package (use `postgres`)
- Use `@upstash/redis` (use `ioredis` TCP for Fly.io deployment)
- Create a separate `api_keys` table (MVP uses `users.api_key_hash`)

---

## Reference Documents

See the `docs/` directory for detailed documentation:

| Document | Contents |
|----------|----------|
| [docs/01-PRODUCT-BRIEF.md](docs/01-PRODUCT-BRIEF.md) | Product overview, positioning, target users |
| [docs/03-TECH-SPEC.md](docs/03-TECH-SPEC.md) | Architecture, component details, performance targets |
| [docs/04-API-SPEC.md](docs/04-API-SPEC.md) | Detailed API endpoint definitions |
| [docs/05-DB-SCHEMA.md](docs/05-DB-SCHEMA.md) | DB schema DDL, Redis key patterns |
| [docs/06-DEV-TASKS.md](docs/06-DEV-TASKS.md) | Development tasks by day |
| [docs/07-01-PITCH-SCRIPT.md](docs/07-01-PITCH-SCRIPT.md) | Pitch script |
| [docs/08-BUSINESS-MODEL.md](docs/08-BUSINESS-MODEL.md) | Business model |
| [docs/00-GLOSSARY.md](docs/00-GLOSSARY.md) | Glossary |
