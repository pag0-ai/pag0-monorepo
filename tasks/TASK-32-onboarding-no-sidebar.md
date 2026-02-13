# TASK-32: Remove sidebar from Onboarding/Login pages

**Priority**: P1 (UX)
**Status**: ✅ Complete (commit `1333ada`)
**Phase**: 9 (Demo Polish)

## Problem

RootLayout in `app/layout.tsx` renders `<Sidebar />` on all pages. Onboarding page intends fullscreen with `min-h-screen flex items-center justify-center`, but sidebar displays on the left. Same for login page.

## Impact

Sidebar visibility during onboarding/login gives an unfinished impression.

## Fix Options

1. Conditional sidebar rendering based on pathname in `app/layout.tsx`
2. Or apply separate layout to `app/(auth)/` route group (without sidebar)
3. Or apply layout with sidebar to `app/(dashboard)/` route group

## Completion Criteria

- [ ] Sidebar not rendered on `/onboarding` page
- [ ] Sidebar not rendered on `/login` page
- [ ] Sidebar displays normally on regular pages like `/dashboard`, `/policies`, `/rankings`
- [ ] Next.js build succeeds

## Verification Results

- [x] `LayoutShell` client component: `NO_SIDEBAR_PATHS = ['/onboarding', '/login', '/register']` ✅
- [x] Conditional rendering based on `usePathname().startsWith()` ✅
- [x] Direct `<Sidebar />` render in `layout.tsx` → replaced with `<LayoutShell>` wrapper ✅
- [x] `next build` success confirmed ✅

## Modified Files

- `packages/dashboard/app/layout.tsx`
- `packages/dashboard/components/layout-shell.tsx` (new)
