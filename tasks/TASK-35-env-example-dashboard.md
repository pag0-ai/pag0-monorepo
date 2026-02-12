# TASK-35: .env.example에 Dashboard 환경변수 추가

**Priority**: P2 (환경 설정)
**Status**: TODO
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

## 수정 파일

- `.env.example`
