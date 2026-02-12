# TASK-31: seed endpoint_scores를 전체 카테고리로 확장

**Priority**: P0 (데모 품질)
**Status**: ✅ 완료 (커밋 `edc7b84`)
**Phase**: 9 (Demo Polish)

## 문제

8개 카테고리(AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)가 있지만, endpoint_scores는 5개 엔드포인트만 존재하고 AI(2), Blockchain(1), Finance(1), Storage(1)에만 분포.

Data, IoT, Social, Communication 카테고리가 빈 상태.

## 영향

Rankings 페이지에서 빈 카테고리 선택 시 "No rankings available". Category Overview Cards에서 4개 카테고리가 `0 endpoints, 0.0 score`로 표시되어 미완성 인상.

## 수정

- seed.sql에 카테고리별 최소 2~3개 endpoint_scores 추가
- 총 16~24개의 다양한 점수 데이터
- 현실적인 API endpoint URL과 점수 분포

## 완료 기준

- [ ] 8개 카테고리 모두에 최소 2개 이상의 endpoint_scores 존재
- [ ] 총 16개 이상의 endpoint_scores 레코드
- [ ] categories 테이블의 endpoint_count, avg_score 자동 업데이트
- [ ] Rankings 페이지에서 모든 카테고리 탭에 데이터 표시

## 검증 결과

- [x] 20개 endpoint_scores: AI(3), Data(3), Blockchain(2), IoT(2), Finance(3), Social(2), Communication(2), Storage(3) ✅
- [x] `UPDATE categories SET endpoint_count=..., avg_score=...` 쿼리 포함 ✅
- [x] 이전 세션에서 verify-seed로 8개 카테고리 전부 확인 ✅

## 수정 파일

- `packages/proxy/src/db/seed.sql`
