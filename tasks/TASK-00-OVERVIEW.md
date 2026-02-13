# Pag0 MVP Implementation Task Overview

> Starting Day 1~3 implementation with Day 0 preparation complete
> **Last updated**: 2026-02-12 (Phase 12 P1 enrichment + script enhancement tasks added)

## Current Status Summary

| Package | Status | Completion | Notes |
|--------|------|--------|------|
| `packages/proxy` | **Complete** (Phase 11 R2 fixes done) | 100% | TASK-43, 44 applied (cache enrichment + JSON validation) |
| `packages/dashboard` | **Complete** (Phase 11 R2 field alignment done) | 100% | TASK-42 applied (policy field alignment) |
| `packages/mcp` | **Complete** (Phase 11 R2 field alignment done) | 100% | TASK-42 applied (policy field alignment) |
| `packages/contracts` | **Deployed** (SKALE bite-v2-sandbox) | 100% | ReputationRegistry + ValidationRegistry |
| `subgraph/` | **Deployed** (Goldsky) | 100% | Agent, FeedbackEvent indexing |
| `prepare-hackathon/` | Day 0 validation complete | 100% | - |

### Overall Progress: 44/47 complete (93.6%) + 1 manual pending (TASK-22 Deployment) + 3 script enhancement pending

## Dependency Graph

```
TASK-01 (DB/Redis Client)
  ├─→ TASK-02 (Auth Middleware)
  ├─→ TASK-03 (Policy Engine)
  ├─→ TASK-04 (Cache Layer)
  ├─→ TASK-06 (Analytics Collector)
  └─→ TASK-09 (Curation API Routes)

TASK-02 (Auth Middleware)
  └─→ TASK-11 (index.ts Integration)

TASK-03 (Policy Engine)
  └─→ TASK-05 (Proxy Core)
       └─→ TASK-11 (index.ts Integration)

TASK-04 (Cache Layer)
  └─→ TASK-05 (Proxy Core)

TASK-06 (Analytics Collector)
  └─→ TASK-05 (Proxy Core)

TASK-07 (Policy CRUD Routes)  ← TASK-01
TASK-08 (Analytics Routes)    ← TASK-01, TASK-06
TASK-09 (Curation Routes)     ← TASK-01
TASK-10 (Auth Routes)         ← TASK-01

TASK-11 (index.ts Integration) ← TASK-02, TASK-05, TASK-07~10

TASK-12 (Dashboard Layout)    ← (independent)
TASK-13 (Dashboard Metrics)   ← TASK-12, TASK-08
TASK-14 (Policy Management UI) ← TASK-12, TASK-07
TASK-15 (API Ranking Board)   ← TASK-12, TASK-09

TASK-16 (MCP Integration Test) ← TASK-11
TASK-17 (Integration Test E2E) ← TASK-11
TASK-18 (Demo Scenarios)      ← TASK-17

TASK-19 (CDP Wallet)          ← TASK-16
TASK-20 (ERC-8004 Audit)      ← TASK-05, TASK-19
TASK-21 (ERC-8004 MCP+Graph)  ← TASK-20, TASK-16
TASK-37 (Subgraph Query)      ← TASK-20, TASK-21
TASK-22 (Deployment)          ← TASK-11, TASK-12
```

## Task List

### Phase 1: Infrastructure + Core Logic (Day 1 Morning)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-01](./TASK-01-db-redis-client.md) | ~~DB/Redis Client Setup~~ | proxy | 30min | ✅ Complete |
| [TASK-02](./TASK-02-auth-middleware.md) | ~~Auth Middleware + Rate Limiter~~ | proxy | 1hr | ✅ Complete |
| [TASK-03](./TASK-03-policy-engine.md) | ~~Policy Engine + Budget Tracker~~ | proxy | 1.5hr | ✅ Complete |
| [TASK-04](./TASK-04-cache-layer.md) | ~~Cache Layer (Redis)~~ | proxy | 1hr | ✅ Complete |

### Phase 2: Proxy Core + x402 (Day 1 Afternoon)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-05](./TASK-05-proxy-core.md) | ~~Proxy Core + x402 Integration~~ | proxy | 2hr | ✅ Complete |
| [TASK-06](./TASK-06-analytics-collector.md) | ~~Analytics Collector~~ | proxy | 1hr | ✅ Complete |

### Phase 3: API Routes (Day 2 Morning)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-07](./TASK-07-policy-routes.md) | ~~Policy CRUD Routes~~ | proxy | 1hr | ✅ Complete |
| [TASK-08](./TASK-08-analytics-routes.md) | ~~Analytics API Routes~~ | proxy | 1.5hr | ✅ Complete |
| [TASK-09](./TASK-09-curation-routes.md) | ~~Curation API Routes~~ | proxy | 1.5hr | ✅ Complete |
| [TASK-10](./TASK-10-auth-routes.md) | ~~Auth Routes (register/login/me)~~ | proxy | 1hr | ✅ Complete |

