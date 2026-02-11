# Pag0 SDK 사용 가이드

> **TL;DR**: `@pag0/sdk`는 x402 프록시 레이어로, `createPag0Client()` 한 번 호출로 예산 제한/API 큐레이션/캐시를 자동화합니다. 기존 fetch를 `pag0.fetch()`로 바꾸면 40% 비용 절감과 정책 제어가 즉시 적용됩니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처 및 프록시 데이터 플로우 |
| [04-API-SPEC.md](04-API-SPEC.md) | API 엔드포인트 상세 스펙 |
| [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) | SDK 활용 유스케이스 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 핵심 용어 및 약어 정리 |

---

## 1. 빠른 시작 (5분)

### 1.1 패키지 설치

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

### 1.2 API Key 발급

**방법 1: Dashboard** (권장)

```
1. https://dashboard.pag0.io 접속
2. 프로젝트 생성 (예: "my-research-agent")
3. Settings > API Keys > Generate New Key
4. 키 복사 (한 번만 표시됨): pag0_prod_a1b2c3...
```

**방법 2: CLI**

```bash
# CLI 설치
npm install -g @pag0/cli

# 로그인
pag0 login

# 프로젝트 생성 및 키 발급
pag0 projects create my-research-agent
pag0 keys create --project my-research-agent

# 출력:
# ✅ API Key created: pag0_prod_a1b2c3d4e5f6...
# ⚠️  Save this key securely. It won't be shown again.
```

### 1.3 기본 설정 + 첫 요청

```typescript
import { createPag0Client } from '@pag0/sdk';

// 1. 클라이언트 초기화
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!, // pag0_prod_xxx...
  policy: {
    maxPerRequest: '1000000',  // 1 USDC (6 decimals)
    dailyBudget: '10000000'    // 10 USDC
  },
  cache: {
    enabled: true,
    defaultTTL: 300  // 5분
  }
});

// 2. 첫 번째 프록시 요청
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

// 3. 응답 확인
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

### 1.4 응답 구조 설명

```typescript
interface Pag0Response extends Response {
  // 표준 Response 속성 (status, headers, body 등)
  status: number;
  ok: boolean;
  headers: Headers;
  json(): Promise<any>;
  text(): Promise<string>;

  // Pag0 확장 속성
  meta: {
    cached: boolean;           // 캐시 히트 여부
    cost: string;              // 이번 요청 비용 (USDC, 6 decimals)
    cacheSavings: string;      // 캐시로 절감한 금액
    endpoint: string;          // 원본 엔드포인트 URL
    timestamp: string;         // ISO 8601 타임스탬프
    policyApplied: boolean;    // 정책 적용 여부
    budgetRemaining?: string;  // 남은 일일 예산 (optional)
  };
}
```

**예시 출력**:

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

### 1.5 x402 연동 아키텍처

Pag0 SDK는 x402 프로토콜의 결제 플로우 위에서 동작하는 **프록시 레이어**입니다. 기존 `@x402/fetch`를 대체하는 것이 아니라, Pag0 Proxy 서버를 경유하여 정책/캐시/분석 기능을 추가합니다.

**결제 플로우 (CDP Wallet 통합):**

```
AI Agent           pag0-mcp              Pag0 Proxy       x402 Server     Facilitator
(Claude 등)     [CDP Wallet]
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
    │                │                       │  → IPFS + 온체인]│               │
    │                │                       │                │                │
    │                │◀── Response + Meta ──│                │                │
    │◀── Result ────│                       │                │                │
