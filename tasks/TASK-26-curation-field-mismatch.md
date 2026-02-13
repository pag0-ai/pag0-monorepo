# TASK-26: Fix Curation Score Field Name Mismatch

**Priority**: HIGH
**Status**: ✅ Completed
**Phase**: 6 (Curation/Rankings)

## Problem

Backend curation score field names do not match frontend interface.

| Frontend | Backend |
|-----------|--------|
| `overall` | `overallScore` |
| `cost` | `costScore` |
| `latency` | `latencyScore` |
| `reliability` | `reliabilityScore` |
| `id` (Category) | (none) |

## Impact

- All scores in ranking table show `NaN` or `undefined`
- Category filter ID matching fails

## Files to Modify

- `packages/dashboard/lib/api.ts` — Fix `EndpointScore`, `Category` interfaces
- `packages/dashboard/app/rankings/page.tsx` — Update score references
