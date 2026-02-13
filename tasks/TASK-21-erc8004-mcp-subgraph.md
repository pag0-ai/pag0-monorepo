# TASK-21: ERC-8004 MCP Tools + The Graph Subgraph

| Item | Content |
|------|---------|
| **Package** | `packages/mcp` (MCP tools), new `subgraph/` (The Graph) |
| **Estimated Time** | 2~3 hours |
| **Dependencies** | [TASK-20](./TASK-20-erc8004-audit.md) (on-chain audit data exists), [TASK-16](./TASK-16-mcp-integration.md) |
| **Blocks** | None (final feature) |
| **Reference Docs** | `docs/03-TECH-SPEC.md` §3.5 (subgraph schema), `docs/12-SDK-GUIDE.md` §1.6 (MCP tool list) |

## Goal

1. Add **2 MCP Tools** to query ERC-8004 on-chain audit data
2. Implement **The Graph Subgraph** schema and mappings to index ERC-8004 events

## Part A: MCP Tools

### 1. `pag0_audit_trail` — Query on-chain audit records

```typescript
// packages/mcp/src/tools/audit.ts
server.tool("pag0_audit_trail", {
  endpoint: z.string().optional(),
  period: z.enum(["today", "week", "month"]).optional(),
}, async (args) => {
  // Query FeedbackEvent from The Graph subgraph
  // → return endpoint, txHash, qualityScore, feedbackURI, timestamp
});
```

**Output example:**
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

### 2. `pag0_reputation` — Query service reputation score

```typescript
server.tool("pag0_reputation", {
  endpoint: z.string(),
}, async (args) => {
  // Return aggregated giveFeedback data from ReputationRegistry
  // → avgScore, totalFeedbacks, recentTrend
});
```

**Output example:**
```json
{
  "endpoint": "api.openai.com",
  "avgScore": 92,
  "totalFeedbacks": 1250,
  "tag": "x402-payment",
  "recentTrend": "stable"
}
```

### 3. Update MCP client.ts

```typescript
// Add to packages/mcp/src/client.ts
async getAuditTrail(params: { endpoint?: string; period?: string }): Promise<...>;
async getReputation(endpoint: string): Promise<...>;
```

## Part B: The Graph Subgraph

### 1. Schema definition (`subgraph/schema.graphql`)

```graphql
# ERC-8004 Audit Events
type Agent @entity {
  id: ID!
  name: String!           # agentIdRaw — human-readable hostname
  feedbacks: [FeedbackEvent!]! @derivedFrom(field: "agent")
  eventCount: Int!
  firstSeen: BigInt!
  lastSeen: BigInt!
}

type FeedbackEvent @entity {
  id: ID!
  agent: Agent!
  agentId: String!
  agentName: String!      # agentIdRaw — original hostname string
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

### 2. Event mappings (`subgraph/src/mapping.ts`)

- `handleFeedbackGiven` — extract original hostname from `event.params.agentIdRaw` → store in `Agent.name` + `FeedbackEvent.agentName`
- `handleValidationRequested` — create ValidationRequestEvent
- `handleValidationResponded` — create ValidationResponseEvent

### 3. Subgraph configuration (`subgraph/subgraph.yaml`)

- Network: SKALE (bite-v2-sandbox)
- DataSource: ReputationRegistry (`0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131`) + ValidationRegistry (`0x05bf80675DcFD3fdD1F7889685CB925C9c56c308`)
- Event signature: `FeedbackGiven(indexed string,string,uint256,bytes32,bytes32,string,bytes32)` — second `string` is `agentIdRaw`
- Subgraph: `pag0-erc8004/v1.1.0` on Goldsky

## Fallback Strategy

- If The Graph is not deployed: query event logs directly via RPC (slower but works)
- If subgraph sync is delayed: use cached recent data + "Data may be up to N minutes behind" message

## Completion Criteria

- [x] Implement and register `pag0_audit_trail` MCP tool
- [x] Implement and register `pag0_reputation` MCP tool
- [x] Add audit/reputation API methods to MCP client.ts
- [x] Define The Graph subgraph schema
- [x] Implement event mappings
- [x] Configure subgraph.yaml
- [x] MCP build succeeds
