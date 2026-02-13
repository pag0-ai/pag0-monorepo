# Pag0 Smart Proxy - API Specification

> **TL;DR**: The Pag0 API consists of 5 main areas: (1) Proxy - x402 request relay, (2) Policy - spending policy CRUD, (3) Analytics - usage/cost/cache statistics, (4) Curation - API recommendations/comparison/rankings, (5) Auth - user registration/login. All requests are authenticated with the `X-Pag0-API-Key` header, with Free tier at 60 req/min and Pro tier at 1,000 req/min.

## Related Documents

| Document | Relevance |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | Architecture and component details |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | Database schema |
| [12-SDK-GUIDE.md](12-SDK-GUIDE.md) | SDK usage guide |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Glossary |

## API Overview

**Base URL**: `https://api.pag0.dev` (production)
**Base URL**: `http://localhost:3000` (local development)

**Authentication**: API Key (Header: `X-Pag0-API-Key`)
**Content-Type**: `application/json`
**Rate Limit**: 1,000 requests/minute (freemium), Unlimited (Pro)

---

## Authentication

All API requests must include the `X-Pag0-API-Key` header.

```http
X-Pag0-API-Key: pag0_live_a1b2c3d4e5f6...
```

### API Key Format

- **Production**: `pag0_live_{32_char_random}`
- **Test**: `pag0_test_{32_char_random}`

---

## 1. Proxy Endpoints

### 1.1 POST /proxy

Proxies x402 requests with policy validation, caching, and analytics.

#### Request

**Headers**:

```http
POST /proxy HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
Content-Type: application/json
```

**Body**:

```typescript
interface ProxyRequest {
  targetUrl: string;           // x402 server URL (required)
  method: "GET" | "POST" | "PUT" | "DELETE";  // HTTP method (default: GET)
  headers?: Record<string, string>;  // Custom headers to forward
  body?: any;                  // Request body (for POST/PUT)
  cacheBypass?: boolean;       // Force fresh request (default: false)
  policyId?: string;           // Specific policy to apply (optional)
}
```

**Example**:

```json
{
  "targetUrl": "https://api.example.com/data/weather",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  },
  "cacheBypass": false
}
```

#### Response (Success - Cached)

**Status**: `200 OK`

```typescript
interface ProxyResponse {
  status: number;              // Original server status
  headers: Record<string, string>;
  body: any;                   // Original response body
  metadata: {
    cost: string;              // "0" for cached
    cached: boolean;           // true
    cacheAge: number;          // seconds since cached
    latency: number;           // milliseconds (cache retrieval)
    endpoint: string;          // normalized endpoint
    budgetRemaining: {
      daily: string;           // USDC (6 decimals)
      monthly: string;
    };
  };
}
```

**Example**:

```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "temperature": 72,
    "condition": "sunny"
  },
  "metadata": {
    "cost": "0",
    "cached": true,
    "cacheAge": 120,
    "latency": 8,
    "endpoint": "api.example.com",
    "budgetRemaining": {
      "daily": "9500000",
      "monthly": "95000000"
    }
  }
}
```

#### Response (402 Payment Required)

**Status**: `402 Payment Required`

When the proxy receives a 402 response from the x402 server, it relays the payment request to the Agent.

```typescript
interface PaymentRequiredResponse {
  status: 402;
  headers: Record<string, string>;
  body: {
    paymentRequest: {
      id: string;
      amount: string;          // USDC (6 decimals)
      recipient: string;       // Payment recipient address
      facilitatorUrl: string;
      expiresAt: number;       // Unix timestamp
    };
  };
  metadata: {
    cost: string;              // Expected cost
    cached: false;
    latency: number;
    endpoint: string;
    budgetRemaining: {
      daily: string;
      monthly: string;
    };
  };
}
```

**Example**:

```json
{
  "status": 402,
  "headers": {
    "x-payment-request": "..."
  },
  "body": {
    "paymentRequest": {
      "id": "pay_abc123",
      "amount": "500000",
      "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "facilitatorUrl": "https://facilitator.x402.org",
      "expiresAt": 1707580800
    }
  },
  "metadata": {
    "cost": "500000",
    "cached": false,
    "latency": 150,
    "endpoint": "api.example.com",
    "budgetRemaining": {
      "daily": "9500000",
      "monthly": "99500000"
    }
  }
}
```

