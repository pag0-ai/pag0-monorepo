# TASK-01: DB/Redis 클라이언트 설정

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 30분 |
| **의존성** | 없음 (최우선 태스크) |
| **차단 대상** | [TASK-02](./TASK-02-auth-middleware.md), [TASK-03](./TASK-03-policy-engine.md), [TASK-04](./TASK-04-cache-layer.md), [TASK-06](./TASK-06-analytics-collector.md), [TASK-07~10](./TASK-00-OVERVIEW.md) |

## 목표

PostgreSQL과 Redis 클라이언트를 싱글톤으로 설정하여 모든 모듈에서 import해 사용할 수 있게 한다.

## 구현 파일

### 1. `packages/proxy/src/db/postgres.ts`

```typescript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 20,              // connection pool
  idle_timeout: 30,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

export default sql;
```

### 2. `packages/proxy/src/cache/redis.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

export default redis;
```

## 환경변수

`.env.local`에 이미 존재해야 하는 값:
- `DATABASE_URL` — Supabase PostgreSQL (또는 Docker 로컬)
- `REDIS_URL` — Upstash Redis (또는 Docker 로컬)

> **주의**: 기존 `.env.local` 파일의 변수명을 확인하고, `POSTGRES_URL` vs `DATABASE_URL` 차이에 주의할 것.

## 테스트 방법

```bash
# Docker 로컬 환경 실행 (이미 설정됨)
pnpm docker:up

# 간단한 연결 확인 (prepare-hackathon 테스트 참고)
cd packages/proxy && bun run src/db/postgres.ts
```

- Redis: `redis.ping()` → `PONG`
- PostgreSQL: `sql`SELECT 1`` → `[{ '?column?': 1 }]`

## 참고

- `prepare-hackathon/test-redis.ts` — Redis 연결 패턴
- `prepare-hackathon/test-postgres.ts` — PostgreSQL 연결 패턴
- `prepare-hackathon/DAY0-FINDINGS.md` — TLS, BIGINT 반환값 등 주의사항

## 완료 기준

- [x] `postgres.ts` 작성 완료, import 가능
- [x] `redis.ts` 작성 완료, import 가능
- [x] Docker 로컬 환경에서 연결 성공 확인
