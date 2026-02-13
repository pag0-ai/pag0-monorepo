# TASK-08: Analytics API Routes

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1.5 hours |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md), [TASK-06](./TASK-06-analytics-collector.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md), [TASK-13](./TASK-13-dashboard-metrics.md) |

## Goal

Implement 4 Analytics API endpoints to provide statistical data for the Dashboard.

## Implementation Files

### `packages/proxy/src/routes/analytics.ts`

### Endpoint List

| Method | Path | Description |
|--------|------|------|
| GET | `/summary` | Overall summary statistics |
| GET | `/endpoints` | Detailed metrics per endpoint |
| GET | `/costs` | Cost time series data |
| GET | `/cache` | Cache performance analysis |

### GET `/summary` — Overall Summary

**Query Parameters**: `period` (`1h`, `24h`, `7d`, `30d`, default `7d`)

**Response Structure** (`docs/04-API-SPEC.md` Section 3.1):
```typescript
{
  period: string;
  totalRequests: number;
  cacheHitRate: number;       // 0.0 - 1.0
  avgLatency: number;         // ms
  successRate: number;        // 0.0 - 1.0
  totalCost: string;          // USDC
  cacheSavings: string;       // USDC
  topEndpoints: Array<{ endpoint, requestCount, cost }>;
  budgetUsage: {
    daily: { limit, spent, remaining, percentage };
    monthly: { limit, spent, remaining, percentage };
  };
}
```

**Core SQL** (`docs/05-DB-SCHEMA.md` Query 5.3):
```sql
SELECT
  COUNT(*) as total_requests,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as cache_hit_rate,
  AVG(latency_ms) as avg_latency,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  SUM(cost) as total_cost,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as cache_savings
FROM requests
WHERE project_id = $1 AND created_at >= NOW() - INTERVAL $2
```

**period → SQL interval conversion**: `1h` → `'1 hour'`, `24h` → `'24 hours'`, `7d` → `'7 days'`, `30d` → `'30 days'`

### GET `/endpoints` — Metrics Per Endpoint

**Query Parameters**: `period`, `limit` (default 20), `orderBy` (default `requestCount`)

**Core SQL** (`docs/05-DB-SCHEMA.md` Query 5.5):
```sql
SELECT endpoint, COUNT(*) as request_count,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hit_count,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  ...
FROM requests WHERE project_id = $1 AND created_at >= ...
GROUP BY endpoint ORDER BY request_count DESC LIMIT $2
```

### GET `/costs` — Cost Time Series

**Query Parameters**: `period`, `granularity` (`hourly`, `daily`, `monthly`)

```sql
SELECT DATE_TRUNC($1, created_at) as timestamp,
  SUM(cost) as spent,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as saved,
  COUNT(*) as request_count
FROM requests WHERE project_id = $2 AND created_at >= ...
GROUP BY DATE_TRUNC($1, created_at)
ORDER BY timestamp DESC
```

### GET `/cache` — Cache Performance

```sql
SELECT
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as hit_count,
  SUM(CASE WHEN NOT cached THEN 1 ELSE 0 END) as miss_count,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate
FROM requests WHERE project_id = $1 AND created_at >= ...
```

## Test Patterns

`prepare-hackathon/test-business-logic-day2.ts` — **Test 5**: PG summary/endpoint queries
`prepare-hackathon/test-business-logic-day3.ts` — **Tests 3, 4, 5**: Dashboard summary, cost timeseries, cache analytics

## Test Method

```bash
pnpm dev:proxy

# Summary
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/summary?period=7d"

# Endpoints
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/endpoints?limit=10"

# Costs
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/costs?period=30d&granularity=daily"

# Cache
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/cache?period=7d"
```

## Completion Criteria

- [x] 4 analytics endpoints implemented
- [x] period parameter → SQL interval conversion
- [x] budgetUsage included (summary)
- [x] topEndpoints included (summary)
- [x] Local curl tests pass (based on seed data)

## Bug Fix History

- **SQL interval bug fix**: `${sql(interval)}::interval` → `${interval}::interval` (6 locations). The `sql()` function generates SQL identifiers (column names), resulting in quotes like `"24 hours"` which causes `column "24 hours" does not exist` error. Changed to string parameter for proper `'24 hours'::interval` casting.
- **budget query fix**: Since `budgets` table lacks `daily_limit`/`monthly_limit` columns, modified to LEFT JOIN with `policies` table to fetch limit values.
