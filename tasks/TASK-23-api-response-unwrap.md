# TASK-23: API Response Unwrapping — Frontend/Backend Data Contract Alignment

**Priority**: HIGH (causing all dashboard pages to break)
**Status**: ✅ Complete
**Phase**: 5 (Dashboard with Data)

## Problem

The backend returns responses wrapped in wrapper objects, but the frontend `fetchApi<T>` expects the response itself as data.

| Endpoint | Backend Returns | Frontend Expects |
|----------|----------------|------------------|
| `GET /api/policies` | `{ policies: [...], total }` | `Policy[]` |
| `GET /api/analytics/endpoints` | `{ endpoints: [...] }` | `EndpointMetrics[]` |
| `GET /api/analytics/costs` | `{ timeseries: [...] }` | `CostDataPoint[]` |
| `GET /api/analytics/cache` | `{ hitCount, missCount, ... }` | `{ totalHits, totalMisses, ... }` |
| `GET /api/curation/rankings` | `{ data: [...] }` | `EndpointScore[]` |
| `GET /api/curation/categories` | `{ data: [...] }` | `Category[]` |

## Fix Method

Unwrap responses in each fetch function in `packages/dashboard/lib/api.ts`:

```typescript
// Before
export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  return fetchApi('/api/policies', { apiKey });
}

// After
export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  const res = await fetchApi<{ policies: Policy[] }>('/api/policies', { apiKey });
  return res.policies;
}
```

## Impact Scope

- `packages/dashboard/lib/api.ts` — 6 functions modified
- All dashboard, policies, and rankings pages affected
