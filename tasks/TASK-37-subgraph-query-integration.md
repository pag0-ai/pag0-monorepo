# TASK-37: Subgraph Query Integration — 온체인 평판 데이터 읽기

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` (주) |
| **예상 시간** | 3~4시간 |
| **의존성** | [TASK-20](./TASK-20-erc8004-audit.md) (온체인 쓰기), [TASK-21](./TASK-21-erc8004-mcp-subgraph.md) (서브그래프 배포) |
| **차단 대상** | 없음 (최종 기능) |
| **참조 문서** | `subgraph/schema.graphql`, `packages/proxy/src/audit/erc8004.ts`, `packages/proxy/src/curation/engine.ts` |

## 목표

현재 프록시는 ERC-8004 온체인 데이터를 **쓰기만** 한다 (`giveFeedback`, `validationRequest`). 서브그래프로 인덱싱된 데이터를 **읽어서** CurationEngine 점수, API 응답 메타데이터, 대시보드 API에 활용한다.

## 현재 상태

- `erc8004.ts`: `recordPaymentFeedback()` → 온체인 쓰기만 수행, 읽기 메서드 없음
- `curation/engine.ts`: 오프체인 DB(`requests` 테이블) 기반 3차원 점수 (`cost`, `latency`, `reliability`)
- 서브그래프: `Agent`, `FeedbackEvent`, `ValidationRequestEvent`, `ValidationResponseEvent` 엔티티 인덱싱 중
- 환경변수 `ERC8004_SUBGRAPH_URL` 이미 설정됨

## 구현 항목

### Step 1: SubgraphClient 모듈 생성

`packages/proxy/src/subgraph/` 디렉토리 생성:

```
packages/proxy/src/subgraph/
  client.ts    — SubgraphClient 클래스 (GraphQL fetch + Redis 캐시 + 에러 핸들링)
  queries.ts   — 네임드 GraphQL 쿼리 문자열 (name, agentName 필드 포함)
  types.ts     — 서브그래프 응답 TypeScript 인터페이스 (name?, agentName? 필드 포함)
```

**SubgraphClient 핵심 설계:**

```typescript
// packages/proxy/src/subgraph/client.ts
export class SubgraphClient {
  private url: string;          // ERC8004_SUBGRAPH_URL
  private cacheTTL: number;     // 기본 300s

  // 에이전트 평판 조회 (FeedbackEvent 집계)
  async getAgentReputation(agentId: string): Promise<{
    avgScore: number;
    feedbackCount: number;
    lastSeen: number;
  } | null>;

  // 에이전트 프로필 (Agent 엔티티 + 최근 피드백)
  async getAgentProfile(agentId: string): Promise<AgentProfile | null>;

  // 피드백 이력 (페이지네이션)
  async getFeedbackHistory(agentId: string, first?: number, skip?: number): Promise<FeedbackEvent[]>;

