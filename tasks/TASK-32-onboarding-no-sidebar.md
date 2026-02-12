# TASK-32: Onboarding/Login 페이지에서 사이드바 제거

**Priority**: P1 (UX)
**Status**: ✅ 완료 (커밋 `1333ada`)
**Phase**: 9 (Demo Polish)

## 문제

`app/layout.tsx`의 RootLayout에서 모든 페이지에 `<Sidebar />`를 렌더링. 온보딩 페이지는 `min-h-screen flex items-center justify-center`로 풀스크린을 의도했지만, 왼쪽에 사이드바가 함께 표시됨. 로그인 페이지도 동일.

## 영향

온보딩/로그인 시 사이드바가 보이면 미완성 인상.

## 수정 방안

1. `app/layout.tsx`에서 pathname 기반 조건부 사이드바 렌더링
2. 또는 `app/(auth)/` route group에 별도 layout 적용 (사이드바 없음)
3. 또는 `app/(dashboard)/` route group에 사이드바 포함 layout 적용

## 완료 기준

- [ ] `/onboarding` 페이지에서 사이드바가 렌더링되지 않음
- [ ] `/login` 페이지에서 사이드바가 렌더링되지 않음
- [ ] `/dashboard`, `/policies`, `/rankings` 등 일반 페이지에서는 사이드바 정상 표시
- [ ] Next.js 빌드 성공

## 검증 결과

- [x] `LayoutShell` 클라이언트 컴포넌트: `NO_SIDEBAR_PATHS = ['/onboarding', '/login', '/register']` ✅
- [x] `usePathname().startsWith()` 기반 조건부 렌더링 ✅
- [x] `layout.tsx`에서 `<Sidebar />` 직접 렌더 → `<LayoutShell>` 래퍼로 교체 ✅
- [x] `next build` 성공 확인 ✅

## 수정 파일

- `packages/dashboard/app/layout.tsx`
- `packages/dashboard/components/layout-shell.tsx` (신규)
