# TASK-32: Onboarding/Login 페이지에서 사이드바 제거

**Priority**: P1 (UX)
**Status**: TODO
**Phase**: 9 (Demo Polish)

## 문제

`app/layout.tsx`의 RootLayout에서 모든 페이지에 `<Sidebar />`를 렌더링. 온보딩 페이지는 `min-h-screen flex items-center justify-center`로 풀스크린을 의도했지만, 왼쪽에 사이드바가 함께 표시됨. 로그인 페이지도 동일.

## 영향

온보딩/로그인 시 사이드바가 보이면 미완성 인상.

## 수정 방안

1. `app/layout.tsx`에서 pathname 기반 조건부 사이드바 렌더링
2. 또는 `app/(auth)/` route group에 별도 layout 적용 (사이드바 없음)
3. 또는 `app/(dashboard)/` route group에 사이드바 포함 layout 적용

## 수정 파일

- `packages/dashboard/app/layout.tsx`
- (선택) `packages/dashboard/app/(auth)/layout.tsx` (신규)
- (선택) `packages/dashboard/app/(dashboard)/layout.tsx` (신규)
