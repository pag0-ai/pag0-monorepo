# TASK-27: Dashboard Budget Display — Mock → Real Data

**Priority**: HIGH
**Status**: ✅ Completed
**Phase**: 5 (Dashboard with Data)

## Problem

`packages/dashboard/app/dashboard/page.tsx` lines 68-73:
```typescript
// Budget data (mock for MVP - replace with actual budget API)
const dailyBudget = { spent: 5_000_000, limit: 10_000_000 };
const monthlyBudget = { spent: 120_000_000, limit: 300_000_000 };
```

Backend `/api/analytics/summary` response already includes `budgetUsage`:
```json
{
  "budgetUsage": {
    "daily": { "limit": "10000000", "spent": "0", "remaining": "10000000", "percentage": 0 },
    "monthly": { "limit": "100000000", "spent": "0", ... }
  }
}
```

## Fix

Replace hardcoded values with `summary.budgetUsage`.

## Files to Modify

- `packages/dashboard/app/dashboard/page.tsx` — Remove mock, use summary data
