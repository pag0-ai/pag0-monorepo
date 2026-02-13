# TASK-16: MCP Server Integration Test

| Item | Details |
|------|------|
| **Package** | `packages/mcp` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-11](./TASK-11-integration.md) (backend completion required) |
| **Blocks** | [TASK-18](./TASK-18-demo-scenarios.md) |

## Objective

Perform integration testing to verify that the MCP Server communicates properly with the actual Proxy backend.

## Current State

- `packages/mcp/` — 12 MCP Tools implemented
  - `tools/wallet.ts` — `pag0_wallet_status`
  - `tools/proxy.ts` — `pag0_request` (402→sign→retry)
  - `tools/policy.ts` — `pag0_check_budget`, `pag0_check_policy`, `pag0_list_policies`
  - `tools/curation.ts` — `pag0_recommend`, `pag0_compare`, `pag0_rankings`, `pag0_score`
  - `tools/analytics.ts` — `pag0_spending`, `pag0_cache_stats`, `pag0_tx_history`
- `client.ts` — Pag0 Proxy API HTTP client
- `wallet.ts` — ethers.Wallet wrapper

## Test Items

### 1. MCP → Proxy Connection Verification

```bash
# With backend running
cd packages/mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx ts-node src/index.ts
# → Returns list of 11 tools
```

### 2. Policy Tools Test

```bash
# pag0_list_policies
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pag0_list_policies","arguments":{}}}' | npx ts-node src/index.ts
# → Returns policies array

# pag0_check_budget
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pag0_check_budget","arguments":{}}}' | npx ts-node src/index.ts
# → Includes daily_remaining, monthly_remaining
```

### 3. Curation Tools Test

```bash
# pag0_rankings (AI category)
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"pag0_rankings","arguments":{"category":"AI"}}}' | npx ts-node src/index.ts
# → Rankings based on endpoint_scores

# pag0_recommend
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"pag0_recommend","arguments":{"category":"AI","limit":3}}}' | npx ts-node src/index.ts
# → Recommended endpoints list
```

### 4. Analytics Tools Test

```bash
# pag0_spending
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"pag0_spending","arguments":{"period":"24h"}}}' | npx ts-node src/index.ts
# → Spending summary

# pag0_cache_stats
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"pag0_cache_stats","arguments":{}}}' | npx ts-node src/index.ts
# → Cache hit/miss statistics
```

### 5. client.ts Endpoint Mapping Verification

Verify that API paths in MCP `client.ts` match Proxy routes:

| MCP client Method | Proxy Route |
|-------------------|-------------|
| `listPolicies()` | `GET /api/policies` |
| `checkBudget()` | `GET /api/analytics/summary` |
| `getRankings(category)` | `GET /api/curation/rankings?category=` |
| `getRecommendations(...)` | `GET /api/curation/recommend?category=` |
| `compareEndpoints(...)` | `GET /api/curation/compare?endpoints=` |
| `getSpending(period)` | `GET /api/analytics/costs?period=` |
| `getCacheStats()` | `GET /api/analytics/cache` |

## Environment Variables Check

`packages/mcp/.env`:
```
PAG0_API_URL=http://localhost:3000
PAG0_API_KEY=pag0_live_{valid_key_from_seed}
WALLET_PRIVATE_KEY={test_wallet_key}
NETWORK=skale-testnet
```

## Test Method

```bash
# 1. Run Backend + DB
pnpm docker:up
pnpm db:migrate && pnpm db:seed
pnpm dev:proxy

# 2. Verify MCP Tool list
cd packages/mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run src/index.ts

# 3. Test each tool call (refer to items above)

# 4. Verify error cases
# → Appropriate error message when calling with invalid API Key
# → Empty result when querying non-existent category
```

## Completion Criteria

- [x] MCP Server startup + tool list returned
- [x] Policy tools (list, check_budget, check_policy) working properly
- [x] Curation tools (rankings, recommend, compare, score) working properly
- [x] Analytics tools (spending, cache_stats, tx_history) working properly
- [x] Verified client.ts API paths match Proxy routes
- [x] Error case handling verified
