# TASK-18: Demo Scenario Preparation

| Item | Details |
|------|------|
| **Package** | All (proxy + dashboard + mcp) |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-17](./TASK-17-e2e-test.md), [TASK-16](./TASK-16-mcp-integration.md), [TASK-13](./TASK-13-dashboard-metrics.md)~[TASK-15](./TASK-15-ranking-board.md) |
| **Blocks** | None (final task) |

## Objective

Prepare 3 demo scenarios for hackathon judging and create scripts to execute each scenario in sequence.

## 3 Core Demo Scenarios

### Scenario 1: Spend Firewall (Policy Enforcement)

**Story**: AI Agent attempts API call exceeding budget limit → Pag0 blocks it

```bash
# 1. Check current budget (MCP or curl)
curl -s "http://localhost:3000/api/analytics/summary?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq '{dailySpent, dailyBudget, monthlySpent, monthlyBudget}'

# 2. Small request → Success
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.openai.com/v1/chat/completions","method":"POST","body":{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}}' | jq .
# → Proxy forwards normally (or 402 → payment flow)

# 3. Budget-exceeding request → Blocked
# (with policy having low dailyBudget)
curl -s -X PUT http://localhost:3000/api/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"dailyBudget": "100"}' | jq .
# → 403 POLICY_VIOLATION (budget exceeded)

# 4. Check blocked records in Dashboard
# → http://localhost:3001/dashboard to verify metrics
```

**Demo Point**: Policy-based automatic blocking → Prevents agent overspending

### Scenario 2: Smart Cache (Cost Savings)

**Story**: When repeating identical requests, cache hit saves 40%+ costs

```bash
# 1. First request → Cache MISS (actual API call)
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.example.com/data","method":"GET"}' | jq '{cached, cost, latency}'
# → { cached: false, cost: "500000", latency: 150 }

# 2. Identical request → Cache HIT (instant response, cost 0)
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.example.com/data","method":"GET"}' | jq '{cached, cost, latency}'
# → { cached: true, cost: "0", latency: 3 }

# 3. Check cache statistics
curl -s "http://localhost:3000/api/analytics/cache?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { hitRate: 50.0, totalHits: 1, totalMisses: 1, bytesSaved: ... }

# 4. Verify Cache Savings visualization in Dashboard
# → http://localhost:3001/dashboard Cache Savings card
```

**Demo Point**: Automatic caching makes identical requests cost 0 → 40%+ total savings

### Scenario 3: API Curation (Recommendation & Comparison)

**Story**: Recommend optimal API endpoints to Agent and provide comparison information

```bash
# 1. Query AI category rankings
curl -s "http://localhost:3000/api/curation/rankings?category=AI" \
  -H "X-Pag0-API-Key: $API_KEY" | jq '.[] | {rank, endpoint, overall, cost, latency, reliability}'

# 2. Request recommendations (cost priority)
curl -s "http://localhost:3000/api/curation/recommend?category=AI&limit=3&sortBy=cost" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 3. Compare endpoints (Anthropic vs OpenAI)
curl -s "http://localhost:3000/api/curation/compare?endpoints=api.anthropic.com,api.openai.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 4. Visualize in Dashboard Rankings page
# → http://localhost:3001/rankings
# → Change category filter, score badge colors, comparison panel
```

**Demo Point**: Scoring based on actual usage data → Agent can make optimal choice

## MCP Agent Demo (Optional)

MCP Server integration with Claude Desktop or Claude Code:

```
User: "Check my budget status"
Agent → pag0_check_budget → "Using $12.50 of daily budget $50 (25%)"

User: "Recommend the best API in AI category"
Agent → pag0_recommend(category="AI") → "Recommend api.anthropic.com (92 points)"

User: "Compare OpenAI and Anthropic"
Agent → pag0_compare(endpoints=["api.openai.com","api.anthropic.com"]) → Comparison table
```

## Demo Setup Script

```bash
#!/bin/bash
# scripts/demo-setup.sh

echo "=== Pag0 Demo Setup ==="

# 1. Check Docker services
echo "Starting Docker services..."
pnpm docker:up

# 2. DB migration + seed
echo "Setting up database..."
pnpm db:migrate
pnpm db:seed

# 3. Start backend
echo "Starting proxy server..."
pnpm dev:proxy &
sleep 3

# 4. Start dashboard
echo "Starting dashboard..."
pnpm dev:dashboard &
sleep 5

# 5. Health check
echo "Verifying services..."
curl -s http://localhost:3000/health | jq .
curl -s -o /dev/null -w "Dashboard: %{http_code}\n" http://localhost:3001

echo ""
echo "=== Demo Ready ==="
echo "Proxy:     http://localhost:3000"
echo "Dashboard: http://localhost:3001"
echo ""
echo "Demo API Key (from seed): check .env or seed output"
```

## Pitch Script Reference

See `docs/07-01-PITCH-SCRIPT.md` — 3-minute pitch structure:
1. **Problem Statement** (30 sec) — Agent overspending problem
2. **Solution** (1 min) — Pag0 3-in-1: Firewall + Cache + Curation
3. **Demo** (1 min) — 3 scenarios live
4. **Business** (30 sec) — Fee model, market size

## Completion Criteria

- [x] Scenario 1: Policy enforcement demo working
- [x] Scenario 2: Cache hit/miss + cost savings demo working
- [x] Scenario 3: Curation ranking/recommendation/comparison demo working
- [x] Demo setup script created (`scripts/demo-setup.sh`)
- [x] All 3 Dashboard pages showing data verified
- [x] Complete demo rehearsal completed once

## Bug Fix History

- **demo-scenarios.sh bash escape fix**: Password `Demo1234!`'s `!` was interpreted as bash history expansion causing JSON parse error. Changed to single-quote JSON body + removed `!` from password.
- **Demo rehearsal results**: All 3 scenarios passed verification (Scenario 1: Spend Firewall, Scenario 2: Smart Cache, Scenario 3: API Curation).
