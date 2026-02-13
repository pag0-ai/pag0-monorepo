# Pag0 Smart Proxy - Product Overview

> **TL;DR**: Pag0 is the only smart proxy layer in the x402 ecosystem, providing policy-based budget management (Spend Firewall), real usage data-driven API curation, and intelligent caching (40%+ cost savings) in a single solution. It is a 3-in-1 middleware that enables AI Agent developers to use x402 APIs safely and efficiently.

## Related Documents

| Document | Relevance |
|----------|-----------|
| [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) | Competitor analysis and positioning |
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | Architecture and technical details |
| [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) | Business model details |
| [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) | User scenarios |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Glossary |

## One-Line Summary

**Pag0 is a smart proxy layer for the x402 ecosystem, a 3-in-1 solution providing policy-based budget management, real usage data-driven API curation, and intelligent caching.**

## Problem Definition

### 1. Lack of Cost Control

When AI Agent developers use x402 payment requests directly, there is a risk of unnecessary costs from duplicate requests and budget overruns. In enterprise environments, team-level/project-level budget management and approval processes are needed, but no layer in the current x402 ecosystem provides this.

### 2. Inefficiency from Repeated Requests

Even when repeatedly querying the same data, payment occurs every time. Without a caching layer, unnecessary costs and wait times are incurred.

### 3. Insufficient API Selection Information

x402 Bazaar only provides service listings, and SlinkyLayer's reputation system relies on subjective reviews. Developers need objective comparisons based on actual cost, performance, and reliability data.

## Solution: 3-in-1 Value

### 1. Cost Reduction

- Prevent duplicate payments with intelligent caching
- Target **40%+ cost savings**
- Real-time savings tracking based on cache hit rate

### 2. Spend Control

- Policy-based budget management: per-request/daily/monthly limits
- Whitelist/Blacklist-based endpoint control
- Threshold-based approval workflows
- Anomaly detection and alerts

### 3. Curation

- API scoring based on real usage data (cost/latency/reliability)
- Category-based rankings and recommendations
- API comparison tools
- Objective decision-making support

## Core Features

| Feature | Description | Core Value |
|---------|-------------|------------|
| **Proxy Core** | x402 request relay, CDP Wallet-based payment signing automation | Transparent x402 integration |
| **CDP Wallet (MCP)** | Coinbase Server Wallet integration, automatic 402→sign→retry handling, balance management | Agent autonomous payments |
| **Policy Engine** | Budget limits, whitelist/blacklist, approval workflows | Spend control |
| **Cache Layer** | Redis-based response caching, TTL management, pattern-based rules | 40%+ cost savings |
| **Analytics Collector** | Tracks request count, latency (P50/P95/P99), success rate, cost, cache hit rate | Data-driven optimization |
| **Curation Engine** | Endpoint scoring, ranking, recommendations, comparisons | Objective API selection |
| **ERC-8004 Audit Trail** | On-chain payment proof recording via ReputationRegistry.giveFeedback(), IPFS metadata storage | Trustworthy audit trail |

## Positioning

```
[x402 Ecosystem Layer Map]

┌─────────────────────────────────────────────────┐
│ AI Agents (Virtuals G.A.M.E., Google ADK, etc.) │
└─────────────────────────────────────────────────┘
                      ↓ MCP Tool Call
┌─────────────────────────────────────────────────┐
│ ★ pag0-mcp (Agent Interface) ★                  │ ← MCP Server
│ (CDP Wallet + Pag0 SDK + Tool Endpoints)        │
│  - Receive 402 → CDP Wallet sign → Auto-retry   │
└─────────────────────────────────────────────────┘
                      ↓ pag0.fetch()
┌─────────────────────────────────────────────────┐
│ ★ Pag0 Smart Proxy Layer ★                      │ ← The only proxy layer
│ (Policy + Curation + Cache + Analytics)         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ x402 Protocol (@x402/fetch SDK)                 │
│ + Facilitator (Payment Verification)            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ x402 Servers (Data/Service Providers)           │
└─────────────────────────────────────────────────┘

[Supporting Layers]
- x402 Bazaar: Service discovery (Facilitator-centric)
- SlinkyLayer: Reputation system (subjective review-based)
- Coinbase CDP: Wallet infrastructure (Server Wallet)
- ERC-8004 Registry: On-chain audit trail (Identity/Reputation/Validation)
```

**Key Differentiator**: The Payment layer and Discovery/Reputation are already saturated. **The Proxy/Control layer is a vacant market** → Pag0 captures first-mover advantage.

## Target Users

### Primary: AI Agent Developers

- **Pain Points**: Budget management, cost optimization, API selection
- **Use Cases**: Agent development, prototyping, production deployment
- **Value**: Rapid development, predictable costs, data-driven decision-making

### Secondary: Enterprise IT/Finance Teams

- **Pain Points**: Team-level budget management, approval processes, reporting
- **Use Cases**: Multi-project management, budget allocation, cost analysis
- **Value**: Centralized control, transparent reporting, compliance

