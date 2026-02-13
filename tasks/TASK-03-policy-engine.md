# TASK-03: Policy Engine + Budget Tracker

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1.5 hours |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-05](./TASK-05-proxy-core.md), [TASK-07](./TASK-07-policy-routes.md) |

## Objective

Implement PolicyEngine that performs policy validation before proxy requests, and BudgetTracker that tracks daily/monthly budgets.

## Implementation Files

### 1. `packages/proxy/src/policy/engine.ts` — PolicyEngine

**evaluate(req) validation order** (5 steps):
1. **Blocked endpoint check** — Reject if included in `blockedEndpoints` array
2. **Allowed endpoint check** — Allow all if empty array, otherwise match against whitelist
3. **Per-request limit** — Reject if `cost > maxPerRequest`
4. **Daily budget** — Reject if `dailySpent + cost > dailyBudget`
5. **Monthly budget** — Reject if `monthlySpent + cost > monthlyBudget`

**Endpoint matching**: Supports wildcard patterns (`*.openai.com`)
```typescript
private matchPattern(hostname: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(hostname);
}
```

**Return type**:
```typescript
interface PolicyEvaluation {
  allowed: boolean;
  reason?: 'ENDPOINT_BLOCKED' | 'ENDPOINT_NOT_WHITELISTED' |
           'PER_REQUEST_LIMIT_EXCEEDED' | 'DAILY_BUDGET_EXCEEDED' |
           'MONTHLY_BUDGET_EXCEEDED';
  details?: string;
}
```

### 2. `packages/proxy/src/policy/budget.ts` — BudgetTracker

**Redis-based budget tracking**:
- Keys: `budget:{projectId}:daily`, `budget:{projectId}:monthly`
- Atomic increment via INCRBY
- TTL: daily = until midnight UTC, monthly = until end of month
- Methods: `getDailySpent()`, `getMonthlySpent()`, `deduct()`

**PostgreSQL synchronization**:
- Update `budgets` table on payment success (atomic UPDATE ... RETURNING)
- Redis is cache, PG is source of truth

## Test Patterns

Reference `prepare-hackathon/test-business-logic-day1.ts`:
- **Test 2 (Policy Engine)**: 6 scenarios — allowed, blocked, not whitelisted, limit exceeded, daily exceeded, monthly exceeded
- **Test 4 (Budget Tracker)**: Redis INCRBY, TTL setup, cumulative tracking

## USDC Amount Handling Rules

- **Always use BigInt comparison**: `BigInt(cost) > BigInt(policy.maxPerRequest)`
- **Never use parseFloat**: 1 USDC = `"1000000"` (string BIGINT)
- DB storage: BIGINT column, Redis storage: string

## Test Method

```bash
# Unit tests (budget tracker)
# Requires Docker local Redis
bun test src/policy/

# Or use prepare-hackathon tests
cd prepare-hackathon && bun run test-business-logic-day1.ts
```

## Completion Criteria

- [x] PolicyEngine class implementation (5-step validation)
- [x] BudgetTracker class implementation (Redis + PG)
- [x] Wildcard pattern matching (`*.openai.com`)
- [x] BigInt-based amount comparison (no parseFloat)
- [x] Local policy validation logic tests passed
- [x] PolicyEngine unit tests written (20 tests, `engine.test.ts`)

## Bug Fix History

- **engine.ts SQL column name fix**: `daily_limit`/`monthly_limit` → `daily_budget`/`monthly_budget`. Fixed mismatch with actual column names in DB schema (`policies` table).
- **budget.ts checkBudget() fix**: `budgets` table doesn't have `daily_limit`/`monthly_limit` columns. Modified to LEFT JOIN with `policies` table to fetch limit values.
- **budget.ts recordSpend() fix**: Removed non-existent `daily_limit`/`monthly_limit` columns from INSERT query.
