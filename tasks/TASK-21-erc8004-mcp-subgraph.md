# TASK-21: ERC-8004 MCP Tools + The Graph Subgraph

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/mcp` (MCP tools), 신규 `subgraph/` (The Graph) |
| **예상 시간** | 2~3시간 |
| **의존성** | [TASK-20](./TASK-20-erc8004-audit.md) (온체인 감사 데이터 존재), [TASK-16](./TASK-16-mcp-integration.md) |
| **차단 대상** | 없음 (최종 기능) |
| **참조 문서** | `docs/03-TECH-SPEC.md` §3.5 (subgraph schema), `docs/12-SDK-GUIDE.md` §1.6 (MCP tool 목록) |

## 목표

1. ERC-8004 온체인 감사 데이터를 조회하는 **MCP Tool 2개** 추가
2. ERC-8004 이벤트를 인덱싱하는 **The Graph Subgraph** 스키마 및 매핑 구현

## Part A: MCP Tools

### 1. `pag0_audit_trail` — 온체인 감사 기록 조회

```typescript
// packages/mcp/src/tools/audit.ts
server.tool("pag0_audit_trail", {
  endpoint: z.string().optional(),
  period: z.enum(["today", "week", "month"]).optional(),
}, async (args) => {
  // The Graph 서브그래프에서 FeedbackEvent 조회
  // → endpoint, txHash, qualityScore, feedbackURI, timestamp 반환
});
```

**출력 예시:**
```json
[
  {
    "endpoint": "api.openai.com",
    "txHash": "0xabc...",
    "qualityScore": 85,
    "feedbackURI": "ipfs://Qm...",
    "timestamp": "2026-02-11T14:00:00Z"
  }
]
```

### 2. `pag0_reputation` — 서비스 평판 점수 조회

```typescript
server.tool("pag0_reputation", {
  endpoint: z.string(),
}, async (args) => {
  // ReputationRegistry에서 giveFeedback 집계 데이터 반환
  // → avgScore, totalFeedbacks, recentTrend
});
```

**출력 예시:**
```json
{
  "endpoint": "api.openai.com",
  "avgScore": 92,
  "totalFeedbacks": 1250,
  "tag": "x402-payment",
  "recentTrend": "stable"
}
```

### 3. MCP client.ts 업데이트

```typescript
// packages/mcp/src/client.ts에 추가
async getAuditTrail(params: { endpoint?: string; period?: string }): Promise<...>;
async getReputation(endpoint: string): Promise<...>;
```

## Part B: The Graph Subgraph

### 1. 스키마 정의 (`subgraph/schema.graphql`)

```graphql
# ERC-8004 Audit Events
type Agent @entity {
  id: ID!
  name: String!           # agentIdRaw — 사람이 읽을 수 있는 hostname
  feedbacks: [FeedbackEvent!]! @derivedFrom(field: "agent")
  eventCount: Int!
  firstSeen: BigInt!
  lastSeen: BigInt!
}

type FeedbackEvent @entity {
  id: ID!
  agent: Agent!
  agentId: String!
  agentName: String!      # agentIdRaw — 원본 hostname 문자열
  value: Int!
  tag1: String!
  tag2: String!
  feedbackURI: String!
  feedbackHash: Bytes!
  timestamp: BigInt!
  txHash: String!
}

type ValidationRequestEvent @entity {
  id: ID!
  agentId: String!
  requestData: Bytes!
  timestamp: BigInt!
  txHash: String!
}

type ValidationResponseEvent @entity {
  id: ID!
  agentId: String!
  approved: Boolean!
  responseData: Bytes!
  timestamp: BigInt!
  txHash: String!
}
```

### 2. 이벤트 매핑 (`subgraph/src/mapping.ts`)

- `handleFeedbackGiven` — `event.params.agentIdRaw`에서 원본 hostname 추출 → `Agent.name` + `FeedbackEvent.agentName` 저장
- `handleValidationRequested` — ValidationRequestEvent 생성
- `handleValidationResponded` — ValidationResponseEvent 생성

### 3. 서브그래프 설정 (`subgraph/subgraph.yaml`)

- Network: SKALE (bite-v2-sandbox)
- DataSource: ReputationRegistry (`0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131`) + ValidationRegistry (`0x05bf80675DcFD3fdD1F7889685CB925C9c56c308`)
- Event signature: `FeedbackGiven(indexed string,string,uint256,bytes32,bytes32,string,bytes32)` — 두 번째 `string`이 `agentIdRaw`
- Subgraph: `pag0-erc8004/v1.1.0` on Goldsky

## 폴백 전략

- The Graph 미배포 시: 직접 RPC 호출로 이벤트 로그 조회 (느리지만 동작)
- 서브그래프 싱크 지연: 캐시된 최근 데이터 + "데이터가 최대 N분 지연될 수 있음" 메시지

## 완료 기준

- [x] `pag0_audit_trail` MCP tool 구현 + 등록
- [x] `pag0_reputation` MCP tool 구현 + 등록
- [x] MCP client.ts에 audit/reputation API 메서드 추가
- [x] The Graph subgraph schema 정의
- [x] Event mapping 구현
- [x] subgraph.yaml 설정
- [x] MCP build 성공
