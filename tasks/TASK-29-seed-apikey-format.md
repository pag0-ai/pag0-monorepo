# TASK-29: seed API key가 auth middleware regex에 불일치

**Priority**: P0 (데모 차단)
**Status**: TODO
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

## 수정 파일

- `packages/proxy/src/db/seed.sql`
