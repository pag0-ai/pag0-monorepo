# TASK-43: Analytics Cache 응답 보강 (R2)

**Priority**: P0 (API Spec 정렬)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: proxy
**Related**: TASK-38 (analytics summary/costs 보강, R1), requirements.md P0-3

## 문제

API Spec (04-API-SPEC.md)에서 정의한 `CacheAnalytics` 응답에 `bypassCount`, `avgCacheAge`, 그리고 per-endpoint `hitRate`/`savings` 필드가 누락되어 있었음. R1의 requirements.md P0-3에서 식별된 이슈.

## 수정 내용

### packages/proxy/src/routes/analytics.ts

#### CachePerformance 인터페이스 확장
- `bypassCount: number` 추가 (MVP에서는 항상 0)
- `avgCacheAge: number` 추가 (cached 요청의 평균 age 초)
- `topCachedEndpoints[].hitRate: number` 추가 (per-endpoint 캐시 적중률)
- `topCachedEndpoints[].savings: string` 추가 (per-endpoint 절약 금액)

#### SQL 쿼리 개선
- Cache stats 쿼리에 `avg_cache_age` 계산 추가 (`AVG(EXTRACT(EPOCH FROM NOW() - created_at))` for cached requests)
- Top cached endpoints 쿼리를 전체 요청 기반으로 변경하여 per-endpoint hit rate 계산 가능
- `HAVING SUM(CASE WHEN cached THEN 1 ELSE 0 END) > 0` 조건으로 캐시 히트가 있는 엔드포인트만 필터

#### 응답 매핑 보강
- `bypassCount: 0` (MVP placeholder)
- `avgCacheAge: Math.round(Number(stats.avg_cache_age))`
- per-endpoint `hitRate`, `savings` 매핑

## 완료 기준

- [x] CachePerformance에 `bypassCount` 필드 포함
- [x] CachePerformance에 `avgCacheAge` 필드 포함 (초 단위)
- [x] topCachedEndpoints에 per-endpoint `hitRate`/`savings` 포함
- [x] SQL 쿼리가 BigInt 안전하게 합산
- [x] API Spec P0-3 요구사항 충족
