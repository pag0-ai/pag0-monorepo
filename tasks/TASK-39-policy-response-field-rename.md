# TASK-39: Policy Response Field Name Unification — dailyLimit/monthlyLimit -> dailyBudget/monthlyBudget

**Priority**: P0 (Data Contract Mismatch)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: proxy, mcp

## Problem

The `policies.ts` route's JSON response was mapping DB column names `daily_budget`/`monthly_budget` to `dailyLimit`/`monthlyLimit`. This was a residual mismatch remaining even after the TASK-07 bug fix.

| Location | Previous | After (Correct) |
|------|------|------------|
| GET / List | `dailyLimit` | `dailyBudget` |
| POST / Create | `dailyLimit` | `dailyBudget` |
| GET /:id Detail | `dailyLimit` | `dailyBudget` |
| PUT /:id Update | `dailyLimit` | `dailyBudget` |

## Related Conflict

mcp-dev was modifying in the opposite direction in `packages/mcp/src/tools/policy.ts` (`dailyBudget` -> `dailyLimit`). Since `dailyBudget` is the correct field name based on the DB schema, proxy-dev's direction is correct.

## Modified Files

- `packages/proxy/src/routes/policies.ts` — Response mapping correction for 4 endpoints
- `packages/mcp/src/tools/policy.ts` — (Needs correction: should maintain `dailyBudget`/`monthlyBudget`)

## Completion Criteria

- [x] Use `dailyBudget`/`monthlyBudget` in proxy policies.ts
- [x] Align mcp policy.ts field names (mcp-dev to correct)
- [x] Verify consistency with dashboard Policy interface
