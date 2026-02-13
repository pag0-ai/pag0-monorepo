# TASK-17: Local E2E Integration Test

| Item | Details |
|------|------|
| **Package** | `packages/proxy` (all) |
| **Estimated Time** | 1.5 hours |
| **Dependencies** | [TASK-11](./TASK-11-integration.md) (backend integration complete) |
| **Blocks** | [TASK-18](./TASK-18-demo-scenarios.md) |

## Objective

Perform E2E testing of all backend API endpoints in local environment with all backend components integrated.

## Prerequisites

```bash
# Start Docker services (PostgreSQL + Redis)
pnpm docker:up

# DB schema + seed data
pnpm db:migrate && pnpm db:seed

# Start Proxy server
pnpm dev:proxy
# → Service running at http://localhost:3000
```

## Test Scenarios

### Reference: prepare-hackathon Test Code

`prepare-hackathon/test-business-logic-day1.ts` (7 Suites):
- USDC arithmetic, Policy Engine, Cache Key/isCacheable, Budget Tracker, Rate Limiter, x402 header parsing, API Key authentication

`prepare-hackathon/test-business-logic-day2.ts` (7 Suites):
- Curation score calculation, recommendation/comparison, Cache TTL/invalidation, Analytics Redis MULTI, PG request logging, Score caching, anomaly detection

`prepare-hackathon/test-business-logic-day3.ts` (7 Suites):
- DB schema creation, Budget atomic update, Dashboard Analytics Summary, Cost time series, Cache Analytics, Endpoint Score CRUD, Full Proxy Flow simulation

---

### 1. Health Check & 404

```bash
# Health check
curl -s http://localhost:3000/health | jq .
# → { "status": "ok", "timestamp": "..." }

# 404 handler
curl -s http://localhost:3000/nonexistent | jq .
# → { "error": { "code": "NOT_FOUND", "message": "..." } }
```

### 2. Auth Flow

```bash
# User registration
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@pag0.io","password":"Test1234!","name":"Test User"}' | jq .
# → { "user": {...}, "apiKey": "pag0_live_..." }

# Store API Key
API_KEY=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@pag0.io","password":"Test1234!","name":"E2E"}' | jq -r '.apiKey')

# Authentication failure
curl -s http://localhost:3000/api/policies \
  -H "X-Pag0-API-Key: invalid_key" | jq .
# → 401 Unauthorized

# Authentication success
curl -s http://localhost:3000/api/policies \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 200 policies array

# Check current user
curl -s http://localhost:3000/api/auth/me \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { "user": { "id": ..., "email": "e2e@pag0.io" } }
```

### 3. Policy CRUD

```bash
# Create policy
POLICY_ID=$(curl -s -X POST http://localhost:3000/api/policies \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{
    "name": "E2E Test Policy",
    "maxPerRequest": "5000000",
    "dailyBudget": "50000000",
    "monthlyBudget": "500000000",
    "allowedEndpoints": ["api.openai.com", "api.anthropic.com"]
  }' | jq -r '.id')

# Get policy
curl -s http://localhost:3000/api/policies/$POLICY_ID \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# Update policy
curl -s -X PUT http://localhost:3000/api/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"dailyBudget": "100000000"}' | jq .

# Delete policy
curl -s -X DELETE http://localhost:3000/api/policies/$POLICY_ID \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 200 (soft delete)
```

### 4. Analytics Endpoints

```bash
# Summary (based on seed data)
curl -s "http://localhost:3000/api/analytics/summary?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { totalRequests, cacheHitRate, avgLatency, totalCost, cacheSavings }

# Endpoint statistics
curl -s "http://localhost:3000/api/analytics/endpoints?period=24h&limit=5" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → endpoints array

# Cost time series
curl -s "http://localhost:3000/api/analytics/costs?period=7d&granularity=daily" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { timeseries: [{timestamp, spent, saved}] }

# Cache performance
curl -s "http://localhost:3000/api/analytics/cache?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { hitRate, totalHits, totalMisses, bytesSaved }
```

### 5. Curation Endpoints

```bash
# Category list
curl -s http://localhost:3000/api/curation/categories \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 8 categories (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)

# AI category rankings
curl -s "http://localhost:3000/api/curation/rankings?category=AI" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → Rankings list based on seed data

# Recommendations
curl -s "http://localhost:3000/api/curation/recommend?category=AI&limit=3" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# Compare
curl -s "http://localhost:3000/api/curation/compare?endpoints=api.openai.com,api.anthropic.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# Individual score
curl -s "http://localhost:3000/api/curation/score/api.openai.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { endpoint, overall, cost, latency, reliability }
```

### 6. Rate Limiting Verification

```bash
# Trigger rate limit with rapid consecutive requests
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code} " \
    http://localhost:3000/api/policies \
    -H "X-Pag0-API-Key: $API_KEY"
done
echo ""
# → 60 × 200 responses, then 429 responses start (Free tier: 60 req/min)
```

### 7. CORS Verification

```bash
# Preflight
curl -s -X OPTIONS http://localhost:3000/api/policies \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null
# → Access-Control-Allow-Origin: http://localhost:3001
```

## Running prepare-hackathon Tests

```bash
# Day 1 business logic tests
bun run prepare-hackathon/test-business-logic-day1.ts

# Day 2 business logic tests
bun run prepare-hackathon/test-business-logic-day2.ts

# Day 3 business logic tests (requires DB connection)
bun run prepare-hackathon/test-business-logic-day3.ts
```

## Completion Criteria

- [x] Health check 200 response
- [x] 404 handler working properly
- [x] Complete auth flow (register → API Key → authentication success/failure)
- [x] Complete policy CRUD (create → get → update → delete)
- [x] 4 Analytics endpoints responses verified
- [x] 5 Curation endpoints responses verified
- [x] Rate limiting working (429 response)
- [x] CORS preflight normal
- [x] prepare-hackathon tests passed

## Bug Fix History

- **Rate limit test added**: Added Section 8 to `scripts/e2e-test.sh` — verify 429 response with 65 consecutive requests + verify `X-RateLimit-*` headers exist.
