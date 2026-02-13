# Pag0 SDK Usage Guide

> **TL;DR**: `@pag0/sdk` is an x402 proxy layer that automates budget limits/API curation/caching with a single `createPag0Client()` call. Replace existing fetch with `pag0.fetch()` to immediately apply 40% cost savings and policy control.

## Related Documentation

| Document | Relevance |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | Architecture and proxy data flow |
| [04-API-SPEC.md](04-API-SPEC.md) | Detailed API endpoint specs |
| [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) | SDK usage use cases |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Core terms and abbreviations |

---

## 1. Quick Start (5 minutes)

### 1.1 Package Installation

```bash
# npm
npm install @pag0/sdk

# yarn
yarn add @pag0/sdk

# pnpm
pnpm add @pag0/sdk

# bun
bun add @pag0/sdk
```

### 1.2 API Key Issuance

**Method 1: Dashboard** (Recommended)

```
1. Visit https://dashboard.pag0.io
2. Create project (e.g., "my-research-agent")
3. Settings > API Keys > Generate New Key
4. Copy key (shown only once): pag0_prod_a1b2c3...
```

**Method 2: CLI**

```bash
# Install CLI
npm install -g @pag0/cli

# Login
pag0 login

# Create project and issue key
pag0 projects create my-research-agent
pag0 keys create --project my-research-agent

# Output:
# ✅ API Key created: pag0_prod_a1b2c3d4e5f6...
# ⚠️  Save this key securely. It won't be shown again.
```

### 1.3 Basic Setup + First Request

```typescript
import { createPag0Client } from '@pag0/sdk';

// 1. Initialize client
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!, // pag0_prod_xxx...
  policy: {
    maxPerRequest: '1000000',  // 1 USDC (6 decimals)
    dailyBudget: '10000000'    // 10 USDC
  },
  cache: {
    enabled: true,
    defaultTTL: 300  // 5 minutes
  }
});

// 2. First proxy request
const response = await pag0.fetch('https://api.example.com/translate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Hello, world!',
    targetLang: 'ko'
  })
});

// 3. Check response
console.log('Status:', response.status);
console.log('Data:', await response.json());
console.log('Meta:', response.meta);
// {
//   cached: false,
//   cost: '50000',           // 0.05 USDC
//   cacheSavings: '0',
//   endpoint: 'https://api.example.com/translate',
//   timestamp: '2024-01-15T10:30:00.000Z'
// }
```

### 1.4 Response Structure Explanation

```typescript
interface Pag0Response extends Response {
  // Standard Response properties (status, headers, body, etc.)
  status: number;
  ok: boolean;
  headers: Headers;
  json(): Promise<any>;
  text(): Promise<string>;

  // Pag0 extended properties
  meta: {
    cached: boolean;           // Cache hit status
    cost: string;              // Current request cost (USDC, 6 decimals)
    cacheSavings: string;      // Amount saved by cache
    endpoint: string;          // Original endpoint URL
    timestamp: string;         // ISO 8601 timestamp
    policyApplied: boolean;    // Policy application status
    budgetRemaining?: string;  // Remaining daily budget (optional)
  };
}
```

**Example Output**:

```json
{
  "status": 200,
  "ok": true,
  "meta": {
    "cached": true,
    "cost": "0",
    "cacheSavings": "50000",
    "endpoint": "https://api.example.com/translate",
    "timestamp": "2024-01-15T10:31:00.000Z",
    "policyApplied": true,
    "budgetRemaining": "9950000"
  }
}
```

### 1.5 x402 Integration Architecture

Pag0 SDK operates as a **proxy layer** on top of the x402 protocol's payment flow. It doesn't replace the existing `@x402/fetch`, but adds policy/cache/analytics features by routing through the Pag0 Proxy server.

**Payment Flow (CDP Wallet Integration):**

```
AI Agent           pag0-mcp              Pag0 Proxy       x402 Server     Facilitator
(Claude, etc.)    [CDP Wallet]
    │                │                       │                │                │
    │─ MCP tool ───▶│                       │                │                │
    │  pag0_fetch    │── pag0.fetch() ─────▶│                │                │
    │                │                       │── Forward ────▶│                │
    │                │                       │◀── 402 + Pay ─│                │
    │                │                       │                │                │
    │                │                       │ [Policy Check] │                │
    │                │                       │  Budget OK?    │                │
    │                │                       │  Allowlist OK? │                │
    │                │                       │                │                │
    │                │◀── 402 + PayReq ─────│                │                │
    │                │                       │                │                │
    │                │ [CDP Server Wallet    │                │                │
    │                │  signs payment]       │                │                │
    │                │                       │                │                │
    │                │── Signed Payment ────▶│── Forward ─────────────────────▶│
    │                │                       │◀── Verification ───────────────│
    │                │                       │── Retry+Proof ▶│                │
    │                │                       │◀── 200 Resp ──│                │
    │                │                       │                │                │
    │                │                       │ [Cache Store]  │                │
    │                │                       │ [Analytics Log]│                │
    │                │                       │ [Budget Update]│                │
    │                │                       │ [ERC-8004      │                │
    │                │                       │  giveFeedback  │                │
    │                │                       │  → IPFS + on-chain]│            │
    │                │                       │                │                │
    │                │◀── Response + Meta ──│                │                │
    │◀── Result ────│                       │                │                │
```

**Core Principles:**

| Principle | Description |
|------|------|
| **CDP Wallet Signs** | Payment signing is performed by the Coinbase CDP Server Wallet within pag0-mcp. Proxy only relays |
| **No Key Exposure to AI Agent** | Wallet keys are managed by Coinbase infrastructure; pag0-mcp only holds API Key |
| **Policies Applied on Server** | SDK `policy` settings are enforced on Pag0 Proxy server (cannot be bypassed by client) |
| **No Payment on Cache Hit** | When same request is in cache, x402 server call is skipped entirely |
| **100% x402 Spec Compliance** | Existing x402 security model is fully preserved |
| **ERC-8004 On-chain Audit** | After payment completion, proofOfPayment is automatically recorded in ReputationRegistry (IPFS + on-chain) |

### 1.6 pag0-mcp: MCP Interface for Agents

pag0-mcp is an **MCP server** that enables AI Agents (Claude, GPT, etc.) to use all Pag0 features as MCP tools. With built-in CDP Wallet, agents can complete x402 payments with just tool calls, without wallet management.

**Provided MCP Tools:**

