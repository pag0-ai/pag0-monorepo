# Pag0 — The Smart Proxy Layer for x402

> **One-liner:** Pag0 is the only smart proxy layer for the x402 ecosystem, giving AI agents **spend control**, **data-driven API curation**, and **smart caching** — all through a single middleware.

**Quick Links**

- **Demo Video (YouTube):** <https://youtu.be/lyAwe-EQnMU>
- **Demo Setup & Run Guide:** <https://github.com/pag0-ai/pag0-monorepo/blob/main/guides/1-RUN-MCP-AGENT-SCRIPT.md>

---

## The Problem

AI agents can now pay for APIs with x402. But **paying ≠ managing spending.**

| Pain Point | Impact |
|---|---|
| **No budget control** | Agents can overspend without limits — one runaway loop costs hundreds of dollars |
| **Blind API selection** | 100s of x402 APIs exist, but no objective data to compare cost, speed, or reliability |
| **Duplicate payments** | Agents repeat identical requests, paying every time — redundant calls waste real money |

x402 solved **how** agents pay. Pag0 solves **how much**, **how smart**, and **how efficiently** they pay.

---

## The Solution: 3-in-1 Smart Proxy

```
AI Agent ──→ Pag0 Proxy ──→ x402 Server
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
  Spend    Data-Driven  Smart
  Firewall  Curation    Cache
```

### 1. Spend Firewall (Policy Engine)

Per-request, daily, and monthly budget limits. Whitelist/blacklist endpoints. Automatic blocking on policy violation.

### 2. Data-Driven API Curation

