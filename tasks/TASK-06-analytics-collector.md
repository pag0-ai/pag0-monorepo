# TASK-06: Analytics Collector

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-05](./TASK-05-proxy-core.md), [TASK-08](./TASK-08-analytics-routes.md) |

## Objective

Implement AnalyticsCollector to collect and store metrics for all proxy requests. Dual storage in PostgreSQL (persistent) and Redis (real-time counters).

## Implementation Files

### `packages/proxy/src/analytics/collector.ts` — AnalyticsCollector

**Core Methods**:

1. **`logRequest(log: RequestLog)`** — Async, fire-and-forget
   - INSERT into PG `requests` table
   - Update real-time counters using Redis MULTI pipeline

2. **`updateCounters(log)`** — Redis MULTI pipeline
   ```
   Key: metrics:{projectId}:{endpoint}:hourly
   Fields: requestCount, cacheHitCount, errorCount, totalSpent, totalLatency
   TTL: 7200 seconds (2 hours)
   ```

**RequestLog Interface** (add to types/index.ts):
```typescript
interface RequestLog {
  projectId: string;
  endpoint: string;      // normalized hostname
  fullUrl: string;
  method: string;
  statusCode: number;
  cost: string;          // USDC BIGINT string
  cached: boolean;
  latencyMs: number;
  policyId?: string;
  cacheKey?: string;
}
```

**PG INSERT Query**:
```sql
INSERT INTO requests (
  project_id, endpoint, full_url, method, status_code,
  cost, cached, latency_ms, policy_id, cache_key
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

**Redis MULTI Pipeline**:
```typescript
await redis.multi()
  .hincrby(key, 'requestCount', 1)
  .hincrby(key, 'cacheHitCount', log.cached ? 1 : 0)
  .hincrby(key, 'errorCount', log.statusCode >= 400 ? 1 : 0)
  .hincrbyfloat(key, 'totalSpent', parseFloat(log.cost))
  .hincrby(key, 'totalLatency', log.latencyMs)
  .expire(key, 7200)
  .exec();
```

## Test Patterns

`prepare-hackathon/test-business-logic-day2.ts`:
- **Test 4 (Analytics Pipeline)**: Redis MULTI, log 3 requests, verify counters
- **Test 5 (PG Request Logging)**: INSERT 6 requests, summary/per-endpoint aggregation queries

## Async Logging Pattern

When calling from ProxyCore, **NEVER await**:
```typescript
// Good — fire and forget
this.analytics.logRequest(log).catch(err => console.error('Analytics error:', err));

// Bad — blocks request response
await this.analytics.logRequest(log);
```

## Testing Method

```bash
# Requires Redis + PG connection
pnpm docker:up

# Day 2 test (Analytics pipeline + PG logging)
cd prepare-hackathon && bun run test-business-logic-day2.ts
# → Check "4. Analytics Collector — Redis MULTI Pipeline"
# → Check "5. Analytics — PostgreSQL Request Logging & Aggregation"
```

## Notes

- `hincrbyfloat` for totalSpent: stored as float in Redis (for real-time aggregation)
- Stored as BIGINT in PG (source of truth)
- Redis counters expire after 2 hours (longer than hourly aggregation cycle)
- logRequest errors must not affect proxy response (ignore via catch)

## Completion Criteria

- [x] AnalyticsCollector class implemented
- [x] PG requests table INSERT working
- [x] Redis MULTI pipeline counter updates working
- [x] Async pattern applied (fire-and-forget)
- [x] Local metrics collection tests passing
