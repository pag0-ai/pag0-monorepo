# TASK-18: 데모 시나리오 준비

| 항목 | 내용 |
|------|------|
| **패키지** | 전체 (proxy + dashboard + mcp) |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-17](./TASK-17-e2e-test.md), [TASK-16](./TASK-16-mcp-integration.md), [TASK-13](./TASK-13-dashboard-metrics.md)~[TASK-15](./TASK-15-ranking-board.md) |
| **차단 대상** | 없음 (최종 태스크) |

## 목표

해커톤 심사를 위한 3개 데모 시나리오를 준비하고, 각 시나리오를 순서대로 실행할 수 있는 스크립트를 작성한다.

## 3개 핵심 데모 시나리오

### 시나리오 1: Spend Firewall (Policy Enforcement)

**스토리**: AI Agent가 예산 한도를 초과하는 API 호출을 시도 → Pag0가 차단

```bash
# 1. 현재 예산 확인 (MCP 또는 curl)
curl -s "http://localhost:3000/api/analytics/summary?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq '{dailySpent, dailyBudget, monthlySpent, monthlyBudget}'

# 2. 소액 요청 → 성공
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.openai.com/v1/chat/completions","method":"POST","body":{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}}' | jq .
# → 프록시 정상 중계 (또는 402 → payment flow)

# 3. 예산 초과 요청 → 차단
# (dailyBudget을 낮게 설정한 정책으로)
curl -s -X PUT http://localhost:3000/api/policies/$POLICY_ID \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"dailyBudget": "100"}' | jq .
# → 403 POLICY_VIOLATION (budget exceeded)

# 4. Dashboard에서 차단 내역 확인
# → http://localhost:3001/dashboard 에서 메트릭 확인
```

**데모 포인트**: 정책 기반 자동 차단 → Agent 과소비 방지

### 시나리오 2: Smart Cache (비용 절감)

**스토리**: 동일 요청 반복 시 캐시 히트로 비용 40%+ 절감

```bash
# 1. 첫 번째 요청 → Cache MISS (실제 API 호출)
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.example.com/data","method":"GET"}' | jq '{cached, cost, latency}'
# → { cached: false, cost: "500000", latency: 150 }

# 2. 동일 요청 → Cache HIT (즉시 응답, 비용 0)
curl -s -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"url":"https://api.example.com/data","method":"GET"}' | jq '{cached, cost, latency}'
# → { cached: true, cost: "0", latency: 3 }

# 3. 캐시 통계 확인
curl -s "http://localhost:3000/api/analytics/cache?period=24h" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .
# → { hitRate: 50.0, totalHits: 1, totalMisses: 1, bytesSaved: ... }

# 4. Dashboard에서 Cache Savings 시각화 확인
# → http://localhost:3001/dashboard 의 Cache Savings 카드
```

**데모 포인트**: 자동 캐싱으로 동일 요청 비용 0 → 전체 40%+ 절감

### 시나리오 3: API Curation (추천 & 비교)

**스토리**: Agent에게 최적 API 엔드포인트를 추천하고 비교 정보 제공

```bash
# 1. AI 카테고리 랭킹 조회
curl -s "http://localhost:3000/api/curation/rankings?category=AI" \
  -H "X-Pag0-API-Key: $API_KEY" | jq '.[] | {rank, endpoint, overall, cost, latency, reliability}'

# 2. 추천 요청 (비용 우선)
curl -s "http://localhost:3000/api/curation/recommend?category=AI&limit=3&sortBy=cost" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 3. 엔드포인트 비교 (Anthropic vs OpenAI)
curl -s "http://localhost:3000/api/curation/compare?endpoints=api.anthropic.com,api.openai.com" \
  -H "X-Pag0-API-Key: $API_KEY" | jq .

# 4. Dashboard Rankings 페이지에서 시각화
# → http://localhost:3001/rankings
# → 카테고리 필터 변경, 점수 뱃지 색상, 비교 패널
```

**데모 포인트**: 실사용 데이터 기반 점수화 → Agent가 최적 선택 가능

## MCP Agent 데모 (Optional)

Claude Desktop 또는 Claude Code에서 MCP Server 연동:

```
사용자: "내 예산 상태 확인해줘"
Agent → pag0_check_budget → "일일 예산 $50 중 $12.50 사용 (25%)"

사용자: "AI 카테고리에서 가장 좋은 API 추천해줘"
Agent → pag0_recommend(category="AI") → "api.anthropic.com (92점) 추천"

사용자: "OpenAI랑 Anthropic 비교해줘"
Agent → pag0_compare(endpoints=["api.openai.com","api.anthropic.com"]) → 비교 테이블
```

## 데모 준비 스크립트

```bash
#!/bin/bash
# scripts/demo-setup.sh

echo "=== Pag0 Demo Setup ==="

# 1. Docker 서비스 확인
echo "Starting Docker services..."
pnpm docker:up

# 2. DB 마이그레이션 + 시드
echo "Setting up database..."
pnpm db:migrate
pnpm db:seed

# 3. Backend 시작
echo "Starting proxy server..."
pnpm dev:proxy &
sleep 3

# 4. Dashboard 시작
echo "Starting dashboard..."
pnpm dev:dashboard &
sleep 5

# 5. Health check
echo "Verifying services..."
curl -s http://localhost:3000/health | jq .
curl -s -o /dev/null -w "Dashboard: %{http_code}\n" http://localhost:3001

echo ""
echo "=== Demo Ready ==="
echo "Proxy:     http://localhost:3000"
echo "Dashboard: http://localhost:3001"
echo ""
echo "Demo API Key (from seed): check .env or seed output"
```

## 피치 스크립트 참조

`docs/07-01-PITCH-SCRIPT.md` 참조 — 3분 피치 구조:
1. **문제 제기** (30초) — Agent 과소비 문제
2. **해결책** (1분) — Pag0 3-in-1: Firewall + Cache + Curation
3. **데모** (1분) — 3개 시나리오 라이브
4. **비즈니스** (30초) — 수수료 모델, 시장 규모

## 완료 기준

- [x] 시나리오 1: Policy enforcement 데모 동작
- [x] 시나리오 2: Cache hit/miss + 비용 절감 데모 동작
- [x] 시나리오 3: Curation 랭킹/추천/비교 데모 동작
- [x] 데모 준비 스크립트 작성 (`scripts/demo-setup.sh`)
- [x] Dashboard 3개 페이지 모두 데이터 표시 확인
- [x] 전체 데모 리허설 1회 완료

## 버그 수정 이력

- **demo-scenarios.sh bash 이스케이프 수정**: 비밀번호 `Demo1234!`의 `!`가 bash history expansion으로 해석되어 JSON 파싱 에러 발생. 단일 인용 부호 JSON body + `!` 제거한 비밀번호로 변경.
- **데모 리허설 결과**: 3개 시나리오 모두 통과 확인 (Scenario 1: Spend Firewall, Scenario 2: Smart Cache, Scenario 3: API Curation).
