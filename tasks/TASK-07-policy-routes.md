# TASK-07: Policy CRUD Routes

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md), [TASK-03](./TASK-03-policy-engine.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md), [TASK-14](./TASK-14-policy-ui.md) |

## 목표

정책(Policy) CRUD API 엔드포인트를 Hono 라우트로 구현한다.

## 구현 파일

### `packages/proxy/src/routes/policies.ts`

Hono sub-app으로 구현, `index.ts`에서 `app.route('/api/policies', policyRoutes)` 형태로 마운트.

### 엔드포인트 목록

| Method | Path | 설명 | 응답 |
|--------|------|------|------|
| GET | `/` | 프로젝트의 모든 정책 목록 | `{ policies: Policy[], total: number }` |
| POST | `/` | 새 정책 생성 | `{ policy: Policy }` (201) |
| GET | `/:id` | 정책 상세 조회 | `{ policy: Policy }` |
| PUT | `/:id` | 정책 수정 (partial update) | `{ policy: Policy }` |
| DELETE | `/:id` | 정책 삭제 (soft delete: is_active=false) | 204 No Content |

### GET `/` — 목록 조회

```sql
SELECT * FROM policies
WHERE project_id = $1
ORDER BY created_at DESC
```

쿼리 파라미터: `projectId` (optional — 미들웨어에서 project context 활용)

### POST `/` — 생성

**요청 body**:
```typescript
{
  name: string;
  maxPerRequest: string;      // USDC BIGINT
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints?: string[];
  blockedEndpoints?: string[];
}
```

**검증**:
- `maxPerRequest <= dailyBudget <= monthlyBudget` (DB 제약조건으로도 보장)
- 이름 필수
- USDC 금액은 양수

**주의**: 프로젝트당 활성 정책은 하나만 (`idx_policies_project_active_unique`). 새 정책 생성 시 기존 활성 정책은 비활성화.

### PUT `/:id` — 수정

Partial update 지원 — 전달된 필드만 업데이트. DB `updated_at` 자동 갱신.

### DELETE `/:id` — 삭제

Soft delete: `is_active = false`로 변경. 실제 행 삭제 안 함.

## 참고 API 스펙

`docs/04-API-SPEC.md` 섹션 2 (정책 관리) 참조.

## 에러 응답 형식

```typescript
{
  error: {
    code: string;       // "INVALID_REQUEST", "NOT_FOUND"
    message: string;
    details?: any;
  }
}
```

## 테스트 방법

```bash
pnpm dev:proxy

# 목록 조회
curl -H "X-Pag0-API-Key: {key}" http://localhost:3000/api/policies

# 생성
curl -X POST -H "X-Pag0-API-Key: {key}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","maxPerRequest":"1000000","dailyBudget":"10000000","monthlyBudget":"100000000"}' \
  http://localhost:3000/api/policies

# 수정
curl -X PUT -H "X-Pag0-API-Key: {key}" \
  -H "Content-Type: application/json" \
  -d '{"dailyBudget":"20000000"}' \
  http://localhost:3000/api/policies/{id}

# 삭제
curl -X DELETE -H "X-Pag0-API-Key: {key}" \
  http://localhost:3000/api/policies/{id}
```

## 완료 기준

- [ ] 5개 CRUD 엔드포인트 구현
- [ ] 입력 검증 (budget 양수, 계층 순서)
- [ ] 프로젝트당 활성 정책 1개 제한 처리
- [ ] Soft delete 구현
- [ ] 로컬에서 curl CRUD 테스트 통과