**Agent Action**: The Agent signs the payment and retries the request with the `signedPayment` field.

#### Request (With Signed Payment)

```json
{
  "targetUrl": "https://api.example.com/data/weather",
  "method": "GET",
  "signedPayment": {
    "id": "pay_abc123",
    "amount": "500000",
    "signature": "0x1234...",
    "timestamp": 1707580700
  }
}
```

#### Response (Error - Policy Violation)

**Status**: `403 Forbidden`

```typescript
interface PolicyViolationError {
  error: {
    code: "POLICY_VIOLATION";
    reason: "ENDPOINT_BLOCKED" | "PER_REQUEST_LIMIT_EXCEEDED" | "DAILY_BUDGET_EXCEEDED" | "MONTHLY_BUDGET_EXCEEDED" | "APPROVAL_REQUIRED";
    message: string;
    details?: any;
  };
}
```

**Example**:

```json
{
  "error": {
    "code": "POLICY_VIOLATION",
    "reason": "DAILY_BUDGET_EXCEEDED",
    "message": "Daily budget limit reached",
    "details": {
      "dailyBudget": "10000000",
      "dailySpent": "10000000",
      "requestCost": "500000"
    }
  }
}
```

#### Error Codes

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `INVALID_REQUEST` | Missing or invalid parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `POLICY_VIOLATION` | Policy check failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 502 | `UPSTREAM_ERROR` | x402 server error |
| 504 | `UPSTREAM_TIMEOUT` | x402 server timeout |

---

## 2. Policy Management

### 2.1 GET /api/policies

Retrieves all policies for a project.

#### Request

```http
GET /api/policies HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `projectId` (optional): Specific project ID

#### Response

**Status**: `200 OK`

```typescript
interface PoliciesResponse {
  policies: SpendPolicy[];
  total: number;
}

