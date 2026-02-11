# Pag0 보안 설계 문서

> **TL;DR**: Pag0의 핵심 보안 강점은 "Proxy는 자금을 통제할 수 없다"는 설계입니다. Zero Trust + 6층 다층 방어 아키텍처로 Agent가 직접 서명한 Payment만 전달하여, 최악의 침해 시나리오에서도 사용자 자금이 안전합니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 시스템 아키텍처 및 컴포넌트 설계 |
| [04-API-SPEC.md](04-API-SPEC.md) | API 엔드포인트 인증/인가 상세 |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | DB 보안 스키마 및 RLS 정책 |
| [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md) | 보안 배포 체크리스트 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 핵심 용어 및 약어 정리 |

---

## 1. 보안 원칙

### 1.1 Zero Trust Architecture

- **모든 요청 검증**: API Key, Policy, Payment Signature 필수 검증
- **네트워크 경계 무신뢰**: 내부/외부 구분 없이 동일 보안 수준 적용
- **최소 신뢰 범위**: 각 컴포넌트는 필요한 최소 권한만 보유

### 1.2 다층 방어 (Defense in Depth)

```yaml
# 보안 레이어 구조
security_layers:
  - layer: 1
    name: "네트워크"
    controls: ["TLS 1.3", "Rate Limiting"]
  - layer: 2
    name: "인증"
    controls: ["API Key (bcrypt)", "JWT"]
  - layer: 3
    name: "인가"
    controls: ["Policy Engine", "RBAC"]
  - layer: 4
    name: "애플리케이션"
    controls: ["Input Validation", "Sanitization"]
  - layer: 5
    name: "데이터"
    controls: ["AES-256 암호화", "PII Hashing"]
  - layer: 6
    name: "감사"
    controls: ["불변 로그", "이상 탐지"]
```

```
Layer 1: Network (TLS 1.3, Rate Limiting)
Layer 2: Authentication (API Key, JWT)
Layer 3: Authorization (Policy Engine, RBAC)
Layer 4: Application (Input Validation, Sanitization)
Layer 5: Data (Encryption at Rest, PII Hashing)
Layer 6: Audit (Immutable Logs, Anomaly Detection)
```

### 1.3 Least Privilege (최소 권한 원칙)

- API Key는 특정 프로젝트에만 접근 가능
- Policy는 소유자만 수정 가능
- Database 접근은 읽기/쓰기 분리
- Redis는 캐시/메트릭 전용 (민감 데이터 제외)

### 1.4 **핵심 보안 설계: Proxy는 결제 서명 권한 없음**

```
┌─────────────────────────────────────────────────────┐
│ 왜 안전한가?                                           │
├─────────────────────────────────────────────────────┤
│ 1. Proxy는 Agent의 Private Key를 보유하지 않음        │
│ 2. Payment Payload는 Agent가 서명 후 전달            │
│ 3. Proxy는 서명된 Payload를 단순 전달만 수행          │
│ 4. Proxy 서버 침해 시에도 자금 탈취 불가능             │
└─────────────────────────────────────────────────────┘
```

**결제 흐름의 보안 구조**:

```
Agent                    Pag0 Proxy              x402 Server
  │                          │                       │
  ├──► POST /proxy ──────────┤                       │
  │    (unsigned request)    │                       │
  │                          ├──► GET /endpoint ─────┤
  │                          │                       │
  │                          ◄──── 402 Payment ──────┤
  │                          │     Required          │
  │                          │                       │
  │                          ├──► Policy Check       │
  │                          │     (Budget, Whitelist)
  │                          │                       │
  │ ◄──── 402 Response ──────┤                       │
  │    (Payment Payload)     │                       │
  │                          │                       │
  ├──► Sign Payment ─────────┤                       │
  │    (with Agent's PK)     │                       │
  │                          │                       │
  ├──► Submit Signed ────────┤                       │
  │    Payment               │                       │
  │                          │                       │
  │                          ├──► Relay to ──────────┤
  │                          │     Facilitator       │
  │                          │     (NO MODIFICATION) │
  │                          │                       │
  │                          ◄──── 200 OK ───────────┤
  │                          │                       │
  │ ◄──── 200 Response ──────┤                       │
       (Cache + Log)
```

