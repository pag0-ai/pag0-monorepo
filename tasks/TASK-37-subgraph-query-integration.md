# TASK-37: Subgraph Query Integration — Read On-Chain Reputation Data

| Item | Content |
|------|------|
| **Package** | `packages/proxy` (main) |
| **Estimated Time** | 3~4 hours |
| **Dependencies** | [TASK-20](./TASK-20-erc8004-audit.md) (on-chain write), [TASK-21](./TASK-21-erc8004-mcp-subgraph.md) (subgraph deployment) |
| **Blocks** | None (final feature) |
| **Reference Docs** | `subgraph/schema.graphql`, `packages/proxy/src/audit/erc8004.ts`, `packages/proxy/src/curation/engine.ts` |

## Objective

Currently the proxy only **writes** ERC-8004 on-chain data (`giveFeedback`, `validationRequest`). **Read** data indexed by the subgraph to use in CurationEngine scores, API response metadata, and dashboard APIs.

## Current Status

- `erc8004.ts`: `recordPaymentFeedback()` → performs on-chain write only, no read methods
- `curation/engine.ts`: 3-dimensional scoring (`cost`, `latency`, `reliability`) based on off-chain DB (`requests` table)
- Subgraph: indexing `Agent`, `FeedbackEvent`, `ValidationRequestEvent`, `ValidationResponseEvent` entities
- Environment variable `ERC8004_SUBGRAPH_URL` already configured

## Implementation Tasks

### Step 1: Create SubgraphClient Module

Create `packages/proxy/src/subgraph/` directory:

```
packages/proxy/src/subgraph/
  client.ts    — SubgraphClient class (GraphQL fetch + Redis cache + error handling)
  queries.ts   — Named GraphQL query strings (includes name, agentName fields)
  types.ts     — Subgraph response TypeScript interfaces (includes name?, agentName? fields)
```

**SubgraphClient Core Design:**

```typescript
// packages/proxy/src/subgraph/client.ts
export class SubgraphClient {
  private url: string;          // ERC8004_SUBGRAPH_URL
  private cacheTTL: number;     // default 300s

  // Query agent reputation (FeedbackEvent aggregation)
  async getAgentReputation(agentId: string): Promise<{
    avgScore: number;
    feedbackCount: number;
    lastSeen: number;
  } | null>;

  // Agent profile (Agent entity + recent feedback)
  async getAgentProfile(agentId: string): Promise<AgentProfile | null>;

  // Feedback history (paginated)
  async getFeedbackHistory(agentId: string, first?: number, skip?: number): Promise<FeedbackEvent[]>;

  // Leaderboard (top agents by eventCount)
  async getLeaderboard(first?: number): Promise<AgentSummary[]>;
}
```

**Design Principles:**
- Use native `fetch()` for GraphQL POST requests (no external libraries needed)
- Redis cache: `subgraph:{queryHash}` key pattern, TTL 300s
- Return `null` on failure + `console.warn` (graceful degradation)
- Return `null` for all methods if `ERC8004_SUBGRAPH_URL` not configured

### Step 2: Add `reputation` Dimension to CurationEngine

Modify `packages/proxy/src/curation/engine.ts`:

**2-1. Extend ScoreWeights Interface**
```typescript
// Before: { cost: 0.4, latency: 0.3, reliability: 0.3 }
// After: { cost: 0.3, latency: 0.25, reliability: 0.25, reputation: 0.2 }
```

**2-2. Add Subgraph Query to calculateScore()**
```typescript
// Query FeedbackEvent average value by agentId (=endpoint hostname) from subgraph
const onChainRep = await subgraphClient.getAgentReputation(endpoint);
scores.reputationScore = onChainRep?.avgScore ?? 50; // Default to 50 if no data
```

**2-3. Cold-start Improvement**
- When off-chain `sampleSize < 10`, use on-chain score if available instead of default 50
- Can reference on-chain feedback recorded by other proxy operators

**Subgraph Query:**
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

### Step 3: Add `/api/reputation/*` Routes