### Phase 4: Integration (Day 2 Afternoon)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-11](./TASK-11-integration.md) | ~~index.ts Integration + Error Handling~~ | proxy | 1hr | ✅ Complete |

### Phase 5: Dashboard (Day 3 Morning)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-12](./TASK-12-dashboard-layout.md) | ~~Dashboard Layout + Navigation~~ | dashboard | 1hr | ✅ Complete |
| [TASK-13](./TASK-13-dashboard-metrics.md) | ~~Dashboard Metrics Visualization~~ | dashboard | 1.5hr | ✅ Complete |
| [TASK-14](./TASK-14-policy-ui.md) | ~~Policy Management UI~~ | dashboard | 1hr | ✅ Complete |
| [TASK-15](./TASK-15-ranking-board.md) | ~~API Ranking Board~~ | dashboard | 1hr | ✅ Complete |

### Phase 6: Testing + Demo (Day 3 Afternoon)

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-16](./TASK-16-mcp-integration.md) | ~~MCP Server Integration Test~~ | mcp | 30min | ✅ Complete |
| [TASK-17](./TASK-17-e2e-test.md) | ~~Local Integration Test (E2E)~~ | all | 1.5hr | ✅ Complete |
| [TASK-18](./TASK-18-demo-scenarios.md) | ~~Demo Scenario Scripts~~ | all | 1hr | ✅ Complete |

### Phase 7: Extended Features — CDP Wallet + ERC-8004 + Deployment

| ID | Task | Package | Est. Time | Dependencies |
|----|--------|--------|-----------|--------|
| [TASK-19](./TASK-19-cdp-wallet.md) | ~~CDP Wallet Integration (Coinbase Server Wallet)~~ | mcp | 2~3hr | ✅ Complete |
| [TASK-20](./TASK-20-erc8004-audit.md) | ~~ERC-8004 Audit Trail (On-chain Audit Records)~~ | proxy | 3~4hr | ✅ Complete |
| [TASK-21](./TASK-21-erc8004-mcp-subgraph.md) | ~~ERC-8004 MCP Tools + The Graph Subgraph~~ | mcp, subgraph | 2~3hr | ✅ Complete |
| [TASK-22](./TASK-22-deployment.md) | Deployment (Fly.io + Vercel) | proxy, dashboard | 2hr | ⏳ Awaiting manual approval |
| [TASK-37](./TASK-37-subgraph-query-integration.md) | ~~Subgraph Query Integration (On-chain Reputation Read)~~ | proxy | 3~4hr | ✅ Complete |

### Phase 8: Storyboard Gap Fixes — Frontend/Backend Data Contract Alignment

| ID | Task | Package | Priority | Dependencies |
|----|--------|--------|----------|--------|
| [TASK-23](./TASK-23-api-response-unwrap.md) | ~~API Response Unwrapping (All fetch functions)~~ | dashboard | **HIGH** | ✅ Complete |
| [TASK-24](./TASK-24-policy-field-mismatch.md) | ~~Policy Field Name Mismatch Fix~~ | dashboard | **HIGH** | ✅ Complete |
| [TASK-25](./TASK-25-analytics-field-mismatch.md) | ~~Analytics Field Name Mismatch Fix~~ | dashboard | **HIGH** | ✅ Complete |
| [TASK-26](./TASK-26-curation-field-mismatch.md) | ~~Curation Score Field Name Mismatch Fix~~ | dashboard | **HIGH** | ✅ Complete |
| [TASK-27](./TASK-27-budget-mock-to-real.md) | ~~Dashboard Budget Mock → Real Data~~ | dashboard | **HIGH** | ✅ Complete |
| [TASK-28](./TASK-28-empty-state-ux.md) | ~~Empty Dashboard UX (CTA + Empty Charts)~~ | dashboard | **MEDIUM** | ✅ Complete |

> ~~**Core Issue**: Backend responds with wrapper objects like `{ data: [...] }`, `{ policies: [...] }`, but frontend fetch functions expect arrays directly.~~ **Resolved** (commit `7f02774`)

### Phase 9: Demo Polish — Seed Enhancement + UX Completion + Deployment Prep

