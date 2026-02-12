# TASK-30: seed에 synthetic requests 데이터 추가

**Priority**: P0 (데모 품질)
**Status**: ✅ 완료 (커밋 `edc7b84`)
**Phase**: 9 (Demo Polish)

## 문제

seed.sql에 `requests` 테이블 데이터가 없음. Dashboard analytics의 4개 API(summary, endpoints, costs, cache)가 모두 requests 테이블을 조회하므로, seed 직후 대시보드에 `totalRequests: 0`, 빈 차트, 빈 테이블만 표시됨.

## 영향

해커톤 데모에서 "Empty State CTA"만 보여 실데이터 기반 대시보드를 시연할 수 없음.

## 수정

- seed.sql에 50~100개의 synthetic request 레코드 추가
- 다양한 endpoint, 비용, 지연시간, 캐시 히트 분포
- 최근 7일에 걸쳐 분포시켜 차트가 의미 있게 표시되도록

## 완료 기준

- [ ] requests 테이블에 50개 이상의 synthetic 레코드 존재
- [ ] 최근 7일에 걸쳐 분포 (차트에 의미 있는 시계열 표시)
- [ ] 다양한 endpoint, 비용(0~500000), 지연시간, 캐시 히트/미스 포함
- [ ] 에러 응답(500, 429, 502 등) 포함
- [ ] Dashboard analytics 4개 API가 빈 결과 없이 데이터 반환

## 검증 결과

- [x] 66개 request 레코드 삽입 (`INSERT INTO requests ... VALUES` 66행) ✅
- [x] `NOW() - INTERVAL '1~7 day'`로 7일 분포 ✅
- [x] 12개 다양한 endpoint URL, 비용 0~500000, 지연시간 45~1200ms ✅
- [x] status_code 500, 429, 502 포함 (에러 시 cost=0, cached=false) ✅
- [x] 이전 세션에서 verify-seed 스크립트로 66 requests 확인 ✅

## 수정 파일

- `packages/proxy/src/db/seed.sql`