```typescript
// MCP Tools exposed by pag0-mcp
const tools = {
  // x402 request (includes 402→CDP Wallet sign→retry automatically)
  pag0_fetch: {
    description: 'Call x402 API (payment handled automatically)',
    params: { url: string, method?: string, body?: object },
    // Internal: Via Pag0 Proxy → receive 402 → CDP Wallet signs → return result
  },

  // API recommendation
  pag0_recommend: {
    description: 'Recommend optimal x402 API by category',
    params: { category: string, optimize?: 'cost' | 'speed' | 'reliability' },
  },

  // Spending check
  pag0_get_spent: {
    description: 'Check spending and remaining budget by period',
    params: { period?: 'today' | 'week' | 'month' },
  },

  // Wallet balance
  pag0_wallet_balance: {
    description: 'Check CDP Wallet USDC/ETH balance',
    params: {},
  },

  // Testnet funding (for development)
  pag0_wallet_fund: {
    description: 'Fund Base Sepolia testnet USDC',
    params: { amount?: string },
  },

  // API comparison
  pag0_compare: {
    description: 'Compare performance/cost of multiple x402 API endpoints',
    params: { endpoints: string[] },
  },

  // ERC-8004 on-chain audit lookup
  pag0_audit_trail: {
    description: 'Query ERC-8004 on-chain audit records (payment proof, service quality)',
    params: { endpoint?: string, period?: 'today' | 'week' | 'month' },
    // Internal: Query FeedbackEvent from The Graph subgraph
  },

  // ERC-8004 service reputation lookup
  pag0_reputation: {
    description: 'Query x402 server ERC-8004 ReputationRegistry reputation score',
    params: { endpoint: string },
    // Internal: Return giveFeedback aggregated data from ReputationRegistry
  },
};
```

**Agent Usage Example (Claude):**

```
User: "Translate this paper to Korean"

Claude:
  1. pag0_recommend({ category: "translation", optimize: "balanced" })
     → DeepL API (score: 95, cost: $0.015)

  2. pag0_fetch({ url: "https://api.deepl.com/v2/translate", method: "POST", body: {...} })
     → pag0-mcp internal:
       a. Request to Pag0 Proxy → receive 402 (0.015 USDC)
       b. Policy validation passed (within daily budget)
       c. CDP Server Wallet signs payment
       d. Facilitator verification → 200 response
     → "Hello, World!" (translation result)

  3. pag0_get_spent({ period: "today" })
     → { total: "0.015 USDC", remaining: "9.985 USDC" }

  4. pag0_audit_trail({ period: "today" })
     → [{ endpoint: "api.deepl.com", txHash: "0xabc...", qualityScore: 85,
          feedbackURI: "ipfs://Qm...", timestamp: "..." }]

  5. pag0_reputation({ endpoint: "https://api.deepl.com/v2/translate" })
     → { avgScore: 92, totalFeedbacks: 1250, tag: "x402-payment" }
```

---

## 2. Initialization Options

### 2.1 Complete Configuration Options

```typescript
import { createPag0Client, Pag0ClientConfig } from '@pag0/sdk';

const config: Pag0ClientConfig = {
  // ============================================
  // Required Options
  // ============================================
  apiKey: string;                    // Pag0 API Key (pag0_xxx...)

  // ============================================
  // Policy Settings
  // ============================================
  policy?: {
    maxPerRequest?: string;          // Max cost per request (USDC, 6 decimals)
    dailyBudget?: string;            // Daily budget limit
    monthlyBudget?: string;          // Monthly budget limit
    allowedEndpoints?: string[];     // Allowed endpoints (whitelist)
    blockedEndpoints?: string[];     // Blocked endpoints (blacklist)
    requireApproval?: {              // Approval workflow
      threshold: string;             // Amount requiring approval
      webhookUrl: string;            // Approval request webhook
      timeoutSeconds: number;        // Approval wait time
    };
    anomalyDetection?: {             // Anomaly detection
      enabled: boolean;
      maxDeviationPercent: number;   // Max allowed deviation from average (%)
      alertWebhook: string;          // Alert webhook
    };
  };

  // ============================================
  // Cache Settings
  // ============================================
  cache?: {
    enabled: boolean;                // Enable cache
    defaultTTL?: number;             // Default TTL (seconds)
    maxCacheSize?: number;           // Max cache size (bytes)
    ttlRules?: Array<{               // Per-endpoint TTL rules
      pattern: string;               // URL pattern (regex)
      ttl: number;                   // TTL (seconds)
    }>;
    excludePatterns?: string[];      // Cache exclusion patterns
  };

  // ============================================
  // Network Settings
  // ============================================
  network?: 'base' | 'base-sepolia'; // Default: 'base'
  facilitatorUrl?: string;           // Custom facilitator URL

  // ============================================
  // SDK Behavior Settings
  // ============================================
  baseURL?: string;                  // Pag0 Proxy URL (default: https://api.pag0.io)
  timeout?: number;                  // Request timeout (ms, default: 30000)
  retries?: number;                  // Retry count (default: 3)
  fallbackMode?: 'direct' | 'fail';  // Behavior on Proxy failure
                                     // 'direct': Direct x402 call
                                     // 'fail': Immediate failure
  onCostUpdate?: (cost: string) => void;  // Cost update callback
  onPolicyViolation?: (error: PolicyError) => void;  // Policy violation callback
};

const pag0 = createPag0Client(config);
```

### 2.2 Policy Configuration Methods

**Example 1: Basic Budget Limits**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    maxPerRequest: '500000',   // Max 0.5 USDC per request
    dailyBudget: '5000000',    // 5 USDC per day
    monthlyBudget: '100000000' // 100 USDC per month
  }
});
```

**Example 2: Endpoint Whitelist**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    allowedEndpoints: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://translate.googleapis.com/*'
    ],
    dailyBudget: '10000000'
  }
});

// ✅ Allowed
await pag0.fetch('https://api.openai.com/v1/completions');

// ❌ Blocked (PolicyViolationError)
await pag0.fetch('https://unknown-api.com/endpoint');
```

**Example 3: Approval Workflow** (High-value payments)

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    maxPerRequest: '10000000', // Regular requests: max 10 USDC
    requireApproval: {
      threshold: '5000000',    // 5 USDC or more requires approval
      webhookUrl: 'https://myapp.com/approve-payment',
      timeoutSeconds: 300      // 5 minute wait
    }
  }
});

