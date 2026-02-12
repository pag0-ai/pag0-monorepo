# TASK-29: seed API key가 auth middleware regex에 불일치

**Priority**: P0 (데모 차단)
**Status**: ✅ 완료 (커밋 `edc7b84`)
**Phase**: 9 (Demo Polish)

## 문제

seed.sql의 데모 API key `pag0_test_local_dev_key_here`가 auth middleware 정규식 `/^pag0_(live|test)_[a-zA-Z0-9]{32}$/`에 매칭되지 않음.

- postfix `local_dev_key_here` = 18자 (32자 필요)
- underscore(`_`) 포함 (`[a-zA-Z0-9]`에 불일치)

## 영향

seed 데이터로 생성된 데모 사용자가 API 인증을 통과할 수 없음. 모든 API 호출이 401 Unauthorized.

## 수정

- `seed.sql`의 API key를 regex에 맞는 형식으로 변경
- 예: `pag0_test_aaaabbbbccccddddeeeeffffgggghhhh` (32자 alphanumeric)
- 해당 api_key_hash도 SHA-256으로 재계산

## 완료 기준

- [ ] seed API key가 `/^pag0_(live|test)_[a-zA-Z0-9]{32}$/` regex에 매칭
- [ ] api_key_hash가 해당 key의 SHA-256 값과 일치
- [ ] `pnpm db:seed` 후 seed 유저로 API 호출 시 401 없이 정상 응답

## 검증 결과

- [x] API key: `pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (32자 alphanumeric) — regex 매칭 ✅
- [x] hash: `encode(digest('pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', 'sha256'), 'hex')` — DB 함수로 계산 ✅
- [x] 이전 세션에서 seed 후 demo-mcp-agent.sh 7/7 통과 확인 ✅

## 수정 파일

- `packages/proxy/src/db/seed.sql`