```

**핵심 원칙:**

| 원칙 | 설명 |
|------|------|
| **CDP Wallet이 서명** | 결제 서명은 pag0-mcp 내의 Coinbase CDP Server Wallet이 수행. Proxy는 릴레이만 |
| **AI Agent에 키 노출 없음** | 지갑 키는 Coinbase 인프라에서 관리, pag0-mcp는 API Key만 보유 |
| **정책은 서버에서 적용** | SDK의 `policy` 설정은 Pag0 Proxy 서버에서 적용됨 (클라이언트 우회 불가) |
| **캐시 히트 시 결제 없음** | 동일 요청이 캐시에 있으면 x402 서버 호출 자체를 생략 |
| **x402 스펙 100% 준수** | 기존 x402 보안 모델이 그대로 유지됨 |
| **ERC-8004 온체인 감사** | 결제 완료 후 ReputationRegistry에 proofOfPayment 자동 기록 (IPFS + 온체인) |

### 1.6 pag0-mcp: Agent용 MCP 인터페이스

pag0-mcp는 AI Agent(Claude, GPT 등)가 Pag0의 모든 기능을 MCP tool로 사용할 수 있게 하는 **MCP 서버**입니다. CDP Wallet이 내장되어 있어, Agent는 지갑 관리 없이 tool 호출만으로 x402 결제를 완료할 수 있습니다.

**제공 MCP Tools:**

```typescript
// pag0-mcp가 노출하는 MCP Tools
const tools = {
  // x402 요청 (402→CDP Wallet 서명→재요청 자동 포함)
  pag0_fetch: {
    description: 'x402 API 호출 (결제 자동 처리)',
    params: { url: string, method?: string, body?: object },
    // 내부: Pag0 Proxy 경유 → 402 수신 → CDP Wallet 서명 → 결과 반환
  },

  // API 추천
  pag0_recommend: {
    description: '카테고리별 최적 x402 API 추천',
    params: { category: string, optimize?: 'cost' | 'speed' | 'reliability' },
  },

  // 지출 확인
  pag0_get_spent: {
    description: '기간별 지출 및 잔여 예산 확인',
    params: { period?: 'today' | 'week' | 'month' },
  },

  // 지갑 잔고
  pag0_wallet_balance: {
    description: 'CDP Wallet USDC/ETH 잔고 확인',
    params: {},
  },

  // 테스트넷 펀딩 (개발용)
  pag0_wallet_fund: {
    description: 'Base Sepolia 테스트넷 USDC 충전',
    params: { amount?: string },
  },

  // API 비교
  pag0_compare: {
    description: '여러 x402 API 엔드포인트 성능/비용 비교',
    params: { endpoints: string[] },
  },

  // ERC-8004 온체인 감사 조회
  pag0_audit_trail: {
    description: 'ERC-8004 온체인 감사 기록 조회 (결제 증명, 서비스 품질)',
    params: { endpoint?: string, period?: 'today' | 'week' | 'month' },
    // 내부: The Graph 서브그래프에서 FeedbackEvent 조회
  },

  // ERC-8004 서비스 평판 조회
  pag0_reputation: {
    description: 'x402 서버의 ERC-8004 ReputationRegistry 평판 점수 조회',
    params: { endpoint: string },
    // 내부: ReputationRegistry에서 giveFeedback 집계 데이터 반환
  },
};
```

**Agent 사용 예시 (Claude):**

```
User: "이 논문을 한국어로 번역해줘"

Claude:
  1. pag0_recommend({ category: "translation", optimize: "balanced" })
     → DeepL API (score: 95, cost: $0.015)

  2. pag0_fetch({ url: "https://api.deepl.com/v2/translate", method: "POST", body: {...} })
     → pag0-mcp 내부:
       a. Pag0 Proxy에 요청 → 402 수신 (0.015 USDC)
       b. Policy 검증 통과 (일일 예산 내)
       c. CDP Server Wallet이 결제 서명
       d. Facilitator 검증 → 200 응답
     → "안녕하세요, 세계!" (번역 결과)

  3. pag0_get_spent({ period: "today" })
     → { total: "0.015 USDC", remaining: "9.985 USDC" }

  4. pag0_audit_trail({ period: "today" })
     → [{ endpoint: "api.deepl.com", txHash: "0xabc...", qualityScore: 85,
          feedbackURI: "ipfs://Qm...", timestamp: "..." }]

  5. pag0_reputation({ endpoint: "https://api.deepl.com/v2/translate" })
     → { avgScore: 92, totalFeedbacks: 1250, tag: "x402-payment" }
```

---

## 2. 초기화 옵션

### 2.1 전체 설정 옵션

```typescript
import { createPag0Client, Pag0ClientConfig } from '@pag0/sdk';

