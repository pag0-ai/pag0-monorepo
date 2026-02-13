# TASK-43: Analytics Cache response enrichment (R2)

**Priority**: P0 (API Spec alignment)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: proxy
**Related**: TASK-38 (analytics summary/costs enrichment, R1), requirements.md P0-3

## Problem

`CacheAnalytics` response defined in API Spec (04-API-SPEC.md) was missing `bypassCount`, `avgCacheAge`, and per-endpoint `hitRate`/`savings` fields. Issue identified in R1 requirements.md P0-3.

## Changes

### packages/proxy/src/routes/analytics.ts

#### CachePerformance interface extension
- Added `bypassCount: number` (always 0 in MVP)
- Added `avgCacheAge: number` (average age in seconds of cached requests)
- Added `topCachedEndpoints[].hitRate: number` (per-endpoint cache hit rate)
- Added `topCachedEndpoints[].savings: string` (per-endpoint savings amount)

#### SQL query improvements
- Added `avg_cache_age` calculation to cache stats query (`AVG(EXTRACT(EPOCH FROM NOW() - created_at))` for cached requests)
- Changed top cached endpoints query to be based on all requests to enable per-endpoint hit rate calculation
- Added `HAVING SUM(CASE WHEN cached THEN 1 ELSE 0 END) > 0` condition to filter only endpoints with cache hits

#### Response mapping enrichment
- `bypassCount: 0` (MVP placeholder)
- `avgCacheAge: Math.round(Number(stats.avg_cache_age))`
- per-endpoint `hitRate`, `savings` mapping

## Completion criteria

- [x] CachePerformance includes `bypassCount` field
- [x] CachePerformance includes `avgCacheAge` field (in seconds)
- [x] topCachedEndpoints includes per-endpoint `hitRate`/`savings`
- [x] SQL query safely aggregates BigInt
- [x] API Spec P0-3 requirements met