Create `packages/proxy/src/routes/reputation.ts` → mount in `index.ts`:

| Method | Path | Description | Response Example |
|--------|------|------|-----------|
| GET | `/api/reputation/agent?id={endpoint}` | On-chain reputation profile | `{ agentId, agentName, avgScore, feedbackCount, firstSeen, lastSeen }` |
| GET | `/api/reputation/feedbacks?agentId={endpoint}` | Feedback history (paginated) | `{ feedbacks: [{ ..., agentName }], pagination }` |
| GET | `/api/reputation/leaderboard` | Agent rankings | `{ agents: [{ agentId, agentName, eventCount, avgScore }] }` |

> **Note**: `agentId` is the full endpoint URL (e.g., `https://api.openai.com/v1/chat`), so pass it as a query parameter instead of path parameter.

### Step 4: Enrich ProxyCore Response Metadata

Modify `packages/proxy/src/proxy/core.ts`:

```typescript
// Add to ProxyCoreResponse.metadata
metadata: {
  ...existing,
  onChainReputation?: {
    score: number;        // Average quality score
    feedbackCount: number;
    lastVerified: string; // ISO timestamp
  }
}
```

- Query via Redis-cached subgraph query (TTL 300s)
- Async enrichment near Step 7b

## types/index.ts Changes

```typescript
// Add to EndpointScore
export interface EndpointScore {
  ...existing,
  reputationScore?: number;  // On-chain reputation score (0-100)
}
```

## Environment Variables

```env
ERC8004_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1.1.0/gn
```

> Deployed to Goldsky as `pag0-erc8004/v1.1.0`. `.env.local` updated.

## Fallback Strategy

| Risk | Fallback |
|--------|------|
| Subgraph not deployed / URL not configured | Disable SubgraphClient, all methods return `null`. CurationEngine operates with existing 3-dimensional scoring |
| Subgraph response delay (>500ms) | Bypass with Redis cache hit. On cache miss, timeout and return `null` |
| graph-node down | `/api/reputation/*` routes return `503`. No impact on other features |

## Completion Criteria

- [x] `packages/proxy/src/subgraph/client.ts` created — GraphQL fetch + Redis cache
- [x] `packages/proxy/src/subgraph/queries.ts` created — AgentReputation, AgentProfile, FeedbackHistory, Leaderboard queries
- [x] `packages/proxy/src/subgraph/types.ts` created — Subgraph response interfaces
- [x] `SubgraphClient` gracefully disables when `ERC8004_SUBGRAPH_URL` not configured
- [x] `SubgraphClient` returns `null` on subgraph failure (does not throw)
- [x] `SubgraphClient` query results cached in Redis (key: `subgraph:{hash}`, TTL: 300s)
- [x] Added `reputationScore` as 4th dimension to `CurationEngine.calculateScore()`
- [x] Added `reputation: 0.2` to `DEFAULT_WEIGHTS`, rebalanced existing weights
- [x] When off-chain samples < 10 + on-chain data exists, use on-chain score as default
- [x] Added `reputationScore` field to `EndpointScore` in `types/index.ts`
- [x] `GET /api/reputation/agent?id={endpoint}` route working — returns agent reputation profile
- [x] `GET /api/reputation/feedbacks?agentId={endpoint}` route working — feedback history pagination
- [x] `GET /api/reputation/leaderboard` route working — top agent rankings
- [x] Added `ProxyCoreResponse.metadata.onChainReputation` field
- [x] Proxy build successful (`tsc --noEmit` passes)
- [x] Proxy starts normally even when subgraph is not running

## Verification Results

- **TypeScript**: `tsc --noEmit` 0 errors
- **Tests**: 41 pass / 0 fail (3 files, 19ms)
  - `subgraph/client.test.ts` — 13 tests (graceful degradation, parsing, calculation)
  - `curation/engine.test.ts` — 8 tests (reputation integration, cold-start, failure fallback)
  - `policy/engine.test.ts` — 20 tests (existing + mock signature fixes)
