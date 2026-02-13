# TASK-42: Policy field name alignment across all packages (R2)

**Priority**: P0 (cross-package data contract)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: dashboard, mcp
**Related**: TASK-39 (proxy side modification complete, R1)

## Problem

In R1, TASK-39 changed proxy's policy response field names from `dailyLimit`/`monthlyLimit` -> `dailyBudget`/`monthlyBudget`, but dashboard and MCP packages were still using the old field names. This caused a P0 bug where `undefined` values were rendered when editing/displaying policies.

## Changes

### packages/dashboard/lib/api.ts
- `Policy` interface: `dailyLimit` -> `dailyBudget`, `monthlyLimit` -> `monthlyBudget`

### packages/dashboard/app/policies/page.tsx
- `handleEdit()`: `policy.dailyLimit` -> `policy.dailyBudget`, `policy.monthlyLimit` -> `policy.monthlyBudget`
- Policy table rendering: same field name changes (2 places)

### packages/mcp/src/tools/policy.ts
- `pag0_list_policies` response type: `dailyLimit` -> `dailyBudget`, `monthlyLimit` -> `monthlyBudget`

## Completion criteria

- [x] Dashboard Policy interface uses `dailyBudget`/`monthlyBudget`
- [x] Dashboard policies page renders with correct field names
- [x] MCP policy tool response type matches proxy API
- [x] All 3 packages (proxy, dashboard, mcp) use the same field names