interface SpendPolicy {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  maxPerRequest: string;
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints: string[];
  blockedEndpoints?: string[];
  requireApproval?: {
    threshold: string;
    webhookUrl: string;
    timeoutSeconds: number;
  };
  anomalyDetection?: {
    enabled: boolean;
    maxDeviationPercent: number;
    alertWebhook: string;
  };
  createdAt: string;          // ISO 8601
  updatedAt: string;
}
```

**Example**:

```json
{
  "policies": [
    {
      "id": "pol_abc123",
      "projectId": "proj_xyz789",
      "name": "Production Policy",
      "isActive": true,
      "maxPerRequest": "1000000",
      "dailyBudget": "10000000",
      "monthlyBudget": "100000000",
      "allowedEndpoints": ["api.example.com", "*.openai.com"],
      "blockedEndpoints": [],
      "createdAt": "2026-02-10T00:00:00Z",
      "updatedAt": "2026-02-10T00:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 2.2 POST /api/policies

Creates a new policy.

#### Request

```http
POST /api/policies HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
Content-Type: application/json
```

**Body**:

```typescript
interface CreatePolicyRequest {
  projectId: string;
  name: string;
  maxPerRequest: string;      // USDC (6 decimals)
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints?: string[];  // default: [] (allow all)
  blockedEndpoints?: string[];
  requireApproval?: {
    threshold: string;
    webhookUrl: string;
    timeoutSeconds: number;
  };
  anomalyDetection?: {
    enabled: boolean;
    maxDeviationPercent: number;
    alertWebhook: string;
  };
}
```

**Example**:

```json
{
  "projectId": "proj_xyz789",
  "name": "Development Policy",
  "maxPerRequest": "500000",
  "dailyBudget": "5000000",
  "monthlyBudget": "50000000",
  "allowedEndpoints": ["*.test.com"],
  "blockedEndpoints": ["production.api.com"]
}
```

#### Response

**Status**: `201 Created`

```typescript
interface CreatePolicyResponse {
  policy: SpendPolicy;
}
```

---

### 2.3 GET /api/policies/:id

Retrieves details of a specific policy.

#### Request

```http
GET /api/policies/pol_abc123 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `200 OK`

```typescript
interface PolicyResponse {
  policy: SpendPolicy;
}
```

---

### 2.4 PUT /api/policies/:id

Updates a policy.

#### Request

```http
PUT /api/policies/pol_abc123 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
Content-Type: application/json
```

**Body**: Same as `CreatePolicyRequest` (supports partial updates)

```json
{
  "dailyBudget": "20000000",
  "isActive": false
}
```

#### Response

**Status**: `200 OK`

```typescript
interface UpdatePolicyResponse {
  policy: SpendPolicy;
}
```

---

### 2.5 DELETE /api/policies/:id

Deletes a policy (soft delete).

#### Request

```http
DELETE /api/policies/pol_abc123 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `204 No Content`

---

## 3. Analytics

### 3.1 GET /api/analytics/summary

Retrieves overall summary statistics for a project.

#### Request

```http
GET /api/analytics/summary?period=7d HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `period`: `1h`, `24h`, `7d`, `30d` (default: `7d`)
- `projectId` (optional): Specific project

#### Response

**Status**: `200 OK`

```typescript
interface AnalyticsSummary {
  period: string;
  totalRequests: number;
  cacheHitRate: number;        // 0.0 - 1.0
  avgLatency: number;          // milliseconds
  successRate: number;         // 0.0 - 1.0
  totalCost: string;           // USDC spent
  cacheSavings: string;        // USDC saved
  topEndpoints: Array<{
    endpoint: string;
    requestCount: number;
    cost: string;
  }>;
  budgetUsage: {
    daily: {
      limit: string;
      spent: string;
      remaining: string;
      percentage: number;
    };
    monthly: {
      limit: string;
      spent: string;
      remaining: string;
      percentage: number;
    };
  };
}
```

**Example**:

```json
{
  "period": "7d",
  "totalRequests": 15420,
  "cacheHitRate": 0.43,
  "avgLatency": 185,
  "successRate": 0.98,
  "totalCost": "7850000",
  "cacheSavings": "3200000",
  "topEndpoints": [
    {
      "endpoint": "api.openai.com",
      "requestCount": 8500,
      "cost": "4250000"
    },
    {
      "endpoint": "api.anthropic.com",
      "requestCount": 4200,
      "cost": "2100000"
    }
  ],
  "budgetUsage": {
    "daily": {
      "limit": "10000000",
      "spent": "1200000",
      "remaining": "8800000",
      "percentage": 12
    },
    "monthly": {
      "limit": "100000000",
      "spent": "7850000",
      "remaining": "92150000",
      "percentage": 7.85
    }
  }
}
```

---

### 3.2 GET /api/analytics/endpoints

Retrieves detailed metrics by endpoint.

#### Request

```http
GET /api/analytics/endpoints?period=7d&limit=20 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `period`: `1h`, `24h`, `7d`, `30d`
- `limit`: Number of endpoints to return (default: 20)
- `orderBy`: `requestCount`, `cost`, `latency`, `errorRate` (default: `requestCount`)

#### Response

**Status**: `200 OK`

```typescript
interface EndpointAnalytics {
  endpoints: EndpointMetrics[];
  total: number;
}

interface EndpointMetrics {
  endpoint: string;
  requestCount: number;
  cacheHitCount: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  errorCount: number;
  totalSpent: string;
  cacheSavings: string;
}
```

**Example**:

```json
{
  "endpoints": [
    {
      "endpoint": "api.openai.com",
      "requestCount": 8500,
      "cacheHitCount": 3800,
      "cacheHitRate": 0.447,
      "avgLatencyMs": 220,
      "p50LatencyMs": 180,
      "p95LatencyMs": 450,
      "p99LatencyMs": 780,
      "successRate": 0.99,
      "errorCount": 85,
      "totalSpent": "4250000",
      "cacheSavings": "1900000"
    }
  ],
  "total": 1
}
```

---

### 3.3 GET /api/analytics/costs

Retrieves cost time series data.

#### Request

```http
GET /api/analytics/costs?period=30d&granularity=daily HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `period`: `7d`, `30d`, `90d`
- `granularity`: `hourly`, `daily`, `monthly`

#### Response

**Status**: `200 OK`

```typescript
interface CostAnalytics {
  timeseries: Array<{
    timestamp: string;         // ISO 8601
    spent: string;             // USDC
    saved: string;             // USDC (cache savings)
    requestCount: number;
  }>;
  total: {
    spent: string;
    saved: string;
    requests: number;
  };
}
```

**Example**:

```json
{
  "timeseries": [
    {
      "timestamp": "2026-02-03T00:00:00Z",
      "spent": "1200000",
      "saved": "480000",
      "requestCount": 2400
    },
    {
      "timestamp": "2026-02-04T00:00:00Z",
      "spent": "1150000",
      "saved": "520000",
      "requestCount": 2350
    }
  ],
  "total": {
    "spent": "7850000",
    "saved": "3200000",
    "requests": 15420
  }
}
```

---

### 3.4 GET /api/analytics/cache

Retrieves cache performance analysis.

#### Request

```http
GET /api/analytics/cache?period=7d HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `200 OK`

```typescript
interface CacheAnalytics {
  hitRate: number;             // 0.0 - 1.0
  hitCount: number;
  missCount: number;
  bypassCount: number;
  totalSavings: string;        // USDC
  avgCacheAge: number;         // seconds
  topCachedEndpoints: Array<{
    endpoint: string;
    hitRate: number;
    savings: string;
  }>;
}
```

**Example**:

```json
{
  "hitRate": 0.43,
  "hitCount": 6630,
  "missCount": 8790,
  "bypassCount": 0,
  "totalSavings": "3200000",
  "avgCacheAge": 180,
  "topCachedEndpoints": [
    {
      "endpoint": "api.weather.com",
      "hitRate": 0.85,
      "savings": "850000"
    }
  ]
}
```

---

## 4. Curation (API Recommendations/Comparison)

### 4.1 GET /api/curation/recommend

Retrieves recommended APIs by category.

#### Request

```http
GET /api/curation/recommend?category=AI&limit=5 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `category`: `AI`, `Data`, `Blockchain`, `IoT`, `Finance` (required)
- `limit`: Number of recommendations (default: 5, max: 20)
- `weights`: Weight adjustment (optional) - `cost:0.5,latency:0.3,reliability:0.2`

#### Response

**Status**: `200 OK`

```typescript
interface RecommendationResponse {
  category: string;
  recommendations: EndpointScore[];
}

interface EndpointScore {
  endpoint: string;
  category: string;
  overallScore: number;        // 0-100
  costScore: number;           // 0-100
  latencyScore: number;        // 0-100
  reliabilityScore: number;    // 0-100
  weights: {
    cost: number;
    latency: number;
    reliability: number;
  };
  evidence: {
    sampleSize: number;
    period: string;
    avgCostPerRequest: string;
    avgLatencyMs: number;
    successRate: number;
  };
}
```

**Example**:

```json
{
  "category": "AI",
  "recommendations": [
    {
      "endpoint": "api.anthropic.com",
      "category": "AI",
      "overallScore": 92,
      "costScore": 88,
      "latencyScore": 95,
      "reliabilityScore": 99,
      "weights": {
        "cost": 0.4,
        "latency": 0.3,
        "reliability": 0.3
      },
      "evidence": {
        "sampleSize": 4200,
        "period": "30d",
        "avgCostPerRequest": "500000",
        "avgLatencyMs": 180,
        "successRate": 0.99
      }
    }
  ]
}
```

---

### 4.2 GET /api/curation/compare

Compares multiple APIs.

#### Request

```http
GET /api/curation/compare?endpoints=api.openai.com,api.anthropic.com HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `endpoints`: Comma-separated list of endpoints (2-5)

#### Response

**Status**: `200 OK`

```typescript
interface ComparisonResponse {
  endpoints: EndpointScore[];
  winner: {
    overall: string;           // endpoint URL
    cost: string;
    latency: string;
    reliability: string;
  };
  differences: {
    costRange: { min: string; max: string; };
    latencyRange: { min: number; max: number; };
    reliabilityRange: { min: number; max: number; };
  };
}
```

**Example**:

```json
{
  "endpoints": [
    {
      "endpoint": "api.openai.com",
      "category": "AI",
      "overallScore": 85,
      "costScore": 75,
      "latencyScore": 88,
      "reliabilityScore": 98,
      "weights": { "cost": 0.4, "latency": 0.3, "reliability": 0.3 },
      "evidence": {
        "sampleSize": 8500,
        "period": "30d",
        "avgCostPerRequest": "600000",
        "avgLatencyMs": 220,
        "successRate": 0.98
      }
    },
    {
      "endpoint": "api.anthropic.com",
      "category": "AI",
      "overallScore": 92,
      "costScore": 88,
      "latencyScore": 95,
      "reliabilityScore": 99,
      "weights": { "cost": 0.4, "latency": 0.3, "reliability": 0.3 },
      "evidence": {
        "sampleSize": 4200,
        "period": "30d",
        "avgCostPerRequest": "500000",
        "avgLatencyMs": 180,
        "successRate": 0.99
      }
    }
  ],
  "winner": {
    "overall": "api.anthropic.com",
    "cost": "api.anthropic.com",
    "latency": "api.anthropic.com",
    "reliability": "api.anthropic.com"
  },
  "differences": {
    "costRange": { "min": "500000", "max": "600000" },
    "latencyRange": { "min": 180, "max": 220 },
    "reliabilityRange": { "min": 0.98, "max": 0.99 }
  }
}
```

---

### 4.3 GET /api/curation/rankings

Retrieves overall rankings by category.

#### Request

```http
GET /api/curation/rankings?category=AI&limit=20 HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

**Query Parameters**:

- `category`: Category (optional, all if not specified)
- `limit`: Number to return (default: 20)
- `orderBy`: `overall`, `cost`, `latency`, `reliability` (default: `overall`)

#### Response

**Status**: `200 OK`

```typescript
interface RankingsResponse {
  category?: string;
  rankings: Array<EndpointScore & { rank: number }>;
  total: number;
}
```

---

### 4.4 GET /api/curation/categories

Retrieves available category list.

#### Request

```http
GET /api/curation/categories HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `200 OK`

```typescript
interface CategoriesResponse {
  categories: Array<{
    name: string;
    endpointCount: number;
    avgScore: number;
  }>;
}
```

**Example**:

```json
{
  "categories": [
    { "name": "AI", "endpointCount": 45, "avgScore": 82 },
    { "name": "Data", "endpointCount": 120, "avgScore": 78 },
    { "name": "Blockchain", "endpointCount": 35, "avgScore": 85 }
  ]
}
```

---

### 4.5 GET /api/curation/score/:endpoint

Retrieves score for a specific endpoint.

#### Request

```http
GET /api/curation/score/api.openai.com HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `200 OK`

```typescript
interface ScoreResponse {
  score: EndpointScore;
  history?: Array<{
    timestamp: string;
    overallScore: number;
  }>;
}
```

---

## 5. Authentication

### 5.1 POST /api/auth/register

Registers a new user and issues an API Key.

#### Request

```http
POST /api/auth/register HTTP/1.1
Host: api.pag0.dev
Content-Type: application/json
```

**Body**:

```typescript
interface RegisterRequest {
  email: string;
  password: string;         // min 8 chars
  projectName?: string;     // default: "Default Project"
}
```

**Example**:

```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "projectName": "My AI Agent"
}
```

#### Response

**Status**: `201 Created`

```typescript
interface RegisterResponse {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  project: {
    id: string;
    name: string;
  };
  apiKey: string;            // pag0_live_xxx (show once)
}
```

**Example**:

```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "createdAt": "2026-02-10T00:00:00Z"
  },
  "project": {
    "id": "proj_xyz789",
    "name": "My AI Agent"
  },
  "apiKey": "pag0_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Important**: API Key is **shown only once**. Store it securely.

---

### 5.2 POST /api/auth/login

Logs in and issues a session token (for Dashboard).

#### Request

```http
POST /api/auth/login HTTP/1.1
Host: api.pag0.dev
Content-Type: application/json
```

**Body**:

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

#### Response

**Status**: `200 OK`

```typescript
interface LoginResponse {
  token: string;             // JWT token (7 days)
  user: {
    id: string;
    email: string;
  };
}
```

---

### 5.3 GET /api/auth/me

Retrieves current user information.

#### Request

```http
GET /api/auth/me HTTP/1.1
Host: api.pag0.dev
X-Pag0-API-Key: pag0_live_xxx
```

#### Response

**Status**: `200 OK`

```typescript
interface UserResponse {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  projects: Array<{
    id: string;
    name: string;
    apiKeyPreview: string;   // "pag0_live_a1b2...o5p6"
  }>;
  subscription: {
    tier: "free" | "pro";
    limits: {
      requestsPerDay: number;
      projectsMax: number;
    };
  };
}
```

**Example**:

```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "createdAt": "2026-02-10T00:00:00Z"
  },
  "projects": [
    {
      "id": "proj_xyz789",
      "name": "My AI Agent",
      "apiKeyPreview": "pag0_live_a1b2...o5p6"
    }
  ],
  "subscription": {
    "tier": "free",
    "limits": {
      "requestsPerDay": 1000,
      "projectsMax": 3
    }
  }
}
```

---

## Error Response Format

All errors follow this format:

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Authentication failed (missing/invalid API Key) |
| 403 | `POLICY_VIOLATION` | Policy violation |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Internal server error |
| 502 | `UPSTREAM_ERROR` | x402 server error |
| 504 | `UPSTREAM_TIMEOUT` | x402 server timeout |

---

## Rate Limiting

### Limits

| Tier | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Free | 60 | 1,000 |
| Pro | 1,000 | Unlimited |

### Rate Limit Headers

Included in all responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1707580800
```

### On Rate Limit Exceeded

**Status**: `429 Too Many Requests`

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "details": {
      "limit": 60,
      "resetAt": "2026-02-10T12:30:00Z"
    }
  }
}
```

---

## Webhooks (Pro Tier Only)

### Approval Workflow Webhook

When `requireApproval` is configured in a policy, a webhook is called for requests exceeding the threshold.

#### Webhook Payload

```typescript
interface ApprovalWebhook {
  type: "approval_request";
  requestId: string;
  projectId: string;
  endpoint: string;
  method: string;
  estimatedCost: string;
  policy: {
    id: string;
    name: string;
    threshold: string;
  };
  expiresAt: string;         // ISO 8601
}
```

#### Expected Response

**Status**: `200 OK`

```typescript
interface ApprovalResponse {
  approved: boolean;
  reason?: string;
}
```

**Example**:

```json
{
  "approved": true
}
```

### Anomaly Detection Webhook

Alerts when abnormal spending patterns are detected.

#### Webhook Payload

```typescript
interface AnomalyWebhook {
  type: "anomaly_detected";
  projectId: string;
  endpoint: string;
  anomaly: {
    expectedCost: string;
    actualCost: string;
    deviationPercent: number;
  };
  timestamp: string;
}
```

---

## SDK Usage Example (TypeScript)

```typescript
import { Pag0Client } from '@pag0/sdk';

const pag0 = new Pag0Client({
  apiKey: 'pag0_live_xxx',
  baseUrl: 'https://api.pag0.dev'
});

// Proxy request
const response = await pag0.proxy({
  targetUrl: 'https://api.example.com/data',
  method: 'GET'
});

console.log(response.body);
console.log(`Cost: ${response.metadata.cost}`);
console.log(`Cached: ${response.metadata.cached}`);

// Get analytics
const analytics = await pag0.analytics.summary({ period: '7d' });
console.log(`Total requests: ${analytics.totalRequests}`);
console.log(`Cache savings: ${analytics.cacheSavings} USDC`);

// Get recommendations
const recommendations = await pag0.curation.recommend({
  category: 'AI',
  limit: 5
});

console.log('Top AI APIs:');
recommendations.forEach((api, i) => {
  console.log(`${i + 1}. ${api.endpoint} (score: ${api.overallScore})`);
});
```

---

**Version**: 1.0
**Last Updated**: 2026-02-10