**보안 보장사항**:

- Proxy는 Payment Payload를 **읽기만** 가능 (서명 불가)
- Proxy가 침해되어도 **서명된 결제만 전달**되므로 자금 안전
- Policy Check는 **결제 전에만** 수행 (결제 후 수정 불가)

---

## 2. 인증

### 2.1 API Key 관리

**발급 형식**:

```
pag0_[environment]_[random_32_bytes_hex]

예시:
- pag0_dev_a1b2c3d4e5f6...
- pag0_prod_f6e5d4c3b2a1...
```

**저장 방식**:

```typescript
// API Key는 bcrypt로 해싱하여 저장
import bcrypt from 'bcrypt';

async function createAPIKey(userId: string, projectId: string) {
  const rawKey = `pag0_${env}_${crypto.randomBytes(32).toString('hex')}`;
  const hashedKey = await bcrypt.hash(rawKey, 12); // cost factor 12

  await db.insert('api_keys', {
    user_id: userId,
    project_id: projectId,
    key_hash: hashedKey,
    key_prefix: rawKey.slice(0, 12), // 검색용
    created_at: new Date(),
    last_used_at: null,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1년
  });

  // 원본 키는 사용자에게 1회만 표시 (재발급 불가)
  return rawKey;
}
```

**검증 프로세스**:

```typescript
async function validateAPIKey(providedKey: string): Promise<User | null> {
  const prefix = providedKey.slice(0, 12);
  const keys = await db.query('api_keys', { key_prefix: prefix, active: true });

  for (const key of keys) {
    const valid = await bcrypt.compare(providedKey, key.key_hash);
    if (valid && new Date() < key.expires_at) {
      await db.update('api_keys', key.id, { last_used_at: new Date() });
      return await db.findUser(key.user_id);
    }
  }

  return null;
}
```

### 2.2 API Key 로테이션 정책

| 시나리오 | 조치 | 자동화 |
|---------|------|--------|
| 정기 로테이션 | 365일마다 경고 | Dashboard 알림 |
| 유출 의심 | 즉시 무효화 + 재발급 | 수동 |
| 미사용 키 | 90일 미사용 시 자동 만료 | Cron Job |
| 키 손상 | 전체 프로젝트 키 재발급 | CLI 명령어 |

**로테이션 명령어**:

```bash
pag0 keys rotate --project my-agent --grace-period 7d
# → 새 키 발급, 기존 키는 7일 후 만료
```

### 2.3 JWT 토큰 (Dashboard 전용)

**용도**: Web Dashboard 세션 관리

**발급**:

```typescript
import jwt from 'jsonwebtoken';

function issueJWT(user: User) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '7d',
      issuer: 'pag0.io',
      audience: 'dashboard'
    }
  );
}
```

**검증**:

- 모든 Dashboard API 요청에 Bearer Token 필요
- Refresh Token은 httpOnly Cookie로 저장 (XSS 방어)
- Access Token은 localStorage (7일 TTL)

### 2.4 Rate Limiting

**계층별 제한**:

```typescript
const rateLimits = {
  byIP: {
    windowMs: 60 * 1000,      // 1분
    max: 60,                   // 60 requests
    message: 'Too many requests from this IP'
  },
  byAPIKey: {
    free: {
      windowMs: 60 * 1000,
      max: 600,                // 10 req/sec
      daily: 1000
    },
    pro: {
      windowMs: 60 * 1000,
      max: 6000,               // 100 req/sec
      daily: 1_000_000
    },
    enterprise: {
      windowMs: 60 * 1000,
      max: 60000,              // 1000 req/sec
      daily: 10_000_000
    }
  }
};
```

**구현** (Redis + Token Bucket):