const config: Pag0ClientConfig = {
  // ============================================
  // 필수 옵션
  // ============================================
  apiKey: string;                    // Pag0 API Key (pag0_xxx...)

  // ============================================
  // Policy 설정
  // ============================================
  policy?: {
    maxPerRequest?: string;          // 요청당 최대 비용 (USDC, 6 decimals)
    dailyBudget?: string;            // 일일 예산 한도
    monthlyBudget?: string;          // 월간 예산 한도
    allowedEndpoints?: string[];     // 허용할 엔드포인트 (화이트리스트)
    blockedEndpoints?: string[];     // 차단할 엔드포인트 (블랙리스트)
    requireApproval?: {              // 승인 워크플로우
      threshold: string;             // 승인 필요 금액
      webhookUrl: string;            // 승인 요청 webhook
      timeoutSeconds: number;        // 승인 대기 시간
    };
    anomalyDetection?: {             // 이상 탐지
      enabled: boolean;
      maxDeviationPercent: number;   // 평균 대비 최대 허용 편차 (%)
      alertWebhook: string;          // 알림 webhook
    };
  };

  // ============================================
  // Cache 설정
  // ============================================
  cache?: {
    enabled: boolean;                // 캐시 활성화 여부
    defaultTTL?: number;             // 기본 TTL (초)
    maxCacheSize?: number;           // 최대 캐시 크기 (bytes)
    ttlRules?: Array<{               // 엔드포인트별 TTL 규칙
      pattern: string;               // URL 패턴 (regex)
      ttl: number;                   // TTL (초)
    }>;
    excludePatterns?: string[];      // 캐시 제외 패턴
  };

  // ============================================
  // 네트워크 설정
  // ============================================
  network?: 'base' | 'base-sepolia'; // 기본값: 'base'
  facilitatorUrl?: string;           // Custom facilitator URL

  // ============================================
  // SDK 동작 설정
  // ============================================
  baseURL?: string;                  // Pag0 Proxy URL (기본: https://api.pag0.io)
  timeout?: number;                  // 요청 타임아웃 (ms, 기본: 30000)
  retries?: number;                  // 재시도 횟수 (기본: 3)
  fallbackMode?: 'direct' | 'fail';  // Proxy 실패 시 동작
                                     // 'direct': 직접 x402 호출
                                     // 'fail': 즉시 실패
  onCostUpdate?: (cost: string) => void;  // 비용 업데이트 콜백
  onPolicyViolation?: (error: PolicyError) => void;  // 정책 위반 콜백
};

const pag0 = createPag0Client(config);
```

### 2.2 Policy 설정 방법

**예시 1: 기본 예산 제한**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    maxPerRequest: '500000',   // 요청당 최대 0.5 USDC
    dailyBudget: '5000000',    // 하루 5 USDC
    monthlyBudget: '100000000' // 한 달 100 USDC
  }
});
```

**예시 2: 엔드포인트 화이트리스트**

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

// ✅ 허용됨
await pag0.fetch('https://api.openai.com/v1/completions');

// ❌ 차단됨 (PolicyViolationError)
await pag0.fetch('https://unknown-api.com/endpoint');
```

**예시 3: 승인 워크플로우** (고액 결제)

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    maxPerRequest: '10000000', // 일반 요청: 최대 10 USDC
    requireApproval: {
      threshold: '5000000',    // 5 USDC 이상은 승인 필요
      webhookUrl: 'https://myapp.com/approve-payment',
      timeoutSeconds: 300      // 5분 대기
    }
  }
});

// 5 USDC 이상 요청 시:
// 1. Webhook으로 승인 요청 전송
// 2. 5분 동안 승인 대기
// 3. 승인되면 계속 진행, 거부/타임아웃 시 에러
```

**예시 4: 이상 탐지**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    dailyBudget: '10000000',
    anomalyDetection: {
      enabled: true,
      maxDeviationPercent: 200, // 평균 대비 200% 초과 시 알림
      alertWebhook: 'https://myapp.com/alert'
    }
  }
});

// 평소 요청당 0.1 USDC → 갑자기 0.3 USDC (300% 증가)
// → Webhook 알림 발송 (자동 차단은 안 함)
```

### 2.3 Cache 설정 방법

**예시 1: 전역 캐시 활성화**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 600,        // 10분
    maxCacheSize: 10485760  // 10 MB
  }
});
```

**예시 2: 엔드포인트별 TTL 규칙**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    ttlRules: [
      {
        pattern: 'https://api.coingecko.com/.*',
        ttl: 60  // 가격 데이터는 1분만 캐시
      },
      {
        pattern: 'https://api.openai.com/.*',
        ttl: 3600  // LLM 응답은 1시간 캐시
      },
      {
        pattern: 'https://translate.googleapis.com/.*',
        ttl: 86400  // 번역은 24시간 캐시
      }
    ]
  }
});
```

**예시 3: 캐시 제외 패턴**

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    excludePatterns: [
      'https://api.example.com/realtime/*',  // 실시간 데이터
      '.*timestamp.*',                        // timestamp 포함된 URL
      '.*nonce.*'                             // nonce 포함된 URL
    ]
  }
});
```

### 2.4 네트워크 설정

**Testnet 사용** (Base Sepolia):

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
  network: 'base', // 기본값
  facilitatorUrl: 'https://facilitator.cdp.coinbase.com' // 기본값
});
```

---

## 3. 핵심 API

### 3.1 pag0.fetch() - 프록시를 통한 요청

**기본 사용법**:

```typescript
const response = await pag0.fetch(url: string, options?: RequestInit);
```

**예시 1: GET 요청**

```typescript
const response = await pag0.fetch('https://api.example.com/data');
const data = await response.json();