// For requests over 5 USDC:
// 1. Send approval request via webhook
// 2. Wait 5 minutes for approval
// 3. Proceed if approved, error if rejected/timeout
```

**Example 4: Anomaly Detection**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '10000000',
    anomalyDetection: {
      enabled: true,
      maxDeviationPercent: 200, // Alert if exceeds average by 200%
      alertWebhook: 'https://myapp.com/alert'
    }
  }
});

// Usually 0.1 USDC per request → suddenly 0.3 USDC (300% increase)
// → Send webhook alert (no automatic blocking)
```

### 2.3 Cache Configuration Methods

**Example 1: Global Cache Activation**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 600,        // 10 minutes
    maxCacheSize: 10485760  // 10 MB
  }
});
```

**Example 2: Per-Endpoint TTL Rules**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    ttlRules: [
      {
        pattern: 'https://api.coingecko.com/.*',
        ttl: 60  // Price data cached for 1 minute only
      },
      {
        pattern: 'https://api.openai.com/.*',
        ttl: 3600  // LLM responses cached for 1 hour
      },
      {
        pattern: 'https://translate.googleapis.com/.*',
        ttl: 86400  // Translations cached for 24 hours
      }
    ]
  }
});
```

**Example 3: Cache Exclusion Patterns**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    excludePatterns: [
      'https://api.example.com/realtime/*',  // Real-time data
      '.*timestamp.*',                        // URLs with timestamp
      '.*nonce.*'                             // URLs with nonce
    ]
  }
});
```

### 2.4 Network Settings

**Using Testnet** (Base Sepolia):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  network: 'base-sepolia',
  facilitatorUrl: 'https://facilitator-testnet.cdp.coinbase.com'
});
```

**Production** (Base Mainnet):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  network: 'base', // Default
  facilitatorUrl: 'https://facilitator.cdp.coinbase.com' // Default
});
```

---

## 3. Core APIs

### 3.1 pag0.fetch() - Requests via Proxy

**Basic Usage**:

```typescript
const response = await pag0.fetch(url: string, options?: RequestInit);
```

**Example 1: GET Request**

```typescript
const response = await pag0.fetch('https://api.example.com/data');
const data = await response.json();

console.log('Cost:', response.meta.cost);
console.log('Cached:', response.meta.cached);
```

**Example 2: POST Request**

```typescript
const response = await pag0.fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-xxx'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const result = await response.json();
console.log('AI Response:', result.choices[0].message.content);
console.log('Cost:', response.meta.cost, 'USDC');
```

**Example 3: Cache Bypass**

```typescript
// Skip cache for specific request only
const response = await pag0.fetch('https://api.example.com/latest', {
  headers: {
    'X-Pag0-Cache-Bypass': 'true'
  }
});
```

### 3.2 pag0.recommend() - API Recommendations

**Basic Usage**:

```typescript
const recommendations = await pag0.recommend({
  category: string;              // API category
  optimize?: 'cost' | 'speed' | 'reliability' | 'balanced'; // Optimization criteria
  limit?: number;                // Number of results (default: 5)
});
```

**Example 1: Translation API Recommendation (Cost Optimized)**

```typescript
const best = await pag0.recommend({
  category: 'translation',
  optimize: 'cost'
});

console.log('Best translation API:', best[0]);
// {
//   endpoint: 'https://api.deepl.com/v2/translate',
//   avgCost: '15000',        // 0.015 USDC per request
//   avgSpeed: 1200,          // 1.2 seconds
//   reliabilityScore: 0.98,  // 98% uptime
//   score: 0.95,             // Overall score
//   usageCount: 1250         // Real usage data (from Pag0 users)
// }

// Use recommended API
const translation = await pag0.fetch(best[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({ text: 'Hello', target_lang: 'KO' })
});
```

**Example 2: Routing API Recommendation (Speed Optimized)**

```typescript
const fastest = await pag0.recommend({
  category: 'defi-routing',
  optimize: 'speed',
  limit: 3
});

// Select fastest API
const routing = await pag0.fetch(fastest[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    amount: '1000000'
  })
});
```

**Example 3: Balanced Recommendation**

```typescript
const balanced = await pag0.recommend({
  category: 'llm',
  optimize: 'balanced' // Balance cost, speed, and reliability
});

// Use LLM with highest overall score
const llmResponse = await pag0.fetch(balanced[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Explain quantum computing',
    max_tokens: 500
  })
});
```

### 3.3 pag0.compare() - API Comparison

**Basic Usage**:

```typescript
const comparison = await pag0.compare(endpoints: string[]);
```

**Example: Compare 3 Translation APIs**

```typescript
const comparison = await pag0.compare([
  'https://api.deepl.com/v2/translate',
  'https://translation.googleapis.com/language/translate/v2',
  'https://api.openai.com/v1/chat/completions'
]);

console.log(comparison);
// [
//   {
//     endpoint: 'https://api.deepl.com/v2/translate',
//     avgCost: '15000',
//     avgSpeed: 1200,
//     reliabilityScore: 0.98,
//     score: 0.95
//   },
//   {
//     endpoint: 'https://translation.googleapis.com/...',
//     avgCost: '20000',
//     avgSpeed: 800,
//     reliabilityScore: 0.99,
//     score: 0.92
//   },
//   {
//     endpoint: 'https://api.openai.com/...',
//     avgCost: '100000',
//     avgSpeed: 3000,
//     reliabilityScore: 0.97,
//     score: 0.75
//   }
// ]

// Visualize
comparison.forEach(api => {
  console.log(`${api.endpoint}`);
  console.log(`  Cost: $${(parseInt(api.avgCost) / 1e6).toFixed(3)}`);
  console.log(`  Speed: ${api.avgSpeed}ms`);
  console.log(`  Score: ${(api.score * 100).toFixed(0)}%`);
});
```

### 3.4 pag0.getSpent() - Check Spending

**Basic Usage**:

```typescript
const spent = await pag0.getSpent(period?: 'today' | 'week' | 'month');
```

**Example**:

```typescript
// Today's spending
const today = await pag0.getSpent('today');
console.log('Today:', today);
// {
//   total: '2500000',        // 2.5 USDC
//   budgetLimit: '10000000', // 10 USDC
//   remaining: '7500000',    // 7.5 USDC
//   requestCount: 150,
//   cacheSavings: '1200000'  // 1.2 USDC saved
// }

// Weekly spending
const week = await pag0.getSpent('week');
console.log('This week:', week.total);

