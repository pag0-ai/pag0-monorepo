# TASK-36: next.config rewrite target branching with environment variable

**Priority**: P2 (deployment)
**Status**: ✅ completed (commit `38967db`)
**Phase**: 9 (Demo Polish)

## Problem

The rewrite destination in `next.config.ts` is hardcoded to `http://localhost:3000`. For Vercel deployment, it needs to change to Fly.io URL but there's no branching logic.

Additionally, there's a dual path between the rewrite and `NEXT_PUBLIC_API_URL` in `lib/api.ts`:
- rewrite: server-side proxy (no CORS)
- direct fetch: called from browser (requires CORS)

## Fix

- Use `process.env.NEXT_PUBLIC_API_URL` in `next.config.ts`
- Or unify to rewrite approach in production to avoid CORS issues

## Completion Criteria

- [x] Rewrite destination in `next.config.ts` is based on environment variable (`NEXT_PUBLIC_API_URL`)
- [x] Falls back to `http://localhost:3000` when environment variable is not set
- [x] `/api/auth/*`, `/api/onboarding/*` excluded from rewrite (Next.js own routes)
- [x] Next.js build succeeds

## Verification Results

- [x] `const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'` ✅
- [x] destination: `` `${backendUrl}/api/:path*` `` ✅
- [x] `/api/auth/:path*` → self-handled (existing) ✅
- [x] `/api/onboarding/:path*` → self-handled (newly added) ✅
- [x] `next build` succeeds ✅

## Modified Files

- `packages/dashboard/next.config.ts`