```typescript
async function checkRateLimit(apiKey: string): Promise<boolean> {
  const key = `ratelimit:${apiKey}`;
  const now = Date.now();

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60); // 1분 TTL
  }

  const limit = await getUserLimit(apiKey);
  return count <= limit.max;
}
```

---

## 3. 인가

### 3.1 Policy 소유권 검증

**데이터 모델**:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE policies (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**검증 로직**:

```typescript
async function verifyPolicyOwnership(
  apiKey: string,
  policyId: string
): Promise<boolean> {
  const user = await validateAPIKey(apiKey);
  if (!user) return false;

  const policy = await db.query(`
    SELECT p.* FROM policies p
    JOIN projects pr ON p.project_id = pr.id
    JOIN api_keys ak ON pr.id = ak.project_id
    WHERE p.id = $1 AND ak.key_hash = $2
  `, [policyId, await hashKey(apiKey)]);

  return policy.length > 0;
}
```

### 3.2 프로젝트별 격리 (Multi-Tenant)

**격리 보장**:

- 모든 쿼리에 `project_id` 필터 필수
- Row-Level Security (RLS) 활성화 (Supabase)
- API Key는 단일 프로젝트에만 바인딩

**Supabase RLS 정책**:

```sql
-- policies 테이블 RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own policies"
  ON policies FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only update their own policies"
  ON policies FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );
```

### 3.3 RBAC 설계

**역할 정의**:

```typescript
enum Role {
  ADMIN = 'admin',     // 모든 권한
  MEMBER = 'member',   // 읽기 + 쓰기 (삭제 제외)
  VIEWER = 'viewer'    // 읽기 전용
}

const permissions = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  member: ['read', 'write'],
  viewer: ['read']
};
```

**프로젝트 멤버 관리**:

```sql
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);
```

---

## 4. 데이터 보호

### 4.1 전송 구간 암호화

**TLS 1.3 필수**:

```javascript
// Hono 서버 설정
import { serve } from '@hono/node-server';

serve({
  fetch: app.fetch,
  tls: {
    key: fs.readFileSync('/path/to/key.pem'),
    cert: fs.readFileSync('/path/to/cert.pem'),
    minVersion: 'TLSv1.3',
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
  }
});
```

**HSTS 헤더**:

```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
});
```

### 4.2 저장 구간 암호화

**PostgreSQL at-rest encryption**:

- Supabase는 기본적으로 AES-256 암호화 활성화
- 추가 컬럼 레벨 암호화 (민감 데이터):

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

### 4.3 PII 처리

**요청 본문은 해시만 저장** (원문 미저장):

```typescript
import { createHash } from 'crypto';

async function logRequest(req: Request) {
  const body = await req.text();
  const bodyHash = createHash('sha256').update(body).digest('hex');

  await db.insert('request_logs', {
    timestamp: new Date(),
    endpoint: req.url,
    method: req.method,
    body_hash: bodyHash,        // 원본 body는 저장 안 함
    response_status: null,
    cost: null
  });
}
```

**PII 필드 마스킹**:

```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// 로그 출력 시
console.log(`User ${maskEmail(user.email)} requested analytics`);
```

### 4.4 캐시 보호

**Redis TLS 연결**:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
  enableTelemetry: false,
  enableAutoPipelining: false,
  tls: {
    rejectUnauthorized: true
  }
});
```

**캐시 키 만료 (자동 삭제)**:

```typescript
async function cacheResponse(key: string, value: any, ttl: number) {
  await redis.setex(
    key,
    ttl,                    // 만료 시간 (초)
    JSON.stringify(value)
  );
}

// 민감 데이터는 짧은 TTL
await cacheResponse('user:session', sessionData, 300); // 5분
```

---

## 5. x402 결제 보호

### 5.1 Payment Payload 무결성 검증

**서명 검증 프로세스**:

```typescript
import { verifyMessage } from 'viem';

