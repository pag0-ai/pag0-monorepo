# TASK-41: MCP client/tools 라우트 및 필드명 정렬

**Priority**: P1 (MCP 도구 동작 불가)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: mcp

## 문제

MCP 패키지의 API 클라이언트와 도구 타입이 백엔드 실제 라우트/응답과 불일치.

### client.ts — 라우트 경로 불일치
TASK-37에서 `/api/reputation/*` 라우트가 구현되었지만, MCP client.ts는 아직 `/api/audit/*` 경로 사용.

| 이전 (틀림) | 이후 (맞음) |
|------------|-----------|
| `GET /api/audit/trail` | `GET /api/reputation/agent?id=` |
| `GET /api/audit/reputation/:endpoint` | `GET /api/reputation/feedbacks?agentId=` |
| (없음) | `GET /api/reputation/leaderboard` |

### tools/analytics.ts — 필드명 불일치
- `hitRate`/`savings` -> `cacheHits` (cache 도구)
- `totalSpent` -> `totalCost` (endpoints 도구)
- `p95LatencyMs` 추가 (endpoints 도구)

### tools/policy.ts — 필드명 방향 문제
`dailyBudget`/`monthlyBudget` -> `dailyLimit`/`monthlyLimit`로 변경하고 있으나, proxy-dev는 반대 방향으로 수정 중. 확인 필요.

## 수정 파일

- `packages/mcp/src/client.ts` — reputation API 메서드 3개 재구성
- `packages/mcp/src/tools/analytics.ts` — cache/endpoints 필드명 수정
- `packages/mcp/src/tools/policy.ts` — 필드명 확인 필요

## 완료 기준

- [x] client.ts reputation 라우트 경로가 `/api/reputation/*`과 일치
- [x] analytics tools 필드명이 백엔드 응답과 일치
- [x] policy tools 필드명이 proxy policies.ts 응답과 일치 (mcp-dev 수정 완료)