  // 리더보드 (eventCount 기준 상위 에이전트)
  async getLeaderboard(first?: number): Promise<AgentSummary[]>;
}
```

**설계 원칙:**
- 네이티브 `fetch()`로 GraphQL POST 요청 (외부 라이브러리 불필요)
- Redis 캐시: `subgraph:{queryHash}` 키 패턴, TTL 300s
- 실패 시 `null` 반환 + `console.warn` (graceful degradation)
- `ERC8004_SUBGRAPH_URL` 미설정 시 모든 메서드 `null` 반환

### Step 2: CurationEngine에 `reputation` 차원 추가

`packages/proxy/src/curation/engine.ts` 수정:

**2-1. ScoreWeights 인터페이스 확장**
```typescript
// 기존: { cost: 0.4, latency: 0.3, reliability: 0.3 }
// 변경: { cost: 0.3, latency: 0.25, reliability: 0.25, reputation: 0.2 }
```

**2-2. calculateScore()에 서브그래프 조회 추가**
```typescript
// 서브그래프에서 agentId(=endpoint hostname)로 FeedbackEvent 평균 value 조회
const onChainRep = await subgraphClient.getAgentReputation(endpoint);
scores.reputationScore = onChainRep?.avgScore ?? 50; // 데이터 없으면 기본 50
```

**2-3. Cold-start 개선**
- 오프체인 `sampleSize < 10`일 때 기본 50점 대신, 온체인 피드백 데이터가 있으면 해당 점수 활용
- 다른 프록시 운영자가 기록한 온체인 피드백도 참고 가능

**서브그래프 쿼리:**
```graphql
query AgentReputation($agentId: String!, $since: BigInt!) {
  feedbackEvents(
    where: { agentId: $agentId, timestamp_gte: $since }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    value
    timestamp
    txHash
  }
}
```

### Step 3: `/api/reputation/*` 라우트 추가

`packages/proxy/src/routes/reputation.ts` 생성 → `index.ts`에 마운트:

| Method | Path | 설명 | 응답 예시 |
|--------|------|------|-----------|
| GET | `/api/reputation/agent?id={endpoint}` | 온체인 평판 프로필 | `{ agentId, agentName, avgScore, feedbackCount, firstSeen, lastSeen }` |
| GET | `/api/reputation/feedbacks?agentId={endpoint}` | 피드백 이력 (페이지네이션) | `{ feedbacks: [{ ..., agentName }], pagination }` |
| GET | `/api/reputation/leaderboard` | 에이전트 랭킹 | `{ agents: [{ agentId, agentName, eventCount, avgScore }] }` |

> **참고**: `agentId`는 전체 endpoint URL (예: `https://api.openai.com/v1/chat`)이므로 path parameter 대신 query parameter로 전달한다.

### Step 4: ProxyCore 응답 메타데이터 보강

`packages/proxy/src/proxy/core.ts` 수정:

```typescript
// ProxyCoreResponse.metadata에 추가
metadata: {
  ...existing,
  onChainReputation?: {
    score: number;        // 평균 품질 점수
    feedbackCount: number;
    lastVerified: string; // ISO timestamp
  }
}
```

- Redis 캐시된 서브그래프 쿼리로 조회 (TTL 300s)
- Step 7b 근처에서 비동기 enrichment

## types/index.ts 변경

```typescript
// EndpointScore에 추가
export interface EndpointScore {
  ...existing,
  reputationScore?: number;  // 온체인 평판 점수 (0-100)
}
```

## 환경변수

```env
ERC8004_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1.1.0/gn
```

> Goldsky에 `pag0-erc8004/v1.1.0`으로 배포 완료. `.env.local` 업데이트됨.

## 폴백 전략

| 리스크 | 폴백 |
|--------|------|
| 서브그래프 미배포 / URL 미설정 | SubgraphClient 비활성화, 모든 메서드 `null` 반환. CurationEngine은 기존 3차원 점수로 동작 |
| 서브그래프 응답 지연 (>500ms) | Redis 캐시 히트로 우회. 캐시 미스 시 타임아웃 후 `null` |
| graph-node 다운 | `/api/reputation/*` 라우트는 `503` 반환. 다른 기능에 영향 없음 |

## 완료 기준

- [x] `packages/proxy/src/subgraph/client.ts` 생성 — GraphQL fetch + Redis 캐시
- [x] `packages/proxy/src/subgraph/queries.ts` 생성 — AgentReputation, AgentProfile, FeedbackHistory, Leaderboard 쿼리
- [x] `packages/proxy/src/subgraph/types.ts` 생성 — 서브그래프 응답 인터페이스
- [x] `SubgraphClient`가 `ERC8004_SUBGRAPH_URL` 미설정 시 graceful하게 비활성화됨
- [x] `SubgraphClient`가 서브그래프 장애 시 `null` 반환 (throw 안 함)
- [x] `SubgraphClient` 쿼리 결과가 Redis에 캐시됨 (키: `subgraph:{hash}`, TTL: 300s)
- [x] `CurationEngine.calculateScore()`에 `reputationScore` 4번째 차원 추가
- [x] `DEFAULT_WEIGHTS`에 `reputation: 0.2` 추가, 기존 가중치 재조정
- [x] 오프체인 샘플 < 10 + 온체인 데이터 존재 시 온체인 점수를 기본값으로 사용
- [x] `types/index.ts`의 `EndpointScore`에 `reputationScore` 필드 추가
- [x] `GET /api/reputation/agent?id={endpoint}` 라우트 동작 — 에이전트 평판 프로필 반환
- [x] `GET /api/reputation/feedbacks?agentId={endpoint}` 라우트 동작 — 피드백 이력 페이지네이션
- [x] `GET /api/reputation/leaderboard` 라우트 동작 — 상위 에이전트 랭킹
- [x] `ProxyCoreResponse.metadata.onChainReputation` 필드 추가
- [x] 프록시 빌드 성공 (`tsc --noEmit` 통과)
- [x] 서브그래프 미가동 상태에서도 프록시 정상 기동 확인

## 검증 결과

- **TypeScript**: `tsc --noEmit` 0 errors
- **테스트**: 41 pass / 0 fail (3 files, 19ms)
  - `subgraph/client.test.ts` — 13 tests (graceful degradation, parsing, calculation)
  - `curation/engine.test.ts` — 8 tests (reputation 통합, cold-start, 장애 폴백)
  - `policy/engine.test.ts` — 20 tests (기존 + 목 시그니처 수정)
