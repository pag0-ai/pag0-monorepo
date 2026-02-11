# TASK-10: Auth Routes (register/login/me)

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md) |

## 목표

사용자 등록, 로그인, 현재 사용자 정보 조회 API를 구현한다.

## 구현 파일

### `packages/proxy/src/routes/auth.ts`

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/register` | 불필요 | 사용자 등록 + API Key 발급 |
| POST | `/login` | 불필요 | 로그인 (Dashboard용) |
| GET | `/me` | 필요 | 현재 사용자 정보 |

### POST `/register`

**요청**:
```typescript
{ email: string; password: string; projectName?: string }
```

**처리 흐름**:
1. 이메일 중복 체크
2. 비밀번호 해싱: 간이 해싱 (Bun의 `Bun.password.hash()` 또는 crypto)
   > MVP에서는 bcrypt 대신 `createHash('sha256')` + salt도 허용
3. API Key 생성: `pag0_live_` + 32자 랜덤 hex
4. API Key 해시: SHA-256 → `users.api_key_hash`
5. 사용자 INSERT + 프로젝트 INSERT + 기본 정책 INSERT + 예산 레코드 INSERT
6. API Key 원문 반환 (한 번만!)

**응답** (201):
```typescript
{
  user: { id, email, createdAt };
  project: { id, name };
  apiKey: "pag0_live_xxx";  // 한 번만 표시
}
```

### POST `/login`

**요청**:
```typescript
{ email: string; password: string }
```

**처리**:
1. 이메일로 사용자 조회
2. 비밀번호 검증
3. 간이 토큰 발급 (MVP: API Key 해시 기반, 또는 단순 JWT 없이 세션)
   > Dashboard용이므로 MVP에서는 API Key를 세션 대용으로 사용 가능

**응답** (200):
```typescript
{ token: string; user: { id, email } }
```

### GET `/me`

**인증 필요** (X-Pag0-API-Key 헤더)

**응답** (200):
```typescript
{
  user: { id, email, createdAt };
  projects: [{ id, name, apiKeyPreview: "pag0_live_a1b2...o5p6" }];
  subscription: { tier, limits: { requestsPerDay, projectsMax } };
}
```

## API Key 생성 패턴

`prepare-hackathon/test-business-logic-day1.ts` — **테스트 7**:
```typescript
function generateApiKey(): string {
  const random = createHash('sha256')
    .update(crypto.randomUUID())
    .digest('hex')
    .substring(0, 32);
  return `pag0_live_${random}`;
}
```

## 주의사항

- API Key 원문은 register 응답에서만 반환, DB에는 해시만 저장
- Password는 bcrypt(12) 권장이나, MVP에서는 Bun.password 또는 SHA-256+salt 허용
- `/register`, `/login`은 Auth 미들웨어 제외 경로
- `apiKeyPreview`: 앞 10자 + "..." + 뒤 4자

## 테스트 방법

```bash
pnpm dev:proxy

# 등록
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","projectName":"My Project"}'

# 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'

# 현재 사용자
curl -H "X-Pag0-API-Key: {발급받은 key}" http://localhost:3000/api/auth/me
```

## 완료 기준

- [x] register 엔드포인트 (사용자 + 프로젝트 + 정책 + 예산 생성)
- [x] login 엔드포인트 (비밀번호 검증)
- [x] me 엔드포인트 (인증된 사용자 정보)
- [x] API Key 생성 + 해시 저장
- [x] 로컬에서 등록 → 로그인 → 조회 플로우 테스트
