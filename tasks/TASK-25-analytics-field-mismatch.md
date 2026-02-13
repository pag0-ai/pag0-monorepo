# TASK-25: Fix Analytics Field Name Mismatch

**Priority**: HIGH
**Status**: ✅ Completed
**Phase**: 5 (Dashboard with Data)

## Problem

Analytics API response field names and frontend interface mismatch.

### /analytics/endpoints
| Frontend | Backend |
|-----------|--------|
| `avgLatency` | `avgLatencyMs` |
| `cacheHitRate` (ratio) | `cacheHitCount` (count) |

### /analytics/costs
| Frontend | Backend |
|-----------|--------|
| `cost` | `spent` + `saved` |

### /analytics/cache
| Frontend | Backend |
|-----------|--------|
| `totalHits` | `hitCount` |
| `totalMisses` | `missCount` |
| `savedCost` | `totalSavings` |

## Files to Modify

- `packages/dashboard/lib/api.ts` — Fix `EndpointMetrics`, `CostDataPoint`, `CacheStats` interfaces
- `packages/dashboard/app/dashboard/page.tsx` — Fix chart data mapping