// Monthly spending
const month = await pag0.getSpent('month');
console.log('This month:', month.total);

// Check budget exceeded
if (parseInt(today.remaining) < 0) {
  console.warn('Daily budget exceeded!');
}
```

### 3.5 pag0.getAnalytics() - Query Analytics Data

**Basic Usage**:

```typescript
const analytics = await pag0.getAnalytics({
  period?: 'day' | 'week' | 'month';
  groupBy?: 'endpoint' | 'hour' | 'day';
});
```

**Example 1: Usage by Endpoint**

```typescript
const byEndpoint = await pag0.getAnalytics({
  period: 'week',
  groupBy: 'endpoint'
});

console.log('Top endpoints:', byEndpoint);
// [
//   {
//     endpoint: 'https://api.openai.com/v1/chat/completions',
//     requestCount: 450,
//     totalCost: '4500000',
//     avgCost: '10000',
//     cacheHitRate: 0.35
//   },
//   {
//     endpoint: 'https://api.deepl.com/v2/translate',
//     requestCount: 200,
//     totalCost: '300000',
//     avgCost: '15000',
//     cacheHitRate: 0.60
//   }
// ]
```

**Example 2: Usage by Time**

```typescript
const byHour = await pag0.getAnalytics({
  period: 'day',
  groupBy: 'hour'
});

// Create chart
byHour.forEach(hour => {
  const bar = '█'.repeat(hour.requestCount / 10);
  console.log(`${hour.hour}:00 ${bar} ${hour.requestCount} requests`);
});
// 00:00 ████ 40 requests
// 01:00 ██ 20 requests
// ...
```

---

## 4. Policy Configuration Guide

### 4.1 Budget Limit Settings

**Scenario 1: Development/Test Environment**

```typescript
const pag0Dev = createPag0Client({
  apiKey: process.env.PAG0_DEV_KEY!,
  policy: {
    maxPerRequest: '100000',   // 0.1 USDC
    dailyBudget: '1000000',    // 1 USDC/day
    monthlyBudget: '10000000'  // 10 USDC/month
  }
});
```

**Scenario 2: Production (Small Scale)**

```typescript
const pag0Prod = createPag0Client({
  apiKey: process.env.PAG0_PROD_KEY!,
  policy: {
    maxPerRequest: '1000000',    // 1 USDC
    dailyBudget: '50000000',     // 50 USDC/day
    monthlyBudget: '1000000000'  // 1000 USDC/month
  }
});
```

**Scenario 3: Enterprise**

```typescript
const pag0Enterprise = createPag0Client({
  apiKey: process.env.PAG0_ENTERPRISE_KEY!,
  policy: {
    maxPerRequest: '10000000',      // 10 USDC
    dailyBudget: '1000000000',      // 1000 USDC/day
    monthlyBudget: '20000000000',   // 20,000 USDC/month
    requireApproval: {
      threshold: '5000000',         // Approval required for 5 USDC or more
      webhookUrl: 'https://erp.company.com/approve',
      timeoutSeconds: 600           // 10 minute wait
    }
  }
});
```

### 4.2 Endpoint Whitelist/Blacklist

**Whitelist Strategy** (Recommended - Conservative):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    allowedEndpoints: [
      // AI APIs
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',

      // Translation
      'https://api.deepl.com/*',
      'https://translation.googleapis.com/*',

      // DeFi
      'https://api.1inch.io/*',
      'https://api.uniswap.org/*',

      // Data
      'https://api.coingecko.com/*',
      'https://api.coinmarketcap.com/*'
    ],
    dailyBudget: '10000000'
  }
});
```

**Blacklist Strategy** (Flexible - Block Specific APIs Only):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    blockedEndpoints: [
      'https://expensive-api.com/*',      // High-cost API
      'https://unreliable-service.io/*',  // Unstable service
      '.*\\.onion/.*'                      // Block Tor network
    ],
    dailyBudget: '10000000'
  }
});
```

### 4.3 Approval Workflow Setup

**Webhook Server Implementation**:

```typescript
// approval-server.ts
import express from 'express';

const app = express();
app.use(express.json());

