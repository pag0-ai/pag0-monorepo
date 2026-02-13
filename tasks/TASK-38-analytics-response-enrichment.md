# TASK-38: Analytics Response Enrichment — topEndpoints cost, endpoints total, costs summary

**Priority**: P1 (Data Integrity)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: proxy

## Problem

Analytics API responses were missing fields required by frontend/MCP.

### /analytics/summary — cost missing in topEndpoints
- Before: Only returned `{ endpoint, requestCount }`
- After: Added `{ endpoint, requestCount, cost }` (added `COALESCE(SUM(cost), 0) as total_cost` to SQL)

### /analytics/endpoints — total count missing
- Before: `{ endpoints: [...] }`
- After: `{ endpoints: [...], total: N }`

### /analytics/costs — period summary missing
- Before: `{ timeseries: [...] }`
- After: `{ timeseries: [...], total: { spent, saved, requests } }` (BigInt sum)

## Modified Files

- `packages/proxy/src/routes/analytics.ts`

## Completion Criteria

- [x] topEndpoints includes cost field
- [x] endpoints response includes total count
- [x] costs response includes total summary (BigInt-safe sum)
