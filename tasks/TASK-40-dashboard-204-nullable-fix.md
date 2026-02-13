# TASK-40: Dashboard fetchApi 204 Handling + Category Nullable Fields

**Priority**: P1 (Runtime Error Prevention)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: dashboard

## Problem

### 1. 204 No Content Not Handled
`fetchApi` throws JSON parsing error when calling `res.json()` on DELETE response (204 No Content).

### 2. Category Fields Nullable
Backend `/api/curation/categories` response has `description` that can be null, and `avgScore` is also null for categories without endpoint_scores.

## Changes

1. `fetchApi`: Add `res.status === 204` check, return `undefined as T`
2. `Category` interface: `description: string | null`, `avgScore: number | null`

## Modified Files

- `packages/dashboard/lib/api.ts`

## Completion Criteria

- [x] No JSON parsing error on 204 No Content response
- [x] Category nullable fields have accurate TypeScript types