app.post('/approve-payment', async (req, res) => {
  const { requestId, endpoint, cost, timestamp } = req.body;

  // 1. Save approval request to database
  await db.insert('approval_requests', {
    request_id: requestId,
    endpoint,
    cost,
    status: 'pending'
  });

  // 2. Slack/Discord notification
  await sendSlackMessage({
    text: `💰 Payment approval required`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Endpoint:* ${endpoint}\n*Cost:* $${(parseInt(cost) / 1e6).toFixed(2)} USDC`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            value: requestId,
            action_id: 'approve'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            value: requestId,
            action_id: 'reject'
          }
        ]
      }
    ]
  });

  // 3. Wait for approval (polling or webhook)
  const result = await waitForApproval(requestId, 300); // 5 minute wait

  if (result === 'approved') {
    res.json({ approved: true });
  } else {
    res.json({ approved: false, reason: result });
  }
});

app.listen(3001);
```

**SDK Usage**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    requireApproval: {
      threshold: '5000000',
      webhookUrl: 'https://myapp.com/approve-payment',
      timeoutSeconds: 300
    }
  }
});

// High-value request automatically enters approval workflow
try {
  const response = await pag0.fetch('https://expensive-api.com/analyze', {
    method: 'POST',
    body: JSON.stringify({ data: 'large-dataset' })
  });
} catch (err) {
  if (err instanceof ApprovalTimeoutError) {
    console.error('Approval timeout or rejected');
  }
}
```

### 4.4 Anomaly Detection Setup

**Anomaly Detection Webhook Implementation**:

```typescript
// alert-handler.ts
app.post('/anomaly-alert', async (req, res) => {
  const { type, endpoint, cost, avgCost, deviation } = req.body;

  // 1. Log record
  console.warn(`⚠️ Anomaly detected: ${type}`);
  console.warn(`Endpoint: ${endpoint}`);
  console.warn(`Current: $${(parseInt(cost) / 1e6).toFixed(3)}`);
  console.warn(`Average: $${(parseInt(avgCost) / 1e6).toFixed(3)}`);
  console.warn(`Deviation: ${deviation}%`);

  // 2. Discord notification
  await sendDiscordAlert({
    title: '🚨 Cost Anomaly Detected',
    fields: [
      { name: 'Endpoint', value: endpoint },
      { name: 'Current Cost', value: `$${(parseInt(cost) / 1e6).toFixed(3)}` },
      { name: 'Deviation', value: `+${deviation}%` }
    ],
    color: 0xff0000
  });

  // 3. Auto-update policy if needed
  if (deviation > 500) {
    await pag0.updatePolicy({
      blockedEndpoints: [endpoint] // Block this endpoint
    });
  }

  res.json({ acknowledged: true });
});
```

**SDK Configuration**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '10000000',
    anomalyDetection: {
      enabled: true,
      maxDeviationPercent: 200,
      alertWebhook: 'https://myapp.com/anomaly-alert'
    }
  }
});
```

---

## 5. Cache Configuration Guide

### 5.1 TTL Settings

**Basic Principles**:

- **Real-time data**: Short TTL (30-60 seconds)
- **Semi-static data**: Medium TTL (5-30 minutes)
- **Static data**: Long TTL (1-24 hours)

**Example**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300, // 5 minutes (default)
    ttlRules: [
      // Real-time price data
      {
        pattern: 'https://api.coingecko.com/api/v3/simple/price.*',
        ttl: 30  // 30 seconds
      },

      // DeFi routing (gas price fluctuation)
      {
        pattern: 'https://api.1inch.io/v5.0/.*/quote.*',
        ttl: 60  // 1 minute
      },

      // LLM responses (same prompt)
      {
        pattern: 'https://api.openai.com/v1/chat/completions',
        ttl: 3600  // 1 hour
      },

      // Translation (same text)
      {
        pattern: 'https://api.deepl.com/v2/translate',
        ttl: 86400  // 24 hours
      },

      // Blockchain data (finalized blocks)
      {
        pattern: 'https://.*\\.infura\\.io/.*',
        ttl: 600  // 10 minutes
      }
    ]
  }
});
```

### 5.2 Per-Endpoint TTL Rules

**URL Pattern Matching**:

```typescript
ttlRules: [
  // Exact match
  {
    pattern: 'https://api.example.com/static',
    ttl: 86400
  },

  // Wildcard match
  {
    pattern: 'https://api.example.com/data/*',
    ttl: 300
  },

  // Regex match
  {
    pattern: 'https://api\\..*\\.com/prices/.*',
    ttl: 60
  },

  // Including query parameters
  {
    pattern: 'https://api.example.com/search\\?.*cache=long.*',
    ttl: 3600
  }
]
```

### 5.3 Cache Exclusion Patterns

**Requests to Exclude**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    excludePatterns: [
      // 1. Nonce/Timestamp included (always unique)
      '.*nonce=.*',
      '.*timestamp=.*',

      // 2. Auth tokens (sensitive data)
      '.*token=.*',
      '.*api_key=.*',

      // 3. Real-time streaming
      'https://api.example.com/stream/.*',

      // 4. WebSocket upgrade
      '.*ws://.*',
      '.*wss://.*',

      // 5. POST/PUT/DELETE (not idempotent)
      // SDK automatically excludes, but can be specified

      // 6. User-specific personalized data
      'https://api.example.com/user/.*/recommendations'
    ]
  }
});
```

### 5.4 Cache Bypass (X-Pag0-Cache-Bypass Header)

**When to Use?**

- Debugging (always need latest response)
- Testing (cache invalidation)
- Specific requests only need fresh data

**Usage Example**:

```typescript
// Normal request (use cache)
const cached = await pag0.fetch('https://api.example.com/data');
console.log('Cached:', cached.meta.cached); // true

// Cache bypass (always fresh)
const fresh = await pag0.fetch('https://api.example.com/data', {
  headers: {
    'X-Pag0-Cache-Bypass': 'true'
  }
});
console.log('Cached:', fresh.meta.cached); // false
console.log('Cost:', fresh.meta.cost); // Actual cost incurred
```

---

## 6. Curation API Guide

### 6.1 Get Recommendations by Category

**Supported Categories** (as of January 2024):

```typescript
type APICategory =
  | 'translation'      // Translation
  | 'llm'              // Large Language Models
  | 'defi-routing'     // DeFi swap routing
  | 'price-feeds'      // Price data
  | 'gas-estimation'   // Gas fee estimation
  | 'nft-metadata'     // NFT metadata
  | 'blockchain-data'  // Blockchain indexing
  | 'ai-image'         // AI image generation
  | 'speech-to-text'   // Speech recognition
  | 'text-to-speech';  // TTS
```

**Example 1: Translation API**

```typescript
const translationAPIs = await pag0.recommend({
  category: 'translation',
  optimize: 'balanced',
  limit: 5
});

// Result:
// [
//   { endpoint: 'https://api.deepl.com/v2/translate', score: 0.95 },
//   { endpoint: 'https://translation.googleapis.com/...', score: 0.92 },
//   { endpoint: 'https://api.openai.com/v1/chat/completions', score: 0.75 }
// ]
```

**Example 2: DeFi Routing**

```typescript
const routingAPIs = await pag0.recommend({
  category: 'defi-routing',
  optimize: 'cost' // Cheapest router
});

const bestRouter = routingAPIs[0];
const quote = await pag0.fetch(bestRouter.endpoint, {
  method: 'GET',
  params: {
    fromToken: 'USDC',
    toToken: 'WETH',
    amount: '1000000000' // 1000 USDC
  }
});
```

### 6.2 Setting Optimization Criteria

**optimize Options Detail**:

```typescript
type OptimizeCriteria =
  | 'cost'        // Price priority (lowest avgCost)
  | 'speed'       // Speed priority (lowest avgSpeed)
  | 'reliability' // Stability priority (highest reliabilityScore)
  | 'balanced';   // Balanced (highest overall score)
```

**Score Calculation Method**:

```typescript
// 'balanced' score calculation
score = (
  (1 / normalizeCost(avgCost)) * 0.4 +
  (1 / normalizeSpeed(avgSpeed)) * 0.3 +
  reliabilityScore * 0.3
);

// 'cost' optimization
score = 1 / normalizeCost(avgCost);

// 'speed' optimization
score = 1 / normalizeSpeed(avgSpeed);

// 'reliability' optimization
score = reliabilityScore;
```

**Example: Compare Optimization Criteria**

