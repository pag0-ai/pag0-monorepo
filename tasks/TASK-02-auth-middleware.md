# TASK-02: Auth 미들웨어 + Rate Limiter

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md) |

## 목표

Hono 미들웨어로 API Key 인증과 Rate Limiting을 구현한다. 모든 `/proxy`, `/api/*` 엔드포인트에 적용.

## 구현 파일

### 1. Auth 미들웨어: `packages/proxy/src/middleware/auth.ts`

**기능**:
- `X-Pag0-API-Key` 헤더에서 API Key 추출
- SHA-256 해시 후 `users` 테이블에서 조회
- `c.set('user', user)`, `c.set('project', project)` 로 컨텍스트 저장
- 인증 실패 시 `UnauthorizedError` (401)

**API Key 해싱**:
```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(apiKey).digest('hex');
```

**DB 조회**:
```sql
SELECT u.id, u.email, u.subscription_tier, p.id as project_id
FROM users u
JOIN projects p ON p.user_id = u.id AND p.is_active = true
WHERE u.api_key_hash = $1
LIMIT 1
```

### 2. Rate Limiter: `packages/proxy/src/middleware/rate-limit.ts`

**기능**:
- Redis INCR + TTL (1분 윈도우)
- 키 패턴: `rate:{projectId}:{minute_window}`
- Free tier: 60 req/min, Pro tier: 1000 req/min
- 초과 시 `RateLimitError` (429) + `X-RateLimit-*` 헤더

**응답 헤더** (모든 응답):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1707580800
```

## 테스트 패턴

`prepare-hackathon/test-business-logic-day1.ts` 참조:
- **테스트 5 (Rate Limiter)**: Redis INCR 패턴, TTL 설정, 60회 초과 시 차단
- **테스트 7 (API Key Auth)**: SHA-256 해싱, DB 조회, 잘못된 키 거부

## 테스트 방법

```bash
# 서버 실행 후
curl -H "X-Pag0-API-Key: pag0_live_xxx" http://localhost:3000/health
# → 200 OK (인증 불필요 엔드포인트)

curl http://localhost:3000/api/policies
# → 401 Unauthorized

curl -H "X-Pag0-API-Key: {seed된 demo key}" http://localhost:3000/api/policies
# → 200 OK
```

## 주의사항

- `/health` 엔드포인트는 인증 제외
- `/api/auth/register`, `/api/auth/login`은 인증 제외 (공개 엔드포인트)
- API Key 원문은 절대 로깅/저장하지 않음 (해시만)
- Rate limit 키의 TTL: 60초 (고정)

## 완료 기준

- [ ] Auth 미들웨어 구현 (SHA-256 API Key 인증)
- [ ] Rate Limiter 구현 (Redis, tier별 차등)
- [ ] `X-RateLimit-*` 응답 헤더 추가
- [ ] 인증 제외 경로 처리 (`/health`, `/api/auth/register`, `/api/auth/login`)
- [ ] 로컬에서 curl로 인증 성공/실패 테스트