## Technology Stack

| Layer | Technology | Selection Rationale |
|-------|-----------|-------------------|
| Runtime | Bun / Node.js | Fast development, native TypeScript |
| Framework | Hono | Lightweight, Edge-compatible, fast routing |
| Wallet | Coinbase CDP (Server Wallet) | API-based wallet management, delegated key custody |
| Agent Interface | pag0-mcp (MCP Server) | Standard AI Agent interface, built-in CDP Wallet |
| Cache | Redis (Upstash) | Serverless, global low-latency |
| Database | PostgreSQL (Supabase) | Relational data, powerful queries |
| Blockchain | SKALE | Zero Gas (free on-chain metrics) |
| Indexing | The Graph | Payment event + ERC-8004 Feedback subgraph |
| On-chain Audit | ERC-8004 (ReputationRegistry) | On-chain payment proof recording, trustless audit trail |
| Hosting | Cloudflare Workers / Fly.io | Edge deployment, global distribution |

```yaml
# Technology Stack Summary
tech_stack:
  runtime: "Bun / Node.js"
  framework: "Hono"
  wallet: "Coinbase CDP (Server Wallet)"
  agent_interface: "pag0-mcp (MCP Server)"
  cache: "Redis (Upstash)"
  database: "PostgreSQL (Supabase)"
  blockchain: "SKALE (Zero Gas)"
  indexing: "The Graph"
  onchain_audit: "ERC-8004 (ReputationRegistry)"
  hosting: "Cloudflare Workers / Fly.io"
```

## MVP Scope (3 Days)

```yaml
# MVP Scope
target_timeline: "3 days (hackathon)"
core_features:
  - "Proxy Core (x402 request relay)"
  - "Policy Engine (budget limits, whitelist/blacklist)"
  - "Cache Layer (Redis-based response caching)"
  - "Analytics Collector (metric collection/storage)"
  - "Curation Engine (score calculation, recommendation API)"
  - "Web Dashboard (visualization, management)"
deliverables:
  - "Deployed production endpoint"
  - "3 scenario demos"
  - "Pitch Deck"
```

### Day 1: Proxy Core + Policy Engine

- ✅ x402 request proxying (402 response parsing, payment relay)
- ✅ Budget limit validation (per-request/daily/monthly)
- ✅ Whitelist/Blacklist endpoint filtering
- ✅ Policy CRUD API

### Day 2: Curation + Cache + Analytics

- ✅ Curation Engine (score calculation, recommendation API)
- ✅ Redis caching (key generation based on URL+Method+Body)
- ✅ TTL management and pattern-based rules
- ✅ Metrics collection and storage (PostgreSQL)
- ✅ Analytics API (summary, endpoints, costs, cache)

### Day 3: Dashboard + Demo + Pitch

- ✅ Web Dashboard (metrics visualization, policy management)
- ✅ API Ranking Board (scores by category)
- ✅ Agent demo scripts (scenario-based)
- ✅ Pitch Deck + Deployment (Fly.io/Vercel)

## Success Metrics

### Hackathon (3 Days)

- ✅ Working MVP (all core features functional)
- ✅ Agent demo (3 scenarios: policy enforcement, cache savings, curation)
- ✅ Deployed production endpoint
- ✅ Completed Pitch Deck

### Post-Hackathon (3 Months)

- **100 agents MAU** (monthly active agents)
- **100K requests/day** (daily proxy requests)
- **30%+ average cost savings** (caching effectiveness)
- **70%+ recommendation adoption rate** (curation quality)
- **500+ indexed endpoints** (ecosystem coverage)

```yaml
# Success Metrics
hackathon_kpi:
  working_mvp: true
  demo_scenarios: 3
  production_endpoint: true
  pitch_deck: true
post_hackathon_kpi:
  mau_agents: 100
  daily_requests: 100000
  avg_cost_savings: "30%+"
  recommendation_adoption: "70%+"
  indexed_endpoints: 500
```

## Business Model

### Freemium Tier

- Free basic tier: 1,000 requests/day
- Basic policies and caching
- Analytics dashboard

### Cache Savings Share

- **15% fee** on cache savings
- Users still benefit from net savings (85% profit)
- Automatic usage-based billing

### Pro Subscription

- Unlimited requests
- Advanced policies (approval workflows, anomaly detection)
- Detailed Analytics + Curation
- Priority support
- **$99/month** (initial pricing)

---

## Hackathon Sponsor Integration

- **Coinbase**: x402 Protocol usage (core integration)
- **SKALE**: On-chain metrics storage (zero gas)
- **The Graph**: Payment event + ERC-8004 Feedback subgraph (transparency)
- **ERC-8004**: ReputationRegistry on-chain audit trail (Trustless Agent Framework)
- **Google Cloud**: ADK agent orchestration (demo scenario)
- **Virtuals**: G.A.M.E. SDK (optional agent creation)

---

**Version**: 1.0 (Hackathon MVP)
**Last Updated**: 2026-02-10
