# TASK-36: next.config rewrite 대상을 환경변수로 분기

**Priority**: P2 (배포)
**Status**: ✅ 완료 (커밋 `38967db`)
**Phase**: 9 (Demo Polish)

## 문제

`next.config.ts`의 rewrite destination이 `http://localhost:3000`으로 하드코딩. Vercel 배포 시 Fly.io URL로 변경 필요하지만 분기 로직 없음.

또한 `lib/api.ts`의 `NEXT_PUBLIC_API_URL`과 이중 경로 존재:
- rewrite: 서버사이드 프록시 (CORS 없음)
- 직접 fetch: 브라우저에서 호출 (CORS 필요)

## 수정

- `next.config.ts`에서 `process.env.NEXT_PUBLIC_API_URL` 사용
- 또는 프로덕션에서는 rewrite 방식으로 통일하여 CORS 문제 회피

## 완료 기준

- [ ] `next.config.ts`에서 rewrite destination이 환경변수 기반 (`NEXT_PUBLIC_API_URL`)
- [ ] 환경변수 미설정 시 `http://localhost:3000` 폴백
- [ ] `/api/auth/*`, `/api/onboarding/*`는 rewrite 제외 (Next.js 자체 라우트)
- [ ] Next.js 빌드 성공

## 검증 결과

- [x] `const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'` ✅
- [x] destination: `` `${backendUrl}/api/:path*` `` ✅
- [x] `/api/auth/:path*` → 자체 처리 (기존) ✅
- [x] `/api/onboarding/:path*` → 자체 처리 (신규 추가) ✅
- [x] `next build` 성공 ✅

## 수정 파일

- `packages/dashboard/next.config.ts`
