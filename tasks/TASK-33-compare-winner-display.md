# TASK-33: Rankings Compare 기능에 winner 정보 표시

**Priority**: P1 (기능 완성)
**Status**: ✅ 완료 (커밋 `1333ada`)
**Phase**: 9 (Demo Polish)

## 문제

백엔드 `/api/curation/compare`가 `{ endpoints: [...], winner: { overall, cost, latency, reliability } }`를 반환하지만, 프론트엔드 `ComparisonData` 타입에 `winner` 필드가 없어 완전히 무시됨.

## 영향

"어느 API가 이겼는가?"를 보여주는 것이 Curation 데모의 핵심 스토리인데, 현재 비교 결과에 winner badge/highlight가 없음.

## 수정

1. `ComparisonData` 인터페이스에 `winner` 필드 추가
2. 비교 결과 카드에서 overall winner에 crown/trophy 아이콘 표시
3. 각 차원(cost, latency, reliability)별 winner에도 작은 배지 표시

## 완료 기준

- [ ] `ComparisonData` 인터페이스에 `winner?: ComparisonWinner` 필드 추가
- [ ] Overall winner 카드에 Crown 아이콘 + 골드 링 하이라이트
- [ ] Overall Winner 배너 표시 (endpoint URL)
- [ ] 각 차원(cost, latency, reliability)별 winner에 "BEST" 배지 표시
- [ ] winner 없는 경우 (비교 2개 미만 등) 에러 없이 동작

## 검증 결과

- [x] `ComparisonWinner { overall, cost, latency, reliability }` 인터페이스 추가 ✅
- [x] `comparison.winner?.overall === ep.endpoint` → Crown 아이콘 + `ring-2 ring-yellow-500/60` ✅
- [x] 배너: `<Crown /> Overall Winner: {comparison.winner.overall}` ✅
- [x] 각 차원별: `isDimWinner` → `<span>BEST</span>` 배지 ✅
- [x] `winner?` optional chaining으로 null-safe ✅
- [x] `next build` 성공 ✅

## 수정 파일

- `packages/dashboard/app/rankings/page.tsx` — ComparisonData 타입 + UI
