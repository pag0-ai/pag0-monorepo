# TASK-25: Analytics 필드명 불일치 수정

**Priority**: HIGH
**Status**: ✅ 완료
**Phase**: 5 (Dashboard with Data)

## 문제

Analytics API 응답 필드명과 프론트엔드 인터페이스 불일치.

### /analytics/endpoints
| 프론트엔드 | 백엔드 |
|-----------|--------|
| `avgLatency` | `avgLatencyMs` |
| `cacheHitRate` (ratio) | `cacheHitCount` (count) |

### /analytics/costs
| 프론트엔드 | 백엔드 |
|-----------|--------|
| `cost` | `spent` + `saved` |

### /analytics/cache
| 프론트엔드 | 백엔드 |
|-----------|--------|
| `totalHits` | `hitCount` |
| `totalMisses` | `missCount` |
| `savedCost` | `totalSavings` |

## 수정 파일

- `packages/dashboard/lib/api.ts` — `EndpointMetrics`, `CostDataPoint`, `CacheStats` 인터페이스 수정
- `packages/dashboard/app/dashboard/page.tsx` — 차트 데이터 매핑 수정