console.log('Cost:', response.meta.cost);
console.log('Cached:', response.meta.cached);
```

**예시 2: POST 요청**

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

**예시 3: 캐시 바이패스**

```typescript
// 특정 요청만 캐시 건너뛰기
const response = await pag0.fetch('https://api.example.com/latest', {
  headers: {
    'X-Pag0-Cache-Bypass': 'true'
  }
});
```

### 3.2 pag0.recommend() - API 추천

**기본 사용법**:

```typescript
const recommendations = await pag0.recommend({
  category: string;              // API 카테고리
  optimize?: 'cost' | 'speed' | 'reliability' | 'balanced'; // 최적화 기준
  limit?: number;                // 결과 개수 (기본: 5)
});
```

**예시 1: 번역 API 추천 (비용 최적화)**

```typescript
const best = await pag0.recommend({
  category: 'translation',
  optimize: 'cost'
});

console.log('Best translation API:', best[0]);
// {
//   endpoint: 'https://api.deepl.com/v2/translate',
//   avgCost: '15000',        // 0.015 USDC per request
//   avgSpeed: 1200,          // 1.2초
//   reliabilityScore: 0.98,  // 98% uptime
//   score: 0.95,             // 종합 점수
//   usageCount: 1250         // 실사용 데이터 (Pag0 사용자들)
// }

// 추천된 API 사용
const translation = await pag0.fetch(best[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({ text: 'Hello', target_lang: 'KO' })
});
```

**예시 2: 라우팅 API 추천 (속도 최적화)**

```typescript
const fastest = await pag0.recommend({
  category: 'defi-routing',
  optimize: 'speed',
  limit: 3
});

// 가장 빠른 API 선택
const routing = await pag0.fetch(fastest[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    amount: '1000000'
  })
});
```

**예시 3: 균형 잡힌 추천**

```typescript
const balanced = await pag0.recommend({
  category: 'llm',
  optimize: 'balanced' // 비용, 속도, 신뢰성 균형
});

// 종합 점수가 가장 높은 LLM 사용
const llmResponse = await pag0.fetch(balanced[0].endpoint, {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Explain quantum computing',
    max_tokens: 500
  })
});
```

### 3.3 pag0.compare() - API 비교

**기본 사용법**:

```typescript
const comparison = await pag0.compare(endpoints: string[]);
```

**예시: 번역 API 3개 비교**

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

// 시각화
comparison.forEach(api => {
  console.log(`${api.endpoint}`);
  console.log(`  Cost: $${(parseInt(api.avgCost) / 1e6).toFixed(3)}`);
  console.log(`  Speed: ${api.avgSpeed}ms`);
  console.log(`  Score: ${(api.score * 100).toFixed(0)}%`);
});
```

### 3.4 pag0.getSpent() - 지출 확인

**기본 사용법**:

```typescript
const spent = await pag0.getSpent(period?: 'today' | 'week' | 'month');
```

**예시**:

```typescript
// 오늘 지출
const today = await pag0.getSpent('today');
console.log('Today:', today);
// {
//   total: '2500000',        // 2.5 USDC
//   budgetLimit: '10000000', // 10 USDC
//   remaining: '7500000',    // 7.5 USDC
//   requestCount: 150,
//   cacheSavings: '1200000'  // 1.2 USDC 절감
// }

// 주간 지출
const week = await pag0.getSpent('week');
console.log('This week:', week.total);

// 월간 지출
const month = await pag0.getSpent('month');
console.log('This month:', month.total);

// 예산 초과 확인
if (parseInt(today.remaining) < 0) {
  console.warn('Daily budget exceeded!');
}
```

### 3.5 pag0.getAnalytics() - 분석 데이터 조회

**기본 사용법**:

```typescript
const analytics = await pag0.getAnalytics({
  period?: 'day' | 'week' | 'month';
  groupBy?: 'endpoint' | 'hour' | 'day';
});
```

**예시 1: 엔드포인트별 사용량**

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

**예시 2: 시간대별 사용량**

```typescript
const byHour = await pag0.getAnalytics({
  period: 'day',
  groupBy: 'hour'
});

// 차트 생성
byHour.forEach(hour => {
  const bar = '█'.repeat(hour.requestCount / 10);
  console.log(`${hour.hour}:00 ${bar} ${hour.requestCount} requests`);
});
// 00:00 ████ 40 requests
// 01:00 ██ 20 requests
// ...
```

---

## 4. 정책 설정 가이드

### 4.1 예산 제한 설정

**시나리오 1: 개발/테스트 환경**

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

**시나리오 2: 프로덕션 (소규모)**

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

**시나리오 3: 엔터프라이즈**