```typescript
const llmAPIs = {
  cost: await pag0.recommend({ category: 'llm', optimize: 'cost' }),
  speed: await pag0.recommend({ category: 'llm', optimize: 'speed' }),
  balanced: await pag0.recommend({ category: 'llm', optimize: 'balanced' })
};

console.log('Cost-optimized:', llmAPIs.cost[0].endpoint);
// → https://api.cheaper-llm.com/v1/generate

console.log('Speed-optimized:', llmAPIs.speed[0].endpoint);
// → https://api.fast-llm.com/v1/generate

console.log('Balanced:', llmAPIs.balanced[0].endpoint);
// → https://api.openai.com/v1/chat/completions
```

### 6.3 Compare APIs

**Direct Comparison (2-10 endpoints)**:

```typescript
const comparison = await pag0.compare([
  'https://api.openai.com/v1/chat/completions',
  'https://api.anthropic.com/v1/complete',
  'https://api.cohere.ai/v1/generate'
]);

// Output as table
console.table(comparison.map(api => ({
  'API': api.endpoint.split('/')[2], // Domain only
  'Avg Cost ($)': (parseInt(api.avgCost) / 1e6).toFixed(3),
  'Avg Speed (ms)': api.avgSpeed,
  'Reliability (%)': (api.reliabilityScore * 100).toFixed(0),
  'Score': (api.score * 100).toFixed(0)
})));

// Output:
// ┌─────────┬──────────────┬───────────────┬─────────────────┬───────┐
// │ (index) │     API      │ Avg Cost ($)  │ Avg Speed (ms)  │ Score │
// ├─────────┼──────────────┼───────────────┼─────────────────┼───────┤
// │    0    │ 'openai.com' │   '0.100'     │      2500       │  '75' │
// │    1    │'anthropic...'│   '0.120'     │      2800       │  '72' │
// │    2    │ 'cohere.ai'  │   '0.080'     │      3000       │  '78' │
// └─────────┴──────────────┴───────────────┴─────────────────┴───────┘
```

### 6.4 Query Rankings

**Overall Rankings** (Top 10 per category):

```typescript
const ranking = await pag0.getRanking({
  category: 'translation',
  period: 'month', // 'day' | 'week' | 'month'
  sortBy: 'score'  // 'score' | 'usageCount' | 'avgCost'
});

console.log('Translation API Rankings (Monthly):');
ranking.forEach((api, idx) => {
  console.log(`${idx + 1}. ${api.endpoint}`);
  console.log(`   Score: ${(api.score * 100).toFixed(0)}% | Usage: ${api.usageCount} requests`);
});
```

### 6.5 Query Individual Endpoint Score

**Specific API Details**:

```typescript
const apiStats = await pag0.getEndpointStats('https://api.deepl.com/v2/translate');

console.log(apiStats);
// {
//   endpoint: 'https://api.deepl.com/v2/translate',
//   category: 'translation',
//   avgCost: '15000',
//   avgSpeed: 1200,
//   reliabilityScore: 0.98,
//   usageCount: 5420,
//   cacheHitRate: 0.62,
//   lastUpdated: '2024-01-15T10:30:00.000Z',
//   trends: {
//     costTrend: -0.05,      // 5% decrease (good)
//     speedTrend: 0.10,      // 10% increase (bad)
//     reliabilityTrend: 0.02 // 2% increase (good)
//   }
// }
```

---

## 7. Framework Integration

### 7.1 Express.js Middleware

```typescript
import express from 'express';
import { createPag0Client } from '@pag0/sdk';

const app = express();
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: { dailyBudget: '10000000' }
});

// Pag0 middleware
app.use((req, res, next) => {
  req.pag0 = pag0;
  next();
});

// Use in route
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;

  const translation = await req.pag0.fetch('https://api.deepl.com/v2/translate', {
    method: 'POST',
    body: JSON.stringify({ text, target_lang: targetLang })
  });

  res.json({
    result: await translation.json(),
    meta: translation.meta
  });
});

app.listen(3000);
```

### 7.2 Next.js Integration

**API Route** (`pages/api/proxy.ts`):

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPag0Client } from '@pag0/sdk';

