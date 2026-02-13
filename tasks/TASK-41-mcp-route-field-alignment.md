# TASK-41: MCP client/tools route and field name alignment

**Priority**: P1 (MCP tools not working)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: mcp

## Problem

API client and tool types in MCP package are misaligned with backend actual routes/responses.

### client.ts — Route path mismatch
`/api/reputation/*` routes were implemented in TASK-37, but MCP client.ts still uses `/api/audit/*` paths.

| Before (incorrect) | After (correct) |
|------------|-----------|
| `GET /api/audit/trail` | `GET /api/reputation/agent?id=` |
| `GET /api/audit/reputation/:endpoint` | `GET /api/reputation/feedbacks?agentId=` |
| (none) | `GET /api/reputation/leaderboard` |

### tools/analytics.ts — Field name mismatch
- `hitRate`/`savings` -> `cacheHits` (cache tool)
- `totalSpent` -> `totalCost` (endpoints tool)
- `p95LatencyMs` added (endpoints tool)

### tools/policy.ts — Field name direction issue
Changing `dailyBudget`/`monthlyBudget` -> `dailyLimit`/`monthlyLimit`, but proxy-dev is modifying in the opposite direction. Verification needed.

## Files to modify

- `packages/mcp/src/client.ts` — Restructure 3 reputation API methods
- `packages/mcp/src/tools/analytics.ts` — Fix cache/endpoints field names
- `packages/mcp/src/tools/policy.ts` — Field name verification needed

## Completion criteria

- [x] client.ts reputation route paths match `/api/reputation/*`
- [x] analytics tools field names match backend responses
- [x] policy tools field names match proxy policies.ts response (mcp-dev modification complete)
