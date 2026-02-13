# TASK-24: Policy Field Name Mismatch Fix

**Priority**: HIGH
**Status**: ✅ Complete
**Phase**: 3 (Policy Management)

## Problem

Frontend `Policy` interface field names differ from backend response.

| Frontend | Backend | Notes |
|----------|---------|-------|
| `whitelist` | `allowedEndpoints` | array |
| `blacklist` | `blockedEndpoints` | array |
| `enabled` | `isActive` | boolean |
| (none) | `maxPerRequest` | missing in creation |

## Impact

- All policies show as "Inactive" in policy list (`policy.enabled` = `undefined`)
- Whitelist/Blacklist always display as empty values
- `allowedEndpoints`, `blockedEndpoints` not passed during policy creation

## Files to Modify

- `packages/dashboard/lib/api.ts` — Fix `Policy`, `CreatePolicyData` interfaces
- `packages/dashboard/app/policies/page.tsx` — Update field name references
