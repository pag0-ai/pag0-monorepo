# TASK-09: Curation API Routes

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1.5 hours |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md), [TASK-15](./TASK-15-ranking-board.md) |

## Objective

Implement the Curation Engine (scoring algorithm) and 5 API endpoints. Endpoint score calculation, recommendation, comparison, ranking, and category lookup.

## Implementation Files

### 1. `packages/proxy/src/curation/engine.ts` — CurationEngine

**Scoring Algorithm** (`docs/03-TECH-SPEC.md` Section 2.5.2):

```typescript
// Cost Score: Lower cost = higher score
scoreCost(avgCost, benchmarkCost): number {
  const ratio = avgCost / benchmarkCost;
  if (ratio >= 2) return 0;
  if (ratio <= 0.5) return 100;
  return 100 * (1 - (ratio - 0.5) / 1.5);
}

// Latency Score: Lower latency = higher score (same formula)
scoreLatency(p95Latency, benchmarkLatency): number

// Reliability Score: Higher success rate = higher score
scoreReliability(successRate): number {
  return Math.min(100, successRate * 100);
}

// Overall = cost*0.4 + latency*0.3 + reliability*0.3
calculateOverallScore(cost, latency, reliability, weights?)
```

**Methods**:
- `calculateScore(endpoint, category)` — Calculate score based on 30-day metrics
- `getScore(endpoint)` — Redis cache first, fallback to PG query
- `recommend(category, limit, sortBy?)` — Recommendations by category
- `compare(endpoints[])` — Compare 2-5 endpoints
- `getBenchmarks(category)` — Category average (benchmark)

### 2. `packages/proxy/src/routes/curation.ts` — API Routes

| Method | Path | Description |
|--------|------|------|
| GET | `/recommend` | Recommendations by category |
| GET | `/compare` | Compare endpoints |
| GET | `/rankings` | Rankings by category |
| GET | `/categories` | List categories |
| GET | `/score/:endpoint` | Individual score lookup |

### GET `/recommend`

**Query**: `category` (required), `limit` (default 5), `weights` (optional, `cost:0.5,latency:0.3,reliability:0.2`)

```sql
SELECT * FROM endpoint_scores
WHERE category = $1
ORDER BY overall_score DESC
LIMIT $2
```

### GET `/compare`

**Query**: `endpoints` (comma-separated, 2-5 endpoints)

Response includes `winner` (winner for each dimension: overall, cost, latency, reliability).

### GET `/rankings`

**Query**: `category` (optional), `limit` (default 20), `orderBy` (default `overall`)

### GET `/categories`

```sql
SELECT c.name, c.endpoint_count,
  ROUND(AVG(es.overall_score), 2) as avg_score
FROM categories c
LEFT JOIN endpoint_scores es ON es.category = c.name
GROUP BY c.name, c.endpoint_count
```

### GET `/score/:endpoint`

Redis cache first (`score:{endpoint}`, TTL 300s). On miss, query from PG and store in Redis.

## Test Patterns

`prepare-hackathon/test-business-logic-day2.ts`:
- **Test 1 (Curation Scoring)**: Verify scoreCost, scoreLatency, scoreReliability formulas
- **Test 2 (Recommendation & Comparison)**: recommend (top-N), compare (winner per dimension)
- **Test 6 (Score Caching)**: Redis score:{endpoint} pattern

`prepare-hackathon/test-business-logic-day3.ts`:
- **Test 6 (Endpoint Score CRUD)**: UPSERT, ranking, category aggregation

## Testing Method

```bash
pnpm dev:proxy

# Recommendation
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/recommend?category=AI&limit=5"

# Comparison
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/compare?endpoints=api.openai.com,api.anthropic.com"

# Rankings
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/rankings?category=AI"

# Categories
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/categories"

# Score
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/score/api.openai.com"
```

## When Data is Insufficient

seed.sql already contains 5 sample endpoint_scores. If additional seed data is needed, add to `db/seed.sql`.

## Completion Criteria

- [x] CurationEngine scoring algorithm implementation (3 dimensions + overall)
- [x] 5 curation endpoints implementation
- [x] Redis score caching (TTL 300s)
- [x] Winner calculation per dimension in compare
- [x] Local API testing with seed data passes
