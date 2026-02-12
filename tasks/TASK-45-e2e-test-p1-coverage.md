# TASK-45: E2E 테스트 P1 기능 커버리지 확장

> **우선순위**: HIGH
> **패키지**: scripts/
> **상태**: 대기

## 목표

`scripts/e2e-test.sh`에 P1/R2에서 추가된 기능에 대한 응답 필드 레벨 검증 추가.
현재 22개 → 30개로 확장.

## 현재 문제

기존 E2E 테스트는 HTTP 상태 코드(200/401/404/429)만 검증.
P1에서 추가된 JWT 토큰, analytics 새 필드, curation differences/weights/evidence 등의
**응답 본문**은 전혀 검증하지 않음.

## 추가할 테스트 (8개)

### Auth 섹션 (+2)
1. **Login JWT token**: register → login → 응답에 `token` 필드 존재 확인
2. **Login → /me flow**: login에서 받은 JWT로 /me 호출 가능 확인 (향후 JWT 인증 시)

### Policy 섹션 (+1)
3. **Policy field names**: Create 응답에 `dailyBudget` (not `dailyLimit`) 필드 확인

### Analytics 섹션 (+2)
4. **Endpoints new fields**: /endpoints 응답에 `cacheHitRate`, `successRate` 필드 존재 확인
5. **Summary budgetRemaining**: /summary 응답의 budgetUsage에 `remaining` 값이 음수가 아닌지 확인

### Curation 섹션 (+3)
6. **Compare differences**: /compare 응답에 `differences` 객체 존재 확인
7. **Rankings weights/evidence**: /rankings 응답 첫 항목에 `weights`, `evidence` 존재 확인
8. **Score endpoint**: `/api/curation/score/{endpoint}` 개별 점수 조회 (현재 미테스트)

## 구현 노트

- `jq` 또는 `python3 -c` 로 JSON 필드 존재 여부 검증
- 기존 `assert_status` 외에 `assert_field` 헬퍼 추가
- 기존 22개 테스트는 변경 없이 유지

## 의존성

- P1 커밋 `a684cc3` 완료 (JWT, analytics fields, curation weights/differences)
- R2 커밋 `520de2d` 완료 (budgetRemaining fix)
