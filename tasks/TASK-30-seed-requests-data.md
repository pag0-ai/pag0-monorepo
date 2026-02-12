# TASK-30: seed에 synthetic requests 데이터 추가

**Priority**: P0 (데모 품질)
**Status**: TODO
**Phase**: 9 (Demo Polish)

## 문제

seed.sql에 `requests` 테이블 데이터가 없음. Dashboard analytics의 4개 API(summary, endpoints, costs, cache)가 모두 requests 테이블을 조회하므로, seed 직후 대시보드에 `totalRequests: 0`, 빈 차트, 빈 테이블만 표시됨.

## 영향

해커톤 데모에서 "Empty State CTA"만 보여 실데이터 기반 대시보드를 시연할 수 없음.

## 수정

- seed.sql에 50~100개의 synthetic request 레코드 추가
- 다양한 endpoint, 비용, 지연시간, 캐시 히트 분포
- 최근 7일에 걸쳐 분포시켜 차트가 의미 있게 표시되도록

## 수정 파일

- `packages/proxy/src/db/seed.sql`
