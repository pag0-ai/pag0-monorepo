# TASK-33: Rankings Compare 기능에 winner 정보 표시

**Priority**: P1 (기능 완성)
**Status**: TODO
**Phase**: 9 (Demo Polish)

## 문제

백엔드 `/api/curation/compare`가 `{ endpoints: [...], winner: { overall, cost, latency, reliability } }`를 반환하지만, 프론트엔드 `ComparisonData` 타입에 `winner` 필드가 없어 완전히 무시됨.

## 영향

"어느 API가 이겼는가?"를 보여주는 것이 Curation 데모의 핵심 스토리인데, 현재 비교 결과에 winner badge/highlight가 없음.

## 수정

1. `ComparisonData` 인터페이스에 `winner` 필드 추가
2. 비교 결과 카드에서 overall winner에 crown/trophy 아이콘 표시
3. 각 차원(cost, latency, reliability)별 winner에도 작은 배지 표시

## 수정 파일

- `packages/dashboard/app/rankings/page.tsx` — ComparisonData 타입 + UI