```typescript
const pag0Enterprise = createPag0Client({
  apiKey: process.env.PAG0_ENTERPRISE_KEY!,
  policy: {
    maxPerRequest: '10000000',      // 10 USDC
    dailyBudget: '1000000000',      // 1000 USDC/day
    monthlyBudget: '20000000000',   // 20,000 USDC/month
    requireApproval: {
      threshold: '5000000',         // 5 USDC 이상 승인 필요
      webhookUrl: 'https://erp.company.com/approve',
      timeoutSeconds: 600           // 10분 대기
    }
  }
});
```

### 4.2 엔드포인트 화이트리스트/블랙리스트

**화이트리스트 전략** (권장 - 보수적):

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

**블랙리스트 전략** (유연 - 특정 API만 차단):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: {
    blockedEndpoints: [
      'https://expensive-api.com/*',      // 고비용 API
      'https://unreliable-service.io/*',  // 불안정 서비스
      '.*\.onion/.*'                       // Tor 네트워크 차단
    ],
    dailyBudget: '10000000'
  }
});
```

### 4.3 승인 워크플로우 설정

**Webhook 서버 구현**:

```typescript
// approval-server.ts
import express from 'express';

const app = express();
app.use(express.json());

app.post('/approve-payment', async (req, res) => {
  const { requestId, endpoint, cost, timestamp } = req.body;

  // 1. 데이터베이스에 승인 요청 저장
  await db.insert('approval_requests', {
    request_id: requestId,
    endpoint,
    cost,
    status: 'pending'
  });

  // 2. Slack/Discord 알림
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

  // 3. 승인 대기 (polling 또는 webhook)
  const result = await waitForApproval(requestId, 300); // 5분 대기

  if (result === 'approved') {
    res.json({ approved: true });
  } else {
    res.json({ approved: false, reason: result });
  }
});

app.listen(3001);
```

**SDK 사용**:

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

// 고액 요청 시 자동으로 승인 워크플로우 진입
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

### 4.4 이상 탐지 설정

**이상 탐지 Webhook 구현**:

```typescript
// alert-handler.ts
app.post('/anomaly-alert', async (req, res) => {
  const { type, endpoint, cost, avgCost, deviation } = req.body;

  // 1. 로그 기록
  console.warn(`⚠️ Anomaly detected: ${type}`);
  console.warn(`Endpoint: ${endpoint}`);
  console.warn(`Current: $${(parseInt(cost) / 1e6).toFixed(3)}`);
  console.warn(`Average: $${(parseInt(avgCost) / 1e6).toFixed(3)}`);
  console.warn(`Deviation: ${deviation}%`);

  // 2. Discord 알림
  await sendDiscordAlert({
    title: '🚨 Cost Anomaly Detected',
    fields: [
      { name: 'Endpoint', value: endpoint },
      { name: 'Current Cost', value: `$${(parseInt(cost) / 1e6).toFixed(3)}` },
      { name: 'Deviation', value: `+${deviation}%` }
    ],
    color: 0xff0000
  });

  // 3. 필요 시 정책 자동 업데이트
  if (deviation > 500) {
    await pag0.updatePolicy({
      blockedEndpoints: [endpoint] // 해당 엔드포인트 차단
    });
  }

  res.json({ acknowledged: true });
});
```

**SDK 설정**:

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

## 5. 캐시 설정 가이드

### 5.1 TTL 설정

**기본 원칙**:

- **실시간 데이터**: 짧은 TTL (30-60초)
- **준정적 데이터**: 중간 TTL (5-30분)
- **정적 데이터**: 긴 TTL (1-24시간)

**예시**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300, // 5분 (기본값)
    ttlRules: [
      // 실시간 가격 데이터
      {
        pattern: 'https://api.coingecko.com/api/v3/simple/price.*',
        ttl: 30  // 30초
      },

      // DeFi 라우팅 (가스비 변동)
      {
        pattern: 'https://api.1inch.io/v5.0/.*/quote.*',
        ttl: 60  // 1분
      },

      // LLM 응답 (동일 프롬프트)
      {
        pattern: 'https://api.openai.com/v1/chat/completions',
        ttl: 3600  // 1시간
      },

      // 번역 (동일 텍스트)
      {
        pattern: 'https://api.deepl.com/v2/translate',
        ttl: 86400  // 24시간
      },

      // 블록체인 데이터 (확정 블록)
      {
        pattern: 'https://.*\\.infura\\.io/.*',
        ttl: 600  // 10분
      }
    ]
  }
});
```

### 5.2 엔드포인트별 TTL 규칙

**URL 패턴 매칭**:

```typescript
ttlRules: [
  // 정확한 매칭
  {
    pattern: 'https://api.example.com/static',
    ttl: 86400
  },

  // 와일드카드 매칭
  {
    pattern: 'https://api.example.com/data/*',
    ttl: 300
  },

  // Regex 매칭
  {
    pattern: 'https://api\\..*\\.com/prices/.*',
    ttl: 60
  },

  // Query parameter 포함
  {
    pattern: 'https://api.example.com/search\\?.*cache=long.*',
    ttl: 3600
  }
]
```

### 5.3 캐시 제외 패턴

**제외해야 할 요청**:

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  cache: {
    enabled: true,
    defaultTTL: 300,
    excludePatterns: [
      // 1. Nonce/Timestamp 포함 (항상 유니크)
      '.*nonce=.*',
      '.*timestamp=.*',

      // 2. 인증 토큰 (민감 데이터)
      '.*token=.*',
      '.*api_key=.*',

      // 3. 실시간 스트리밍
      'https://api.example.com/stream/.*',

      // 4. WebSocket 업그레이드
      '.*ws://.*',
      '.*wss://.*',

      // 5. POST/PUT/DELETE (멱등하지 않음)
      // SDK가 자동으로 제외하지만 명시 가능

      // 6. 사용자별 맞춤 데이터
      'https://api.example.com/user/.*/recommendations'
    ]
  }
});
```

### 5.4 캐시 바이패스 (X-Pag0-Cache-Bypass 헤더)

**언제 사용하나?**

- 디버깅 (항상 최신 응답 필요)
- 테스트 (캐시 무효화)
- 특정 요청만 fresh data 필요

**사용 예시**:

```typescript
// 일반 요청 (캐시 사용)
const cached = await pag0.fetch('https://api.example.com/data');
console.log('Cached:', cached.meta.cached); // true

// 캐시 바이패스 (항상 fresh)
const fresh = await pag0.fetch('https://api.example.com/data', {
  headers: {
    'X-Pag0-Cache-Bypass': 'true'
  }
});
console.log('Cached:', fresh.meta.cached); // false
console.log('Cost:', fresh.meta.cost); // 실제 비용 발생
```

---

## 6. 큐레이션 API 가이드

### 6.1 카테고리별 추천 받기

**지원 카테고리** (2024년 1월 기준):

```typescript
type APICategory =
  | 'translation'      // 번역
  | 'llm'              // Large Language Models
  | 'defi-routing'     // DeFi 스왑 라우팅
  | 'price-feeds'      // 가격 데이터
  | 'gas-estimation'   // 가스비 예측
  | 'nft-metadata'     // NFT 메타데이터
  | 'blockchain-data'  // 블록체인 인덱싱
  | 'ai-image'         // AI 이미지 생성
  | 'speech-to-text'   // 음성 인식
  | 'text-to-speech';  // TTS
```

**예시 1: 번역 API**

```typescript
const translationAPIs = await pag0.recommend({
  category: 'translation',
  optimize: 'balanced',
  limit: 5
});

// 결과:
// [
//   { endpoint: 'https://api.deepl.com/v2/translate', score: 0.95 },
//   { endpoint: 'https://translation.googleapis.com/...', score: 0.92 },
//   { endpoint: 'https://api.openai.com/v1/chat/completions', score: 0.75 }
// ]
```

**예시 2: DeFi 라우팅**

```typescript
const routingAPIs = await pag0.recommend({
  category: 'defi-routing',
  optimize: 'cost' // 가장 저렴한 라우터
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

### 6.2 최적화 기준 설정

**optimize 옵션 상세**:

```typescript
type OptimizeCriteria =
  | 'cost'        // 가격 우선 (avgCost 낮은 순)
  | 'speed'       // 속도 우선 (avgSpeed 낮은 순)
  | 'reliability' // 안정성 우선 (reliabilityScore 높은 순)
  | 'balanced';   // 균형 (종합 score 높은 순)
```

**점수 계산 방식**:

```typescript
// 'balanced' 점수 계산
score = (
  (1 / normalizeCost(avgCost)) * 0.4 +
  (1 / normalizeSpeed(avgSpeed)) * 0.3 +
  reliabilityScore * 0.3
);

// 'cost' 최적화
score = 1 / normalizeCost(avgCost);

// 'speed' 최적화
score = 1 / normalizeSpeed(avgSpeed);

// 'reliability' 최적화
score = reliabilityScore;
```

**예시: 최적화 기준 비교**

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

### 6.3 API 비교하기

**직접 비교 (2-10개 엔드포인트)**:

```typescript
const comparison = await pag0.compare([
  'https://api.openai.com/v1/chat/completions',
  'https://api.anthropic.com/v1/complete',
  'https://api.cohere.ai/v1/generate'
]);

// 테이블로 출력
console.table(comparison.map(api => ({
  'API': api.endpoint.split('/')[2], // 도메인만
  'Avg Cost ($)': (parseInt(api.avgCost) / 1e6).toFixed(3),
  'Avg Speed (ms)': api.avgSpeed,
  'Reliability (%)': (api.reliabilityScore * 100).toFixed(0),
  'Score': (api.score * 100).toFixed(0)
})));

// 출력:
// ┌─────────┬──────────────┬───────────────┬─────────────────┬───────┐
// │ (index) │     API      │ Avg Cost ($)  │ Avg Speed (ms)  │ Score │
// ├─────────┼──────────────┼───────────────┼─────────────────┼───────┤
// │    0    │ 'openai.com' │   '0.100'     │      2500       │  '75' │
// │    1    │'anthropic...'│   '0.120'     │      2800       │  '72' │
// │    2    │ 'cohere.ai'  │   '0.080'     │      3000       │  '78' │
// └─────────┴──────────────┴───────────────┴─────────────────┴───────┘
```

### 6.4 랭킹 조회

**전체 랭킹** (카테고리별 Top 10):

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

### 6.5 개별 엔드포인트 점수 조회

**특정 API 상세 정보**:

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
//     costTrend: -0.05,      // 5% 감소 (좋음)
//     speedTrend: 0.10,      // 10% 증가 (나쁨)
//     reliabilityTrend: 0.02 // 2% 증가 (좋음)
//   }
// }
```

---

## 7. 프레임워크 통합

### 7.1 Express.js Middleware

```typescript
import express from 'express';
import { createPag0Client } from '@pag0/sdk';

const app = express();
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  policy: { dailyBudget: '10000000' }
});