const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, options } = req.body;

  try {
    const response = await pag0.fetch(url, options);
    const data = await response.json();

    res.status(response.status).json({
      data,
      meta: response.meta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**Client-side Usage**:

```typescript
// components/TranslateButton.tsx
export function TranslateButton({ text }: { text: string }) {
  const [translation, setTranslation] = useState('');

  const handleTranslate = async () => {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.deepl.com/v2/translate',
        options: {
          method: 'POST',
          body: JSON.stringify({ text, target_lang: 'KO' })
        }
      })
    });

    const { data, meta } = await res.json();
    setTranslation(data.translations[0].text);
    console.log('Cost:', meta.cost);
  };

  return <button onClick={handleTranslate}>Translate</button>;
}
```

### 7.3 Python SDK (httpx wrapper)

```python
# pag0/__init__.py
import httpx
import os
from typing import Optional, Dict, Any

class Pag0Client:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.pag0.io",
        policy: Optional[Dict] = None,
        cache: Optional[Dict] = None
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

        # Initialize policy if provided
        if policy:
            self._set_policy(policy)

    async def fetch(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict] = None,
        data: Optional[Any] = None
    ) -> Dict:
        """Proxy request through Pag0"""
        proxy_url = f"{self.base_url}/proxy"

        payload = {
            "url": url,
            "method": method,
            "headers": headers or {},
            "body": data
        }

        response = await self.client.post(
            proxy_url,
            json=payload,
            headers={"X-API-Key": self.api_key}
        )

        return {
            "status": response.status_code,
            "data": response.json(),
            "meta": response.headers.get("X-Pag0-Meta")
        }

    async def recommend(
        self,
        category: str,
        optimize: str = "balanced",
        limit: int = 5
    ) -> list:
        """Get API recommendations"""
        url = f"{self.base_url}/api/curation/recommend"
        response = await self.client.get(
            url,
            params={"category": category, "optimize": optimize, "limit": limit},
            headers={"X-API-Key": self.api_key}
        )
        return response.json()

# Usage example
async def main():
    pag0 = Pag0Client(
        api_key=os.environ["PAG0_API_KEY"],
        policy={"daily_budget": "10000000"}
    )

    # Translate text
    result = await pag0.fetch(
        "https://api.deepl.com/v2/translate",
        method="POST",
        data={"text": "Hello", "target_lang": "KO"}
    )
    print(result["data"])
    print(f"Cost: {result['meta']['cost']}")
```

### 7.4 AI Agent Frameworks (LangChain, CrewAI)

**LangChain Integration**:

```typescript
import { createPag0Client } from '@pag0/sdk';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage } from 'langchain/schema';

// Custom LangChain adapter
class Pag0ChatOpenAI extends ChatOpenAI {
  constructor(config: any) {
    super(config);
    this.pag0 = createPag0Client({
      apiKey: process.env.PAG0_API_KEY!,
      policy: config.policy
    });
  }

  async _call(messages: any[]): Promise<string> {
    const response = await this.pag0.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages.map(m => ({ role: m._getType(), content: m.content }))
      })
    });

    const data = await response.json();
    console.log('Pag0 Cost:', response.meta.cost);

    return data.choices[0].message.content;
  }
}

// Usage
const model = new Pag0ChatOpenAI({
  modelName: 'gpt-4',
  openAIApiKey: process.env.OPENAI_API_KEY!,
  policy: { dailyBudget: '10000000' }
});

const result = await model.call([new HumanMessage('Explain AI')]);
```

**CrewAI Integration**:

```python
from crewai import Agent, Task, Crew
from pag0 import Pag0Client
import os

# Pag0-wrapped LLM
class Pag0LLM:
    def __init__(self, pag0_client, llm_endpoint):
        self.pag0 = pag0_client
        self.endpoint = llm_endpoint

    async def generate(self, prompt: str) -> str:
        response = await self.pag0.fetch(
            self.endpoint,
            method="POST",
            data={"prompt": prompt, "max_tokens": 500}
        )
        print(f"Cost: {response['meta']['cost']}")
        return response['data']['text']

# Setup
pag0 = Pag0Client(
    api_key=os.environ["PAG0_API_KEY"],
    policy={"daily_budget": "10000000"}
)

llm = Pag0LLM(pag0, "https://api.openai.com/v1/completions")

# Create agent with budget control
researcher = Agent(
    role='Researcher',
    goal='Research AI trends',
    llm=llm,
    verbose=True
)

task = Task(
    description='Summarize latest AI developments',
    agent=researcher
)

crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()
```

---

## 8. Error Handling

### 8.1 Error Codes and Meanings

```typescript
import {
  Pag0Error,
  PolicyViolationError,
  BudgetExceededError,
  ApprovalTimeoutError,
  CacheError,
  NetworkError
} from '@pag0/sdk';

try {
  const response = await pag0.fetch(url);
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.error('Budget exceeded:', error.details);
    // {
    //   dailySpent: '10000000',
    //   dailyLimit: '10000000',
    //   requestCost: '50000'
    // }
  } else if (error instanceof PolicyViolationError) {
    console.error('Policy violation:', error.reason);
    // "Endpoint not in allowlist"
  } else if (error instanceof ApprovalTimeoutError) {
    console.error('Approval timeout');
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.statusCode);
  }
}
```

### 8.1.1 Distinguishing Proxy Response Codes

When routing through Pag0 Proxy, x402 original errors and Pag0's own errors are mixed. Distinguish them with this table:

| HTTP Code | Source | Meaning | Response |
|-----------|------|------|------|
| **402** | x402 server | Payment Required | Sign with Agent wallet and retry (SDK handles automatically) |
| **403** | Pag0 Proxy | Policy Violation | `PolicyViolationError` — Check allowed endpoints/budget settings |
| **429** | Pag0 Proxy | Rate Limit Exceeded | Retry (refer to Retry-After header) or upgrade plan |
| **502/503** | Pag0 Proxy | Proxy Server Failure | Direct call or immediate failure based on `fallbackMode` setting |

```typescript
try {
  const response = await pag0.fetch(url);
} catch (error) {
  if (error instanceof PolicyViolationError) {
    // 403: Pag0 policy violation — Check endpoint/budget settings
    console.error('Policy blocked:', error.reason);
  } else if (error instanceof BudgetExceededError) {
    // 403: Budget exceeded — Check dailyBudget/monthlyBudget
    console.error('Budget limit reached:', error.details.remaining);
  } else if (error instanceof NetworkError && error.statusCode === 429) {
    // 429: Rate limit — Retry needed
    const retryAfter = error.headers?.get('Retry-After') || '60';
    console.warn(`Rate limited. Retry after ${retryAfter}s`);
  }
  // 402 is not usually caught as SDK automatically handles sign+retry
}
```

### 8.2 Retry Strategy

**Automatic Retry** (SDK built-in):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  retries: 3,                    // Retry count
  retryDelay: 1000,              // Initial delay (ms)
  retryBackoff: 'exponential'    // 'exponential' | 'linear'
});

// Automatically retries up to 3 times on failure (1s, 2s, 4s intervals)
const response = await pag0.fetch(url);
```

**Manual Retry**:

```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Pag0Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pag0.fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.min(1000 * Math.pow(2, i), 10000); // max 10s
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 8.3 Fallback Patterns

**Fallback 1: Direct x402 Call**

> **⚠️ Security Warning**: Using `fallbackMode: 'direct'` **bypasses all Pag0 protection features** on Proxy failure.
> Policy enforcement (budget limits, whitelisting), caching, and analytics collection are all disabled,
> and the Agent directly requests the x402 server. The `'fail'` mode is recommended for production environments.

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  fallbackMode: 'direct' // Direct call on Proxy failure
});

// ⚠️ Direct x402 call when Proxy is down — All policy/cache/analytics bypassed
const response = await pag0.fetch(url);
```

**Fallback 2: Use Alternative API**

```typescript
async function fetchWithFallback(primary: string, fallback: string) {
  try {
    return await pag0.fetch(primary);
  } catch (error) {
    console.warn('Primary API failed, using fallback');
    return await pag0.fetch(fallback);
  }
}

// Usage
const translation = await fetchWithFallback(
  'https://api.deepl.com/v2/translate',      // Primary
  'https://translation.googleapis.com/...'   // Fallback
);
```

**Fallback 3: Cache First (Stale-While-Revalidate)**

```typescript
async function fetchStaleWhileRevalidate(url: string) {
  // 1. Check cache (allow stale)
  const cached = await pag0.getCached(url);
  if (cached) {
    // 2. Refresh in background
    pag0.fetch(url).catch(console.error);
    // 3. Return cache immediately
    return cached;
  }

  // 4. Normal request if no cache
  return await pag0.fetch(url);
}
```

---

## 9. Practical Examples

### 9.1 Research Agent (Translation+Search+Analysis)

```typescript
import { createPag0Client } from '@pag0/sdk';