async function verifyPaymentSignature(
  payment: PaymentPayload,
  signature: string,
  agentAddress: string
): Promise<boolean> {
  const message = JSON.stringify({
    to: payment.to,
    amount: payment.amount,
    currency: payment.currency,
    nonce: payment.nonce,
    timestamp: payment.timestamp
  });

  const isValid = await verifyMessage({
    address: agentAddress as `0x${string}`,
    message,
    signature: signature as `0x${string}`
  });

  return isValid;
}
```

**검증 실패 시 거부**:

```typescript
if (!await verifyPaymentSignature(payment, sig, agent)) {
  return c.json({
    error: 'Invalid payment signature',
    code: 'INVALID_SIGNATURE'
  }, 403);
}
```

### 5.2 Replay Attack 방지

**Nonce 추적**:

```typescript
const NONCE_TTL = 3600; // 1시간

async function checkNonce(agentAddress: string, nonce: string): Promise<boolean> {
  const key = `nonce:${agentAddress}:${nonce}`;
  const exists = await redis.exists(key);

  if (exists) {
    return false; // 이미 사용된 nonce
  }

  await redis.setex(key, NONCE_TTL, '1');
  return true;
}

// 사용 예시
if (!await checkNonce(agent, payment.nonce)) {
  return c.json({ error: 'Nonce already used (replay attack?)' }, 403);
}
```

**Timestamp 검증**:

```typescript
const MAX_TIMESTAMP_DRIFT = 300; // 5분

function validateTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= MAX_TIMESTAMP_DRIFT;
}
```

### 5.3 Facilitator 신뢰 체인 검증

**Coinbase CDP Facilitator 검증**:

```typescript
const TRUSTED_FACILITATORS = [
  'https://facilitator.cdp.coinbase.com',
  'https://facilitator-testnet.cdp.coinbase.com'
];

function validateFacilitator(url: string): boolean {
  return TRUSTED_FACILITATORS.includes(url);
}

// x402 응답 처리 시
const facilitatorUrl = x402Response.headers.get('X-Facilitator-URL');
if (!validateFacilitator(facilitatorUrl)) {
  throw new Error('Untrusted facilitator');
}
```

### 5.4 프록시 중간자 공격 방지

**Proxy는 Payment를 수정할 수 없음**:

```typescript
async function relayPayment(signedPayment: SignedPayment) {
  // ❌ 잘못된 예시: Proxy가 amount를 변경
  // signedPayment.amount = "999999999"; // 서명 불일치로 거부됨

  // ✅ 올바른 예시: 원본 그대로 전달
  const response = await fetch(facilitatorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signedPayment.signature
    },
    body: JSON.stringify(signedPayment.payload) // 수정 없이 전달
  });

  return response;
}
```

**무결성 검증 로깅**:

```typescript
await db.insert('payment_audit', {
  timestamp: new Date(),
  agent_address: agent,
  payload_hash: createHash('sha256').update(JSON.stringify(payment)).digest('hex'),
  signature: sig,
  facilitator_response: response.status,
  modified: false // Proxy는 항상 false
});
```

---

## 6. 위협 모델링

```yaml
# 위협 모델 요약
threats:
  - id: "T1"
    name: "악성 에이전트 예산 우회"
    severity: "높음"
    mitigation: "Agent 주소 기반 예산 추적 + On-chain 컨트랙트"
  - id: "T2"
    name: "캐시 포이즈닝"
    severity: "중간"
    mitigation: "Agent별 캐시 키 격리 + 서명 검증 + TTL 제한"
  - id: "T3"
    name: "API Key 유출"
    severity: "높음"
    mitigation: "GitHub Secret Scanning + 로그 마스킹 + 이상 접근 탐지"
  - id: "T4"
    name: "DDoS 공격"
    severity: "높음"
    mitigation: "Cloudflare DDoS + Rate Limiting + Circuit Breaker"
  - id: "T5"
    name: "프록시 서버 침해"
    severity: "치명적"
    mitigation: "최소 권한 DB 계정 + 자금 탈취 불가 설계"
