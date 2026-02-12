# TASK-44: Policy Route JSON 파싱 에러 핸들링 (R2)

**Priority**: P1 (안정성)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: proxy

## 문제

Policy CRUD 라우트의 POST와 PUT 엔드포인트에서 `c.req.json()` 호출 시 잘못된 JSON body가 전달되면 unhandled exception이 발생하여 500 에러가 반환됨. 적절한 400 VALIDATION_ERROR 응답이 필요.

## 수정 내용

### packages/proxy/src/routes/policies.ts

#### POST / (정책 생성)
- `try/catch`로 `c.req.json()` 래핑
- 파싱 실패 시 `400 { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON in request body' } }` 반환

#### PUT /:id (정책 수정)
- 동일한 `try/catch` 패턴 적용
- 파싱 실패 시 동일 에러 응답

## 완료 기준

- [x] POST /api/policies에 JSON 파싱 에러 핸들링
- [x] PUT /api/policies/:id에 JSON 파싱 에러 핸들링
- [x] 에러 응답이 표준 형식 `{ error: { code, message } }` 준수
