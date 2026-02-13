# TASK-34: Handle error states across all pages

**Priority**: P1 (UX)
**Status**: ✅ Complete (commit `1333ada`)
**Phase**: 9 (Demo Polish)

## Problem

Dashboard, Rankings, Policies pages don't handle `useQuery` `isError`/`error` states. Only blank screen displays when API server is down or network error occurs.

Additionally, Policies `deleteMutation` lacks `onError` callback, providing no user feedback on deletion failure.

## Fix

1. Add error state UI to each page ("Something went wrong" + retry button)
2. Add onError callback to Policies deleteMutation

## Completion Criteria

- [ ] Dashboard page: Display error banner + Retry button on API error
- [ ] Rankings page: Display error banner + Retry button on API error
- [ ] Policies page: Display error banner + Retry button on API error
- [ ] Policies deleteMutation has `onError` callback → display error message on deletion failure
- [ ] Clicking Retry in error state re-requests data

## Verification Results

- [x] Dashboard: `summaryError || costsError || endpointsError` → AlertCircle + RefreshCw Retry ✅
- [x] Rankings: `rankingsError` → AlertCircle + RefreshCw Retry ✅
- [x] Policies: `policiesError` → AlertCircle + RefreshCw Retry ✅
- [x] deleteMutation `onError`: `setDeleteError(error.message)` → error display in delete dialog ✅
- [x] Retry: `summaryRefetch()`, `rankingsRefetch()`, `policiesRefetch()` connected ✅
- [x] `next build` success ✅

## Modified Files

- `packages/dashboard/app/dashboard/page.tsx`
- `packages/dashboard/app/rankings/page.tsx`
- `packages/dashboard/app/policies/page.tsx`