```

### Threat 1: 악성 에이전트의 예산 우회 시도

**시나리오**:

- Agent가 Policy를 무시하고 직접 x402 서버 호출
- 또는 다른 API Key를 사용하여 예산 제한 회피

**완화 전략**:

1. **예산은 Agent 주소 기반 추적** (API Key 무관)

   ```typescript
   async function checkBudget(agentAddress: string, amount: bigint) {
     const spent = await redis.get(`budget:${agentAddress}:daily`);
     const policy = await getPolicy(agentAddress);
     return BigInt(spent || 0) + amount <= BigInt(policy.dailyBudget);
   }
   ```

2. **On-chain 예산 컨트랙트** (P2 기능):

   ```solidity
   contract BudgetController {
     mapping(address => uint256) public dailyBudgets;
     mapping(address => uint256) public spent;

     function enforcePayment(address agent, uint256 amount) external {
       require(spent[agent] + amount <= dailyBudgets[agent], "Budget exceeded");
       spent[agent] += amount;
     }
   }
   ```

3. **x402 서버에 Policy URL 제공** (미래 표준):
   - x402 서버가 결제 전 Pag0 Policy 확인
   - 표준화되면 우회 불가능

### Threat 2: 캐시 포이즈닝 공격

**시나리오**:

- 공격자가 악의적인 응답을 캐시에 주입
- 다른 사용자가 잘못된 데이터 수신

**완화 전략**:

1. **캐시 키는 Agent 주소 포함**:

   ```typescript
   function getCacheKey(agent: string, url: string, body: string): string {
     const hash = createHash('sha256')
       .update(`${agent}:${url}:${body}`)
       .digest('hex');
     return `cache:${agent}:${hash}`;
   }
   ```

2. **캐시 응답에 서명 추가** (검증 가능):

   ```typescript
   const cacheEntry = {
     data: response,
     signature: await signData(response, PROXY_PRIVATE_KEY),
     timestamp: Date.now()
   };
   ```

3. **TTL 제한** (최대 1시간):
   - 장기 캐시 방지로 오염 피해 최소화

### Threat 3: API Key 유출

**시나리오**:

- API Key가 GitHub에 커밋됨
- 또는 로그 파일에 노출됨

**완화 전략**:

1. **GitHub Secret Scanning 등록**:
   - `pag0_` 패턴 자동 탐지
   - 발견 시 즉시 무효화 + 사용자 알림

2. **로그에서 API Key 제거**:

   ```typescript
   function sanitizeLogs(log: string): string {
     return log.replace(/pag0_[a-z]+_[a-f0-9]{64}/g, 'pag0_***_REDACTED');
   }
   ```

3. **유출 탐지**:
   - 비정상적인 지역/IP 접근 시 알림
   - 급격한 요청 증가 시 자동 일시 정지

### Threat 4: DDoS 공격

**시나리오**:

- 대량 요청으로 Proxy 서버 마비
- 또는 Redis/PostgreSQL 과부하

**완화 전략**:

1. **Cloudflare DDoS Protection**:
   - L3/L4/L7 공격 자동 차단
   - Rate Limiting at edge

2. **Redis 연결 풀 제한**:

   ```typescript
   const redis = new Redis({
     maxRetriesPerRequest: 3,
     connectTimeout: 5000,
     lazyConnect: true
   });
   ```

3. **Circuit Breaker 패턴**:

   ```typescript
   class CircuitBreaker {
     private failures = 0;
     private state: 'closed' | 'open' | 'half-open' = 'closed';

     async call<T>(fn: () => Promise<T>): Promise<T> {
       if (this.state === 'open') {
         throw new Error('Circuit breaker open');
       }

       try {
         const result = await fn();
         this.onSuccess();
         return result;
       } catch (err) {
         this.onFailure();
         throw err;
       }
     }

     private onFailure() {
       this.failures++;
       if (this.failures >= 5) {
         this.state = 'open';
         setTimeout(() => { this.state = 'half-open'; }, 30000); // 30초 후 재시도
       }
     }
   }
   ```

### Threat 5: 프록시 서버 침해 시 영향 범위

**시나리오**:

- 공격자가 Proxy 서버 장악
- Database/Redis 접근 권한 획득

**완화 전략**:

1. **최소 권한 Database 계정**:

   ```sql
   -- Proxy 서버용 계정 (읽기 전용)
   CREATE USER pag0_proxy WITH PASSWORD 'xxx';
   GRANT SELECT ON policies, projects TO pag0_proxy;
   GRANT INSERT ON request_logs, analytics TO pag0_proxy;
   -- UPDATE/DELETE 권한 없음
   ```

2. **민감 데이터 분리**:
   - API Key Hash는 별도 테이블/DB
   - Proxy는 검증 API만 호출 (Hash 직접 읽기 불가)

3. **침해 탐지 시스템**:
   - 비정상 쿼리 패턴 감지
   - Database 변경 사항 알림
   - 로그 외부 백업 (Immutable)

4. **핵심: 자금 탈취는 불가능**:
   - Proxy는 Private Key 보유 안 함
   - 서명된 Payment만 전달하므로 금액 변조 불가
   - 최악의 경우: 서비스 중단 (자금 손실 없음)

---

## 7. 감사 로그

### 7.1 정책 변경 이력

**스키마**:

```sql
CREATE TABLE policy_audit_log (
  id UUID PRIMARY KEY,
  policy_id UUID REFERENCES policies(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
  changes JSONB NOT NULL,       -- before/after diff
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
```

**자동 기록**:

```typescript
async function updatePolicy(policyId: string, newConfig: any, user: User) {
  const oldPolicy = await db.findPolicy(policyId);

  await db.transaction(async (tx) => {
    await tx.update('policies', policyId, { config: newConfig });

    await tx.insert('policy_audit_log', {
      policy_id: policyId,
      user_id: user.id,
      action: 'update',
      changes: {
        before: oldPolicy.config,
        after: newConfig,
        diff: diff(oldPolicy.config, newConfig)
      },
      timestamp: new Date(),
      ip_address: user.ipAddress
    });
  });
}
```

### 7.2 결제 이벤트 불변 로그

**SKALE Zero Gas 블록체인 기록**:

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';

const skaleClient = createWalletClient({
  chain: skaleChain,
  transport: http(process.env.SKALE_RPC_URL)
});

async function logPaymentOnChain(payment: Payment) {
  const tx = await skaleClient.writeContract({
    address: AUDIT_CONTRACT_ADDRESS,
    abi: AuditABI,
    functionName: 'logPayment',
    args: [
      payment.agent,
      payment.endpoint,
      payment.amount,
      payment.timestamp,
      payment.txHash
    ]
  });

  await skaleClient.waitForTransactionReceipt({ hash: tx });
}
```

**이벤트 검증**:

```solidity
// SKALE 감사 컨트랙트
contract PaymentAudit {
  event PaymentLogged(
    address indexed agent,
    string endpoint,
    uint256 amount,
    uint256 timestamp,
    bytes32 txHash
  );

  mapping(bytes32 => bool) public paymentExists;

  function logPayment(
    address agent,
    string memory endpoint,
    uint256 amount,
    uint256 timestamp,
    bytes32 txHash
  ) external {
    require(!paymentExists[txHash], "Already logged");

    paymentExists[txHash] = true;
    emit PaymentLogged(agent, endpoint, amount, timestamp, txHash);
  }

  function verifyPayment(bytes32 txHash) external view returns (bool) {
    return paymentExists[txHash];
  }
}
```

### 7.3 이상 탐지 알림 (P2 기능)

**이상 패턴 정의**:

```typescript
interface AnomalyRule {
  name: string;
  condition: (metrics: Metrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: (alert: Alert) => Promise<void>;
}

const anomalyRules: AnomalyRule[] = [
  {
    name: 'Sudden cost spike',
    condition: (m) => m.currentCost > m.avgCost * 3,
    severity: 'high',
    action: async (alert) => {
      await sendWebhook(alert.webhookUrl, {
        title: '비용 급증 탐지',
        cost: alert.cost,
        avgCost: alert.avgCost,
        deviation: `+${((alert.cost / alert.avgCost - 1) * 100).toFixed(0)}%`
      });
    }
  },
  {
    name: 'Unusual endpoint access',
    condition: (m) => !m.historicalEndpoints.includes(m.currentEndpoint),
    severity: 'medium',
    action: async (alert) => {
      await db.insert('anomaly_alerts', {
        type: 'new_endpoint',
        endpoint: alert.endpoint,
        timestamp: new Date()
      });
    }
  },
  {
    name: 'Rate limit approaching',
    condition: (m) => m.requestCount > m.rateLimit * 0.9,
    severity: 'low',
    action: async (alert) => {
      console.warn(`Rate limit 90% reached: ${alert.requestCount}/${alert.rateLimit}`);
    }
  }
];
```

**실시간 모니터링**:

```typescript
setInterval(async () => {
  const metrics = await collectMetrics();

  for (const rule of anomalyRules) {
    if (rule.condition(metrics)) {
      const alert = {
        rule: rule.name,
        severity: rule.severity,
        timestamp: new Date(),
        metrics
      };

      await rule.action(alert);

      if (rule.severity === 'critical') {
        await db.update('policies', metrics.policyId, {
          enabled: false // 자동 차단
        });
      }
    }
  }
}, 60000); // 1분마다 체크
```

---

## 보안 체크리스트

### 배포 전 필수 확인

- [ ] TLS 1.3 인증서 설치 및 검증
- [ ] API Key 해싱 알고리즘 bcrypt cost=12 이상
- [ ] Rate Limiting 활성화 (IP + API Key)
- [ ] Supabase RLS 정책 적용
- [ ] Redis TLS 연결 설정
- [ ] 환경 변수 암호화 (Vault/Secrets Manager)
- [ ] CORS 정책 설정 (허용 도메인만)
- [ ] CSP 헤더 설정
- [ ] 로그에서 민감 데이터 제거 확인
- [ ] Payment Signature 검증 로직 테스트
- [ ] Nonce 중복 체크 동작 확인
- [ ] Circuit Breaker 테스트
- [ ] DDoS 보호 설정 (Cloudflare)
- [ ] Backup 자동화 (PostgreSQL daily)
- [ ] 감사 로그 외부 저장 설정

### 정기 보안 점검 (월 1회)

- [ ] API Key 만료 및 미사용 키 정리
- [ ] 취약점 스캔 (npm audit, Snyk)
- [ ] 의존성 업데이트
- [ ] 액세스 로그 분석 (이상 패턴 탐지)
- [ ] Policy 변경 이력 검토
- [ ] Rate Limit 임계값 조정
- [ ] 보안 패치 적용

### 사고 대응 절차

1. **API Key 유출 의심 시**:

   ```bash
   pag0 keys revoke --key pag0_xxx...
   pag0 keys rotate --project affected-project --immediate
   # 영향받은 사용자에게 이메일 발송
   ```

2. **서버 침해 의심 시**:
   - 즉시 서버 격리 (네트워크 차단)
   - Database 읽기 전용 모드 전환
   - 감사 로그 백업 및 분석
   - 포렌식 팀 투입 (또는 Cloudflare 로그 분석)
   - 영향 범위 파악 후 공지

3. **DDoS 공격 시**:
   - Cloudflare Rate Limiting 강화
   - 임시 IP 블랙리스트 적용
   - Redis/PostgreSQL 연결 제한 축소
   - 상태 페이지에 공지

---

**결론**: Pag0의 핵심 보안 강점은 **"Proxy는 자금을 통제할 수 없다"**는 설계에 있습니다. Agent가 직접 서명한 Payment만 전달하므로, 최악의 침해 시나리오에서도 사용자 자금은 안전합니다. 추가적인 다층 방어로 서비스 가용성과 데이터 무결성을 보호합니다.