| ID | Task | Package | Priority | Dependencies |
|----|--------|--------|----------|--------|
| [TASK-29](./TASK-29-seed-apikey-format.md) | ~~seed API key format fix (match auth regex)~~ | proxy | **P0** | ✅ Complete |
| [TASK-30](./TASK-30-seed-requests-data.md) | ~~Add synthetic requests data to seed~~ | proxy | **P0** | ✅ Complete |
| [TASK-31](./TASK-31-seed-more-endpoints.md) | ~~Expand seed endpoint_scores to all categories~~ | proxy | **P0** | ✅ Complete |
| [TASK-32](./TASK-32-onboarding-no-sidebar.md) | ~~Remove Onboarding/Login Sidebar~~ | dashboard | **P1** | ✅ Complete |
| [TASK-33](./TASK-33-compare-winner-display.md) | ~~Rankings Compare Winner Display~~ | dashboard | **P1** | ✅ Complete |
| [TASK-34](./TASK-34-error-state-handling.md) | ~~All Pages Error State Handling~~ | dashboard | **P1** | ✅ Complete |
| [TASK-35](./TASK-35-env-example-dashboard.md) | ~~Add Dashboard env vars to .env.example~~ | all | **P2** | ✅ Complete |
| [TASK-36](./TASK-36-nextconfig-rewrite-env.md) | ~~next.config rewrite environment branching~~ | dashboard | **P2** | ✅ Complete |

### Phase 10: API Contract Alignment — docs vs codebase gap resolution (2026-02-12)

> Fixing data contract mismatches identified based on Gap Analysis (.omc/gap-analysis.md) and Requirements Analysis (.omc/requirements.md).

| ID | Task | Package | Priority | Status |
|----|--------|--------|----------|------|
| [TASK-38](./TASK-38-analytics-response-enrichment.md) | Analytics response enrichment (topEndpoints cost, endpoints total, costs summary) | proxy | **P1** | ✅ Complete |
| [TASK-39](./TASK-39-policy-response-field-rename.md) | Policy response field name unification (dailyLimit → dailyBudget) | proxy, mcp | **P0** | ✅ Complete |
| [TASK-40](./TASK-40-dashboard-204-nullable-fix.md) | Dashboard fetchApi 204 handling + Category nullable fields | dashboard | **P1** | ✅ Complete |
| [TASK-41](./TASK-41-mcp-route-field-alignment.md) | MCP client/tools route and field name alignment | mcp | **P1** | ✅ Complete |

### Phase 11: R2 Cross-Package Alignment (2026-02-12)

> Based on R2 Gap Analysis (.omc/gap-analysis-r2.md) and R2 Requirements (.omc/requirements-r2.md).
> Resolving cross-package mismatches and API enrichment remaining after R1 commit.

| ID | Task | Package | Priority | Status |
|----|--------|--------|----------|------|
| [TASK-42](./TASK-42-policy-field-alignment-r2.md) | ~~Policy field name alignment across all packages (dailyBudget/monthlyBudget)~~ | dashboard, mcp | **P0** | ✅ Complete |
| [TASK-43](./TASK-43-analytics-cache-enrichment-r2.md) | ~~Analytics Cache response enrichment (bypassCount, avgCacheAge, per-endpoint stats)~~ | proxy | **P0** | ✅ Complete |
| [TASK-44](./TASK-44-policy-route-validation-r2.md) | ~~Policy Route JSON parsing error handling~~ | proxy | **P1** | ✅ Complete |

### Phase 12: P1 API Enrichment + Test Script Enhancement (2026-02-12)

> Resolving remaining P1 issues (JWT, analytics fields, curation differences/weights/evidence) and expanding test coverage.

| ID | Task | Package | Priority | Status |
|----|--------|--------|----------|------|
| P1-1 | Auth Login JWT token addition | proxy | **P1** | ✅ Complete |
| P1-2 | Curation response wrapping consistency check | proxy | **P1** | ✅ Complete (no changes) |
| P1-3 | Compare differences field addition | proxy | **P1** | ✅ Complete |
| P1-4 | Analytics /endpoints missing fields addition (6 fields) | proxy | **P1** | ✅ Complete |
| P1-5 | EndpointScore weights/evidence inclusion | proxy | **P1** | ✅ Complete |
| P1-6 | MCP/Dashboard P1 response synchronization | mcp, dashboard | **P1** | ✅ Complete |
| [TASK-45](./TASK-45-e2e-test-p1-coverage.md) | E2E test P1 coverage expansion (22→30) | scripts | **HIGH** | Pending |
| [TASK-46](./TASK-46-demo-scenarios-p1-enrich.md) | Demo scenario P1 feature reflection | scripts | **MEDIUM** | Pending |
| [TASK-47](./TASK-47-demo-mcp-reputation-step.md) | MCP Agent demo Reputation step addition | scripts | **LOW** | Pending |

