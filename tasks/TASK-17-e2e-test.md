# TASK-17: 로컬 E2E 통합 테스트

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` (전체) |
| **예상 시간** | 1.5시간 |
| **의존성** | [TASK-11](./TASK-11-integration.md) (백엔드 통합 완료) |
| **차단 대상** | [TASK-18](./TASK-18-demo-scenarios.md) |

## 목표

모든 백엔드 컴포넌트가 통합된 상태에서 전체 API 엔드포인트를 로컬 환경에서 E2E 테스트한다.

## 사전 조건

```bash
# Docker 서비스 (PostgreSQL + Redis) 실행
pnpm docker:up

# DB 스키마 + 시드 데이터
pnpm db:migrate && pnpm db:seed

# Proxy 서버 실행
pnpm dev:proxy
# → http://localhost:3000 에서 서비스 중
```

## 테스트 시나리오

### 참고: prepare-hackathon 테스트 코드

`prepare-hackathon/test-business-logic-day1.ts` (7개 Suite):
- USDC 산술 연산, Policy Engine, Cache Key/isCacheable, Budget Tracker, Rate Limiter, x402 헤더 파싱, API Key 인증

`prepare-hackathon/test-business-logic-day2.ts` (7개 Suite):
- Curation 점수 계산, 추천/비교, Cache TTL/무효화, Analytics Redis MULTI, PG 요청 로깅, Score 캐싱, 이상 탐지

`prepare-hackathon/test-business-logic-day3.ts` (7개 Suite):
- DB 스키마 생성, Budget 원자적 업데이트, Dashboard Analytics Summary, Cost 시계열, Cache Analytics, Endpoint Score CRUD, Full Proxy Flow 시뮬레이션

---

### 1. Health Check & 404

```bash
# Health check
curl -s http://localhost:3000/health | jq .
# → { "status": "ok", "timestamp": "..." }

# 404 handler
curl -s http://localhost:3000/nonexistent | jq .
# → { "error": { "code": "NOT_FOUND", "message": "..." } }
```

### 2. Auth Flow

```bash
# 사용자 등록
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@pag0.io","password":"Test1234!","name":"Test User"}' | jq .
# → { "user": {...}, "apiKey": "pag0_live_..." }

# API Key 저장
API_KEY=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@pag0.io","password":"Test1234!","name":"E2E"}' | jq -r '.apiKey')

# 인증 실패
curl -s http://localhost:3000/api/policies \
  -H "X-Pag0-API-Key: invalid_key" | jq .
# → 401 Unauthorized

# 인증 성공
curl -s http://localhost:3000/api/policies \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 200 policies 배열

# 현재 사용자 확인
curl -s http://localhost:3000/api/auth/me \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { "user": { "id": ..., "email": "e2e@pag0.io" } }
```

### 3. Policy CRUD

```bash
# 정책 생성
POLICY_ID=$(curl -s -X POST http://localhost:3000/api/policies \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{
    "name": "E2E Test Policy",
    "maxPerRequest": "5000000",
    "dailyBudget": "50000000",
    "monthlyBudget": "500000000",
    "allowedEndpoints": ["api.openai.com", "api.anthropic.com"]
  }' | jq -r '.id')

# 정책 조회
curl -s http://localhost:3000/api/policies/$POLICY_ID \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 정책 수정
curl -s -X PUT http://localhost:3000/api/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"dailyBudget": "100000000"}' | jq .

# 정책 삭제
curl -s -X DELETE http://localhost:3000/api/policies/$POLICY_ID \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 200 (soft delete)
```

### 4. Analytics Endpoints

```bash
# Summary (seed 데이터 기반)
curl -s "http://localhost:3000/api/analytics/summary?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { totalRequests, cacheHitRate, avgLatency, totalCost, cacheSavings }

# Endpoint 통계
curl -s "http://localhost:3000/api/analytics/endpoints?period=24h&limit=5" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → endpoints 배열

# Cost 시계열
curl -s "http://localhost:3000/api/analytics/costs?period=7d&granularity=daily" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { timeseries: [{timestamp, spent, saved}] }

# Cache 성능
curl -s "http://localhost:3000/api/analytics/cache?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { hitRate, totalHits, totalMisses, bytesSaved }
```

### 5. Curation Endpoints

```bash
# 카테고리 목록
curl -s http://localhost:3000/api/curation/categories \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → 8개 카테고리 (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)

# AI 카테고리 랭킹
curl -s "http://localhost:3000/api/curation/rankings?category=AI" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → seed 데이터 기반 랭킹 목록

# 추천
curl -s "http://localhost:3000/api/curation/recommend?category=AI&limit=3" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 비교
curl -s "http://localhost:3000/api/curation/compare?endpoints=api.openai.com,api.anthropic.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 개별 점수
curl -s "http://localhost:3000/api/curation/score/api.openai.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { endpoint, overall, cost, latency, reliability }
```

### 6. Rate Limiting 확인

```bash
# 빠른 연속 요청으로 rate limit 트리거
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code} " \
    http://localhost:3000/api/policies \
    -H "X-Pag0-API-Key: $API_KEY"
done
echo ""
# → 60개 200 이후 429 응답 시작 (Free tier: 60 req/min)
```

### 7. CORS 확인

```bash
# Preflight
curl -s -X OPTIONS http://localhost:3000/api/policies \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null
# → Access-Control-Allow-Origin: http://localhost:3001
```

## prepare-hackathon 테스트 실행

```bash
# Day 1 비즈니스 로직 테스트
bun run prepare-hackathon/test-business-logic-day1.ts

# Day 2 비즈니스 로직 테스트
bun run prepare-hackathon/test-business-logic-day2.ts

# Day 3 비즈니스 로직 테스트 (DB 연결 필요)
bun run prepare-hackathon/test-business-logic-day3.ts
```

## 완료 기준

- [ ] Health check 200 응답
- [ ] 404 handler 정상 동작
- [ ] Auth flow 전체 (register → API Key → 인증 성공/실패)
- [ ] Policy CRUD 전체 (생성 → 조회 → 수정 → 삭제)
- [ ] Analytics 4개 엔드포인트 응답 확인
- [ ] Curation 5개 엔드포인트 응답 확인
- [ ] Rate limiting 동작 확인 (429 응답)
- [ ] CORS preflight 정상
- [ ] prepare-hackathon 테스트 통과
