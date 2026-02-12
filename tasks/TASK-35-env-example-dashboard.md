# TASK-35: .env.example에 Dashboard 환경변수 추가

**Priority**: P2 (환경 설정)
**Status**: ✅ 완료 (커밋 `38967db`)
**Phase**: 9 (Demo Polish)

## 문제

`.env.example`에 Dashboard 패키지용 환경변수가 누락:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google OAuth)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (NextAuth v5 필수)
- `NEXT_PUBLIC_API_URL` (lib/api.ts)
- `PAG0_INTERNAL_SECRET` (dashboard → proxy 통신)

## 영향

새 개발자가 프로젝트 셋업 시 어떤 환경변수가 필요한지 알 수 없음. 로그인/온보딩 플로우가 깨짐.

## 수정

- `.env.example`에 Dashboard 섹션 추가

## 완료 기준

- [ ] `.env.example`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 포함
- [ ] `.env.example`에 `NEXTAUTH_URL`, `NEXTAUTH_SECRET` 포함
- [ ] `.env.example`에 `NEXT_PUBLIC_API_URL` 포함
- [ ] `PAG0_INTERNAL_SECRET`는 이미 존재하므로 중복 추가 없을 것

## 검증 결과

- [x] `GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com` (L47) ✅
- [x] `GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret` (L48) ✅
- [x] `NEXTAUTH_URL=http://localhost:3001` (L51) ✅
- [x] `NEXTAUTH_SECRET=your-nextauth-secret` (L52) ✅
- [x] `NEXT_PUBLIC_API_URL=http://localhost:3000` (L55) ✅
- [x] `PAG0_INTERNAL_SECRET` 기존 L38에 이미 존재 — 중복 없음 ✅

## 수정 파일

- `.env.example`
