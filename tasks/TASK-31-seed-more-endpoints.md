# TASK-31: seed endpoint_scores를 전체 카테고리로 확장

**Priority**: P0 (데모 품질)
**Status**: TODO
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

## 수정 파일

- `packages/proxy/src/db/seed.sql`
