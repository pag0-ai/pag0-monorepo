# TASK-04: Cache Layer (Redis)

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-05](./TASK-05-proxy-core.md) |

## 목표

Redis 기반 응답 캐싱 레이어를 구현한다. 캐시 키 생성, TTL 관리, 캐시 가능 여부 판단, 무효화를 포함한다.

## 구현 파일

### `packages/proxy/src/cache/layer.ts` — CacheLayer

**핵심 메서드**:

1. **`generateCacheKey(method, url, body?)`** — SHA-256 해시 기반 캐시 키
   - GET: `cache:{sha256(method + ":" + url)}`
   - POST/PUT: `cache:{sha256(method + ":" + url + ":" + bodyJSON)}`

2. **`isCacheable(status, method, headers, bodySize)`** — 4가지 조건 모두 충족 시 true
   - HTTP status 2xx
   - GET 또는 HEAD 또는 OPTIONS (idempotent)
   - `Cache-Control: no-store` 헤더 없음
   - 응답 크기 < `maxCacheSizeBytes` (기본 1MB)

3. **`get(key)`** — Redis GET + JSON.parse
4. **`set(key, value, url?)`** — Redis SETEX + TTL 결정
5. **`invalidate(pattern)`** — Redis KEYS + DEL (패턴 매칭)
6. **`getTTL(url)`** — URL 패턴별 TTL 규칙 적용

**CacheConfig 인터페이스**:
```typescript
interface CacheConfig {
  enabled: boolean;
  defaultTTLSeconds: number;      // 기본 300 (5분)
  maxCacheSizeBytes: number;      // 기본 1MB
  ttlRules?: Array<{ pattern: string; ttlSeconds: number }>;
  excludePatterns?: string[];     // 절대 캐시하지 않는 패턴
}
```

**기본 TTL 규칙** (참고용):
```typescript
const defaultTTLRules = [
  { pattern: '*/models*', ttlSeconds: 3600 },   // 모델 리스트: 1시간
  { pattern: '*/realtime*', ttlSeconds: 10 },    // 실시간: 10초
  { pattern: '*/weather*', ttlSeconds: 600 },    // 날씨: 10분
];
```

## 테스트 패턴

`prepare-hackathon/test-business-logic-day1.ts` — **테스트 3**:
- 동일 URL+method → 동일 키 / 다른 method/body → 다른 키
- 키 포맷: `cache:` + 64자 hex (SHA-256)
- isCacheable: 200 GET = true, 200 POST = false, 404 = false, no-store = false, 크기초과 = false
- Redis round-trip: SETEX → GET → JSON.parse

`prepare-hackathon/test-business-logic-day2.ts` — **테스트 3**:
- TTL 규칙 매칭 (패턴별 차등 TTL)
- 제외 패턴 (`*/stream*`, `*/events*`)
- 캐시 무효화 (선택적 키 삭제)
- 크기 제한 체크

## 테스트 방법

```bash
# Redis 연결 필요
pnpm docker:up

# 캐시 키 생성 + round-trip 테스트
cd prepare-hackathon && bun run test-business-logic-day1.ts
# → "3. Cache Key Generation + isCacheable" 섹션 확인

cd prepare-hackathon && bun run test-business-logic-day2.ts
# → "3. Cache Layer — TTL Rules & Invalidation" 섹션 확인
```

## 주의사항

- Redis 키 패턴: `cache:{sha256_hex}` (70자 고정: "cache:" 6자 + SHA-256 64자)
- `maxCacheSizeBytes`는 직렬화 후 길이로 체크 (`JSON.stringify(value).length`)
- 무효화 시 `redis.keys(pattern)` → 프로덕션에서는 SCAN 사용 권장 (MVP에서는 KEYS 허용)

## 완료 기준

- [x] CacheLayer 클래스 구현 (get, set, invalidate, generateCacheKey, isCacheable)
- [x] 패턴 기반 TTL 규칙 적용
- [x] 제외 패턴 처리 (stream, events 등)
- [x] 크기 제한 체크
- [x] 로컬 Redis에서 캐시 round-trip 테스트 통과
