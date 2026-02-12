# TASK-34: 전체 페이지 에러 상태 처리

**Priority**: P1 (UX)
**Status**: TODO
**Phase**: 9 (Demo Polish)

## 문제

Dashboard, Rankings, Policies 페이지에서 `useQuery`의 `isError`/`error` 상태를 처리하지 않음. API 서버 다운/네트워크 에러 시 빈 화면만 표시.

추가로 Policies의 `deleteMutation`에 `onError` 콜백이 없어 삭제 실패 시 사용자 피드백 없음.

## 수정

1. 각 페이지에 에러 상태 UI 추가 ("Something went wrong" + retry 버튼)
2. Policies deleteMutation에 onError 콜백 추가

## 수정 파일

- `packages/dashboard/app/dashboard/page.tsx`
- `packages/dashboard/app/rankings/page.tsx`
- `packages/dashboard/app/policies/page.tsx`