const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '50000000', // 50 USDC
    allowedEndpoints: [
      'https://api.deepl.com/*',
      'https://api.tavily.com/*',
      'https://api.openai.com/*'
    ]
  },
  cache: {
    enabled: true,
    ttlRules: [
      { pattern: '.*translate.*', ttl: 86400 },  // Translation: 24 hours
      { pattern: '.*search.*', ttl: 3600 },      // Search: 1 hour
      { pattern: '.*completions.*', ttl: 7200 }  // LLM: 2 hours
    ]
  }
});

async function researchTopic(topic: string, targetLang: string = 'en') {
  // 1. Search
  const searchResults = await pag0.fetch('https://api.tavily.com/search', {
    method: 'POST',
    body: JSON.stringify({ query: topic, max_results: 5 })
  });
  const articles = await searchResults.json();
  console.log('Search cost:', searchResults.meta.cost);

  // 2. Translate (if needed)
  if (targetLang !== 'en') {
    const translated = await Promise.all(
      articles.results.map(async (article: any) => {
        const translation = await pag0.fetch('https://api.deepl.com/v2/translate', {
          method: 'POST',
          body: JSON.stringify({
            text: article.content,
            target_lang: targetLang.toUpperCase()
          })
        });
        return { ...article, translated: await translation.json() };
      })
    );
    articles.results = translated;
  }

  // 3. LLM analysis
  const summary = await pag0.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a research analyst.' },
        { role: 'user', content: `Summarize these articles about ${topic}:\n\n${JSON.stringify(articles.results)}` }
      ]
    })
  });

  const analysis = await summary.json();

  // 4. Cost aggregation
  const totalCost = parseInt(searchResults.meta.cost) +
                    parseInt(summary.meta.cost);

  console.log(`Total research cost: $${(totalCost / 1e6).toFixed(3)}`);

  return {
    topic,
    articles: articles.results,
    summary: analysis.choices[0].message.content,
    cost: totalCost
  };
}

// Usage
const report = await researchTopic('Quantum Computing', 'ko');
console.log(report.summary);
```

### 9.2 Trading Bot (Price+Routing+Gas)

```typescript
import { createPag0Client } from '@pag0/sdk';

const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '100000000', // 100 USDC
    allowedEndpoints: [
      'https://api.coingecko.com/*',
      'https://api.1inch.io/*',
      'https://api.blocknative.com/*'
    ]
  },
  cache: {
    enabled: true,
    ttlRules: [
      { pattern: '.*price.*', ttl: 30 },    // Price: 30 seconds
      { pattern: '.*quote.*', ttl: 60 },    // Swap: 1 minute
      { pattern: '.*gas.*', ttl: 20 }       // Gas: 20 seconds
    ]
  }
});

async function executeTrade(fromToken: string, toToken: string, amount: string) {
  // 1. Check price
  const prices = await pag0.fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${fromToken},${toToken}&vs_currencies=usd`
  );
  const priceData = await prices.json();
  console.log('Current prices:', priceData);

  // 2. Compare routing (1inch vs Uniswap)
  const routers = await pag0.recommend({
    category: 'defi-routing',
    optimize: 'cost'
  });

  const quotes = await Promise.all(
    routers.slice(0, 3).map(async (router) => {
      const quote = await pag0.fetch(router.endpoint, {
        params: { fromToken, toToken, amount }
      });
      return { router: router.endpoint, quote: await quote.json() };
    })
  );

  // Select best router
  const bestQuote = quotes.sort((a, b) =>
    parseInt(b.quote.toAmount) - parseInt(a.quote.toAmount)
  )[0];

  // 3. Gas estimation
  const gas = await pag0.fetch('https://api.blocknative.com/gasprices/blockprices');
  const gasData = await gas.json();
  const estimatedGas = gasData.estimatedPrices[0].maxFeePerGas;

  console.log('Best route:', bestQuote.router);
  console.log('Output amount:', bestQuote.quote.toAmount);
  console.log('Estimated gas:', estimatedGas);

  // 4. Execute trade (example)
  // await executeOnChain(bestQuote.quote.tx);

  // 5. Cost report
  const totalCost = parseInt(prices.meta.cost) +
                    quotes.reduce((sum, q) => sum + parseInt(q.quote.meta?.cost || 0), 0) +
                    parseInt(gas.meta.cost);

  return {
    executed: true,
    route: bestQuote.router,
    outputAmount: bestQuote.quote.toAmount,
    apiCost: totalCost,
    gasCost: estimatedGas
  };
}

// Usage
const trade = await executeTrade('ethereum', 'usd-coin', '1000000000'); // 1 ETH
console.log('Trade result:', trade);
```

### 9.3 MCP Bridge (Paid MCP Server Management)

```typescript
import { createPag0Client } from '@pag0/sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Wrap paid MCP server with Pag0
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '10000000',
    anomalyDetection: {
      enabled: true,
      maxDeviationPercent: 300,
      alertWebhook: process.env.ALERT_WEBHOOK!
    }
  }
});

// Create MCP server
const server = new Server(
  { name: 'pag0-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool: Paid translation API (Pag0 managed)
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'translate') {
    const { text, targetLang } = request.params.arguments;

    // Select best translation API via Pag0
    const best = await pag0.recommend({
      category: 'translation',
      optimize: 'balanced'
    });

    const response = await pag0.fetch(best[0].endpoint, {
      method: 'POST',
      body: JSON.stringify({ text, target_lang: targetLang })
    });

    const result = await response.json();

    return {
      content: [{
        type: 'text',
        text: result.translations[0].text
      }],
      _meta: {
        cost: response.meta.cost,
        endpoint: best[0].endpoint
      }
    };
  }
});

// Run server
const transport = new StdioServerTransport();
await server.connect(transport);
console.log('Pag0 MCP Bridge running');
```

---

## 10. Additional Resources

### Documentation

- **API Reference**: <https://docs.pag0.io/api>
- **Guides**: <https://docs.pag0.io/guides>
- **Examples**: <https://github.com/pag0/examples>

### Support

- **Discord**: <https://discord.gg/pag0>
- **GitHub Issues**: <https://github.com/pag0/sdk/issues>
- **Email**: <support@pag0.io>

### SDK Packages

- **TypeScript/JavaScript**: `@pag0/sdk`
- **Python**: `pag0-python`
- **Go**: `github.com/pag0/pag0-go`
- **Rust**: `pag0-rs`

---

**Next Steps**: After completing SDK integration, refer to [13-GO-TO-MARKET.md](13-GO-TO-MARKET.md) to establish user acquisition strategy.
