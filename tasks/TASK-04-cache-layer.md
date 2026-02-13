# TASK-04: Cache Layer (Redis)

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-05](./TASK-05-proxy-core.md) |

## Objective

Implement a Redis-based response caching layer. Includes cache key generation, TTL management, cacheability determination, and invalidation.

## Implementation Files

### `packages/proxy/src/cache/layer.ts` — CacheLayer

**Core Methods**:

1. **`generateCacheKey(method, url, body?)`** — SHA-256 hash-based cache key
   - GET: `cache:{sha256(method + ":" + url)}`
   - POST/PUT: `cache:{sha256(method + ":" + url + ":" + bodyJSON)}`

2. **`isCacheable(status, method, headers, bodySize)`** — Returns true only if all 4 conditions are met
   - HTTP status 2xx
   - GET or HEAD or OPTIONS (idempotent)
   - No `Cache-Control: no-store` header
   - Response size < `maxCacheSizeBytes` (default 1MB)

3. **`get(key)`** — Redis GET + JSON.parse
4. **`set(key, value, url?)`** — Redis SETEX + TTL determination
5. **`invalidate(pattern)`** — Redis KEYS + DEL (pattern matching)
6. **`getTTL(url)`** — Apply TTL rules per URL pattern

**CacheConfig Interface**:
```typescript
interface CacheConfig {
  enabled: boolean;
  defaultTTLSeconds: number;      // Default 300 (5 minutes)
  maxCacheSizeBytes: number;      // Default 1MB
  ttlRules?: Array<{ pattern: string; ttlSeconds: number }>;
  excludePatterns?: string[];     // Patterns to never cache
}
```

**Default TTL Rules** (for reference):
```typescript
const defaultTTLRules = [
  { pattern: '*/models*', ttlSeconds: 3600 },   // Model list: 1 hour
  { pattern: '*/realtime*', ttlSeconds: 10 },    // Realtime: 10 seconds
  { pattern: '*/weather*', ttlSeconds: 600 },    // Weather: 10 minutes
];
```

## Test Patterns

`prepare-hackathon/test-business-logic-day1.ts` — **Test 3**:
- Same URL+method → same key / different method/body → different key
- Key format: `cache:` + 64-char hex (SHA-256)
- isCacheable: 200 GET = true, 200 POST = false, 404 = false, no-store = false, size exceeded = false
- Redis round-trip: SETEX → GET → JSON.parse

`prepare-hackathon/test-business-logic-day2.ts` — **Test 3**:
- TTL rule matching (differential TTL per pattern)
- Exclude patterns (`*/stream*`, `*/events*`)
- Cache invalidation (selective key deletion)
- Size limit check

## Test Method

```bash
# Requires Redis connection
pnpm docker:up

# Cache key generation + round-trip test
cd prepare-hackathon && bun run test-business-logic-day1.ts
# → Check "3. Cache Key Generation + isCacheable" section

cd prepare-hackathon && bun run test-business-logic-day2.ts
# → Check "3. Cache Layer — TTL Rules & Invalidation" section
```

## Notes

- Redis key pattern: `cache:{sha256_hex}` (70 chars fixed: "cache:" 6 chars + SHA-256 64 chars)
- `maxCacheSizeBytes` is checked by length after serialization (`JSON.stringify(value).length`)
- For invalidation, `redis.keys(pattern)` → SCAN recommended for production (KEYS allowed in MVP)

## Completion Criteria

- [x] CacheLayer class implementation (get, set, invalidate, generateCacheKey, isCacheable)
- [x] Pattern-based TTL rule application
- [x] Exclude pattern handling (stream, events, etc.)
- [x] Size limit check
- [x] Cache round-trip test passes on local Redis