> Commit: `a684cc3` — feat: P1 API enrichment (8 files, +235/-55)

### Not Started / Deferred

| ID | Task | Package | Priority | Status |
|----|--------|--------|----------|------|
| [TASK-22](./TASK-22-deployment.md) | Deployment (Fly.io + Vercel) | proxy, dashboard | - | ⏳ Awaiting manual approval |

### R2 Gap Analysis Remaining Items (Non-blocking for Deployment — Post-Deploy or Doc Updates)

> The following items were identified in R2 gap-analysis but are non-blocking for deployment:

**R2-P1 (Post-deployment improvements)**:
- **R2-P1-1**: `cacheBypass` param not connected to POST /proxy (R1 P0-9) — no demo impact
- **R2-P1-2**: `policyId` param not connected to POST /proxy (R1 P1-12) — no demo impact
- ~~**R2-P1-3**: Curation compare `differences` field missing~~ → ✅ Resolved in Phase 12 P1-3
- ~~**R2-P1-4**: Endpoint metrics `p50`/`p99`/`errorCount` fields missing~~ → ✅ Resolved in Phase 12 P1-4

**R2-P2 (Post-MVP)**:
- ~~**R2-P2-1**: `budgetRemaining` returns spent value~~ → ✅ Resolved in Phase 11 R2 commit `520de2d`
- ~~**R2-P2-2**: Curation score missing `weights`/`evidence` structures~~ → ✅ Resolved in Phase 12 P1-5
- **R2-P2-3**: Beyond-spec feature documentation (smart-request, reputation, 4-factor scoring)
- **R2-P2-4**: Auth response format doc update
- **R2-P2-5**: x402 PaymentInfo doc update

### Gap Analysis Findings (No Implementation Needed — Doc Updates or Post-MVP)

The following items were discovered in R1 gap-analysis but are documentation update targets or out-of-MVP-scope:

- **P2-1**: Approval workflow — MVP excluded (specified in CLAUDE.md)
- **P2-2**: Anomaly detection — MVP excluded
- **P2-3**: Background aggregation jobs — replaced with real-time queries in MVP
- **P2-6**: SDK package (`@pag0/sdk`) — Post-hackathon
- **P2-7**: Webhook support — Post-hackathon
- **P2-8**: Score history tracking — Post-hackathon

### Beyond-Spec Features (Bonus features implemented but not in docs)

- `/api/smart-request` — AI provider auto-selection + proxy
- `/api/reputation/*` — On-chain reputation profile/feedback/leaderboard
- `onChainReputation` field — On-chain reputation included in proxy response metadata
- 4-factor scoring — Existing 3-dimensional (cost/latency/reliability) + reputation
- CDP Wallet (Coinbase Server Wallet) — Dual wallet mode in MCP
- OAuth registration — Additional authentication flow

## Parallel Execution Groups

- **Group A** (independent): TASK-01
- **Group B** (parallel after TASK-01): TASK-02, TASK-03, TASK-04, TASK-06, TASK-09, TASK-10
- **Group C** (after TASK-03+04): TASK-05
- **Group D** (API Routes, parallel): TASK-07, TASK-08
- **Group E** (integration): TASK-11
- **Group F** (Dashboard, parallel after TASK-12): TASK-13, TASK-14, TASK-15
- **Group G** (final): TASK-16, TASK-17, TASK-18
- **Group H** (extended, after TASK-16): TASK-19, TASK-22 (parallel)
- **Group I** (after TASK-19): TASK-20
- **Group J** (after TASK-20): TASK-21
- **Group K** (Phase 10, parallel): TASK-38, TASK-39, TASK-40, TASK-41
- **Group L** (Phase 11 R2, parallel): TASK-42, TASK-43, TASK-44

## Reference Documents

- `docs/03-TECH-SPEC.md` — Architecture details
- `docs/04-API-SPEC.md` — API endpoint definitions
- `docs/05-DB-SCHEMA.md` — DB schema + Redis key patterns
- `docs/06-DEV-TASKS.md` — Original development tasks
- `.omc/gap-analysis.md` — R1 docs vs codebase gap analysis results
- `.omc/gap-analysis-r2.md` — R2 gap analysis (post-commit re-analysis)
- `.omc/requirements.md` — R1 gap-based requirements analysis
- `.omc/requirements-r2.md` — R2 remaining requirements and deployment readiness
- `.omc/change-log-r2.md` — R2 code change tracking
- `prepare-hackathon/test-business-logic-day1.ts` — Day 1 test patterns
- `prepare-hackathon/test-business-logic-day2.ts` — Day 2 test patterns
- `prepare-hackathon/test-business-logic-day3.ts` — Day 3 test patterns
