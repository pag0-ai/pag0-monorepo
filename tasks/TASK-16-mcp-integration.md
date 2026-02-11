# TASK-16: MCP Server 통합 테스트

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/mcp` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-11](./TASK-11-integration.md) (백엔드 완성 필수) |
| **차단 대상** | [TASK-18](./TASK-18-demo-scenarios.md) |

## 목표

MCP Server가 실제 Proxy 백엔드와 정상적으로 통신하는지 통합 테스트를 수행한다.

## 현재 상태

- `packages/mcp/` — 12개 MCP Tool 구현 완료
  - `tools/wallet.ts` — `pag0_wallet_status`
  - `tools/proxy.ts` — `pag0_request` (402→sign→retry)
  - `tools/policy.ts` — `pag0_check_budget`, `pag0_check_policy`, `pag0_list_policies`
  - `tools/curation.ts` — `pag0_recommend`, `pag0_compare`, `pag0_rankings`, `pag0_score`
  - `tools/analytics.ts` — `pag0_spending`, `pag0_cache_stats`, `pag0_tx_history`
- `client.ts` — Pag0 Proxy API HTTP 클라이언트
- `wallet.ts` — ethers.Wallet 래퍼

## 테스트 항목

### 1. MCP → Proxy 연결 확인

```bash
# Backend 실행 상태에서
cd packages/mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx ts-node src/index.ts
# → 11개 tool 목록 반환
```

### 2. Policy Tools 테스트

```bash
# pag0_list_policies
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pag0_list_policies","arguments":{}}}' | npx ts-node src/index.ts
# → policies 배열 반환

# pag0_check_budget
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pag0_check_budget","arguments":{}}}' | npx ts-node src/index.ts
# → daily_remaining, monthly_remaining 포함
```

### 3. Curation Tools 테스트

```bash
# pag0_rankings (AI 카테고리)
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"pag0_rankings","arguments":{"category":"AI"}}}' | npx ts-node src/index.ts
# → endpoint_scores 기반 랭킹

# pag0_recommend
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"pag0_recommend","arguments":{"category":"AI","limit":3}}}' | npx ts-node src/index.ts
# → 추천 엔드포인트 목록
```

### 4. Analytics Tools 테스트

```bash
# pag0_spending
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"pag0_spending","arguments":{"period":"24h"}}}' | npx ts-node src/index.ts
# → spending summary

# pag0_cache_stats
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"pag0_cache_stats","arguments":{}}}' | npx ts-node src/index.ts
# → cache hit/miss 통계
```

### 5. client.ts 엔드포인트 매핑 검증

MCP `client.ts`의 API 경로가 Proxy 라우트와 일치하는지 확인:

| MCP client 메서드 | Proxy 라우트 |
|-------------------|-------------|
| `listPolicies()` | `GET /api/policies` |
| `checkBudget()` | `GET /api/analytics/summary` |
| `getRankings(category)` | `GET /api/curation/rankings?category=` |
| `getRecommendations(...)` | `GET /api/curation/recommend?category=` |
| `compareEndpoints(...)` | `GET /api/curation/compare?endpoints=` |
| `getSpending(period)` | `GET /api/analytics/costs?period=` |
| `getCacheStats()` | `GET /api/analytics/cache` |

## 환경변수 확인

`packages/mcp/.env`:
```
PAG0_API_URL=http://localhost:3000
PAG0_API_KEY=pag0_live_{valid_key_from_seed}
WALLET_PRIVATE_KEY={test_wallet_key}
NETWORK=skale-testnet
```

## 테스트 방법

```bash
# 1. Backend + DB 실행
pnpm docker:up
pnpm db:migrate && pnpm db:seed
pnpm dev:proxy

# 2. MCP Tool 목록 확인
cd packages/mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run src/index.ts

# 3. 각 tool 호출 테스트 (위 항목 참조)

# 4. 에러 케이스 확인
# → 잘못된 API Key로 호출 시 적절한 에러 메시지
# → 존재하지 않는 카테고리 조회 시 빈 결과
```

## 완료 기준

- [x] MCP Server 기동 + tool 목록 반환
- [x] Policy tools (list, check_budget, check_policy) 정상 동작
- [x] Curation tools (rankings, recommend, compare, score) 정상 동작
- [x] Analytics tools (spending, cache_stats, tx_history) 정상 동작
- [x] client.ts API 경로와 Proxy 라우트 매핑 일치 확인
- [x] 에러 케이스 핸들링 확인