Initial API catalog sourced from [x402 Bazaar](https://docs.x402.org/extensions/bazaar). Every request flowing through Pag0 then generates real usage data (cost, latency, reliability), enabling objective scoring, ranking, recommendation, and comparison of x402 APIs.

### 3. Smart Cache

Redis-based response caching with configurable TTL. Identical requests served from cache — no duplicate payments.

**Security invariant:** The proxy **never signs payments** — it only relays. Agents keep full custody of their wallets.

---

## Working Demo (10/10 Steps Passed)

We built a fully functional MCP server that lets any AI agent (Claude, GPT, etc.) use Pag0 tools natively. Here's what the live demo proves:

| Demo Step | What It Shows | Result |
|---|---|---|
| **Wallet Status** | CDP Server Wallet integration | 0.65 USDC balance, Base Sepolia |
| **Budget Check** | Daily/monthly spend tracking | 10 USDC/day, 100 USDC/month policy enforced |
| **API Recommendations** | Curation engine scoring | Top 3 AI Agent APIs ranked by score (82.3, 78.0, 44.0) |
| **Endpoint Comparison** | Head-to-head API comparison | Staging endpoint wins all dimensions (97.8% reliability, 320ms latency) |
| **x402 Payment** | Real on-chain payment via proxy | 0.5 USDC paid, 201 response, budget auto-updated |
| **Smart Selection** | Auto-pick best endpoint + pay | Best endpoint selected by score, called via x402 |
| **Spending Report** | Real-time cost analytics | 1.54 USDC spent across 35 requests, per-endpoint breakdown |
| **Endpoint Score** | Individual quality scoring | Cost/latency/reliability breakdown with evidence |
| **Transaction History** | Full audit trail | 69 requests across 5 endpoints with latency percentiles |
| **On-Chain Audit** | ERC-8004 feedback on SKALE | **134 on-chain events** indexed via subgraph — every payment is auditable |

---

## Architecture & Tech Stack

```
┌───────────────────────────────────────────────┐
│  AI Agents (Claude Code, GPT, Google ADK)     │
└──────────────────┬────────────────────────────┘
                   │ MCP Tool Call 
┌──────────────────▼────────────────────────────┐
│  pag0-mcp (MCP Server + CDP Wallet)           │
│  402 → sign → retry, all automated            │
└──────────────────┬────────────────────────────┘
                   │ pag0.fetch() 
┌──────────────────▼────────────────────────────┐
│  Pag0 Smart Proxy (Hono + Bun)                │
│  ┌─────────┬──────────┬───────────┬─────────┐ │
│  │ Policy  │ Cache    │ Curation  │Analytics│ │
│  │ Engine  │ Layer    │ Engine    │Collector│ │
│  └─────────┴──────────┴───────────┴─────────┘ │
└──────────────────┬────────────────────────────┘
                   │ 
┌──────────────────▼────────────────────────────┐
│  x402 Protocol + Facilitator (Base Sepolia)   │
└───────────────────────────────────────────────┘
```

| Layer | Technology | Sponsor |
|---|---|---|
| **Proxy Runtime** | Hono + Bun | — |
| **Wallet** | Coinbase CDP Server Wallet | **Coinbase** |
| **x402 Payments** | @x402/fetch SDK (Base Sepolia, USDC) | **Coinbase** |
| **On-Chain Audit** | ERC-8004 ReputationRegistry | **SKALE** (zero gas) |
| **Subgraph** | The Graph (Goldsky) | **The Graph** |
| **Cache** | Redis (Upstash / ioredis) | — |
| **Database** | PostgreSQL (Supabase) | — |
| **Dashboard** | Next.js + Tailwind + Recharts | — |
| **Deployment** | Fly.io (backend) + Vercel (frontend) | — |

---

## Sponsor Technology Integration

| Sponsor | Integration | Depth |
|---|---|---|
| **Coinbase (x402)** | Core payment protocol. CDP Server Wallet for gasless agent payments. EIP-3009 `transferWithAuthorization` for off-chain USDC signatures. | **Deep** |
| **SKALE** | Zero-gas on-chain audit trail via ERC-8004 `ReputationRegistry.giveFeedback()`. Every x402 payment generates a verifiable on-chain feedback event. 224 events recorded in demo. | **Medium** |
| **The Graph** | Subgraph indexing all ERC-8004 FeedbackGiven events from SKALE. Powers the `pag0_audit_trail` MCP tool for transparent, queryable payment history. | **Medium** |

---

## Market Opportunity

- **Positioning:** "Auth0 built the identity layer on OAuth ($6.5B exit). Pag0 builds the payment control layer on x402."
- **Timing:** x402 Phase 1 (protocol) and Phase 2 (facilitators) are done. **Phase 3 (platforms) is empty** — Pag0 fills it.
- **Moat:** Every request through Pag0 feeds the curation engine. More users = better recommendations = more users. Data network effect.
- **Zero direct competitors** in x402 proxy/control layer.

---

## What We Built (3-Day Hackathon)

- **5 core modules:** Proxy Core, Policy Engine, Curation Engine, Cache Layer, Analytics Collector
- **14 MCP tools:** wallet, proxy, policy, curation, analytics, smart request, audit trail
- **ERC-8004 smart contracts** deployed on SKALE (ReputationRegistry + ValidationRegistry)
- **The Graph subgraph** indexing on-chain payment feedback
- **Web dashboard** with real-time analytics, API rankings, and policy management
- **Full demo script** — 10/10 scenarios passing end-to-end with real x402 payments

---

## Links

- **Demo (Youtube)**: <https://youtu.be/lyAwe-EQnMU>
  - Demo CDP Wallet: [0xC9dDA748901f784D5919e55A6899d99DcE7b9cBE](https://base-sepolia.blockscout.com/address/0xC9dDA748901f784D5919e55A6899d99DcE7b9cBE?tab=token_transfers)
- **Github**: <https://github.com/pag0-ai/pag0-monorepo>
- **Dashboard**: <https://pag0-demo-dashboard.vercel.app>
- **API**: <https://pag0-monorepo.fly.dev>
- **Contracts**:
  - ReputationRegistry: [0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131](https://base-sepolia-testnet-explorer.skalenodes.com:10032/address/0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131)
- **Subgraph**: <https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1.1.0/gn>