// Pag0 미들웨어
app.use((req, res, next) => {
  req.pag0 = pag0;
  next();
});

// 라우트에서 사용
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

# 사용 예시
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

// 사용
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

## 8. 에러 처리

### 8.1 에러 코드 및 의미

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

### 8.1.1 Proxy 응답 코드 구분

Pag0 Proxy를 경유하면 x402 원본 에러와 Pag0 자체 에러가 혼재합니다. 아래 표로 구분하세요:

| HTTP 코드 | 출처 | 의미 | 대응 |
|-----------|------|------|------|
| **402** | x402 서버 | 결제 필요 (Payment Required) | Agent 지갑으로 서명 후 재요청 (SDK가 자동 처리) |
| **403** | Pag0 Proxy | 정책 위반 (Policy Violation) | `PolicyViolationError` — 허용 엔드포인트/예산 설정 확인 |
| **429** | Pag0 Proxy | Rate Limit 초과 | 재시도 (Retry-After 헤더 참조) 또는 플랜 업그레이드 |
| **502/503** | Pag0 Proxy | Proxy 서버 장애 | `fallbackMode` 설정에 따라 직접 호출 또는 즉시 실패 |

```typescript
try {
  const response = await pag0.fetch(url);
} catch (error) {
  if (error instanceof PolicyViolationError) {
    // 403: Pag0 정책 위반 — 엔드포인트/예산 설정 확인
    console.error('Policy blocked:', error.reason);
  } else if (error instanceof BudgetExceededError) {
    // 403: 예산 초과 — dailyBudget/monthlyBudget 확인
    console.error('Budget limit reached:', error.details.remaining);
  } else if (error instanceof NetworkError && error.statusCode === 429) {
    // 429: Rate limit — 재시도 필요
    const retryAfter = error.headers?.get('Retry-After') || '60';
    console.warn(`Rate limited. Retry after ${retryAfter}s`);
  }
  // 402는 SDK가 자동으로 서명+재요청을 처리하므로 일반적으로 catch되지 않음
}
```

### 8.2 재시도 전략

**자동 재시도** (SDK 내장):

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  retries: 3,                    // 재시도 횟수
  retryDelay: 1000,              // 초기 지연 (ms)
  retryBackoff: 'exponential'    // 'exponential' | 'linear'
});

// 실패 시 자동으로 3번까지 재시도 (1초, 2초, 4초 간격)
const response = await pag0.fetch(url);
```

**수동 재시도**:

```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Pag0Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await pag0.fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.min(1000 * Math.pow(2, i), 10000); // max 10초
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 8.3 Fallback 패턴

**Fallback 1: 직접 x402 호출**

> **⚠️ 보안 주의**: `fallbackMode: 'direct'`를 사용하면 Proxy 장애 시 **모든 Pag0 보호 기능이 우회**됩니다.
> 정책 적용(예산 제한, 화이트리스트), 캐시, 분석 수집이 모두 비활성화되며,
> Agent가 직접 x402 서버에 요청합니다. 프로덕션 환경에서는 `'fail'` 모드를 권장합니다.

```typescript
const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY!,
  fallbackMode: 'direct' // Proxy 실패 시 직접 호출
});

// ⚠️ Proxy 다운 시 직접 x402 호출 — 정책/캐시/분석 모두 우회됨
const response = await pag0.fetch(url);
```

**Fallback 2: 대체 API 사용**

```typescript
async function fetchWithFallback(primary: string, fallback: string) {
  try {
    return await pag0.fetch(primary);
  } catch (error) {
    console.warn('Primary API failed, using fallback');
    return await pag0.fetch(fallback);
  }
}

// 사용
const translation = await fetchWithFallback(
  'https://api.deepl.com/v2/translate',      // Primary
  'https://translation.googleapis.com/...'   // Fallback
);
```

**Fallback 3: 캐시 우선 (Stale-While-Revalidate)**

```typescript
async function fetchStaleWhileRevalidate(url: string) {
  // 1. 캐시 확인 (stale 허용)
  const cached = await pag0.getCached(url);
  if (cached) {
    // 2. 백그라운드에서 갱신
    pag0.fetch(url).catch(console.error);
    // 3. 즉시 캐시 반환
    return cached;
  }

  // 4. 캐시 없으면 정상 요청
  return await pag0.fetch(url);
}
```

---

## 9. 실전 예제

### 9.1 리서치 에이전트 (번역+검색+분석)

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
      { pattern: '.*translate.*', ttl: 86400 },  // 번역: 24시간
      { pattern: '.*search.*', ttl: 3600 },      // 검색: 1시간
      { pattern: '.*completions.*', ttl: 7200 }  // LLM: 2시간
    ]
  }
});

async function researchTopic(topic: string, targetLang: string = 'en') {
  // 1. 검색
  const searchResults = await pag0.fetch('https://api.tavily.com/search', {
    method: 'POST',
    body: JSON.stringify({ query: topic, max_results: 5 })
  });
  const articles = await searchResults.json();
  console.log('Search cost:', searchResults.meta.cost);

  // 2. 번역 (필요 시)
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

  // 3. LLM 분석
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

  // 4. 비용 집계
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

// 사용
const report = await researchTopic('Quantum Computing', 'ko');
console.log(report.summary);
```

### 9.2 트레이딩 봇 (가격+라우팅+가스)

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
      { pattern: '.*price.*', ttl: 30 },    // 가격: 30초
      { pattern: '.*quote.*', ttl: 60 },    // 스왑: 1분
      { pattern: '.*gas.*', ttl: 20 }       // 가스: 20초
    ]
  }
});

async function executeTrade(fromToken: string, toToken: string, amount: string) {
  // 1. 가격 확인
  const prices = await pag0.fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${fromToken},${toToken}&vs_currencies=usd`
  );
  const priceData = await prices.json();
  console.log('Current prices:', priceData);

  // 2. 라우팅 비교 (1inch vs Uniswap)
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

  // 최적 라우터 선택
  const bestQuote = quotes.sort((a, b) =>
    parseInt(b.quote.toAmount) - parseInt(a.quote.toAmount)
  )[0];

  // 3. 가스비 예측
  const gas = await pag0.fetch('https://api.blocknative.com/gasprices/blockprices');
  const gasData = await gas.json();
  const estimatedGas = gasData.estimatedPrices[0].maxFeePerGas;

  console.log('Best route:', bestQuote.router);
  console.log('Output amount:', bestQuote.quote.toAmount);
  console.log('Estimated gas:', estimatedGas);

  // 4. 거래 실행 (예시)
  // await executeOnChain(bestQuote.quote.tx);

  // 5. 비용 리포트
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

// 사용
const trade = await executeTrade('ethereum', 'usd-coin', '1000000000'); // 1 ETH
console.log('Trade result:', trade);
```

### 9.3 MCP 브릿지 (유료 MCP 서버 관리)

```typescript
import { createPag0Client } from '@pag0/sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Pag0로 유료 MCP 서버 래핑
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

// MCP 서버 생성
const server = new Server(
  { name: 'pag0-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool: 유료 번역 API (Pag0 관리)
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'translate') {
    const { text, targetLang } = request.params.arguments;

    // Pag0를 통해 최적 번역 API 선택
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

// 서버 실행
const transport = new StdioServerTransport();
await server.connect(transport);
console.log('Pag0 MCP Bridge running');
```

---

## 10. 추가 리소스

### 문서

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

**다음 단계**: SDK 통합 완료 후 [13-GO-TO-MARKET.md](13-GO-TO-MARKET.md)를 참고하여 사용자 확보 전략을 수립하세요.
