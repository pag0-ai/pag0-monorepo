# Pag0 Security Design Document

> **TL;DR**: Pag0's core security strength is the design principle "Proxy cannot control funds". With Zero Trust + 6-layer defense-in-depth architecture, only Agent-signed Payments are relayed, ensuring user funds remain safe even in worst-case breach scenarios.

## Related Documents

| Document | Relevance |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | System architecture and component design |
| [04-API-SPEC.md](04-API-SPEC.md) | API endpoint authentication/authorization details |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | DB security schema and RLS policies |
| [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md) | Security deployment checklist |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Core terms and abbreviations |

---

## 1. Security Principles

### 1.1 Zero Trust Architecture

- **All requests validated**: API Key, Policy, Payment Signature validation required
- **Network boundary untrusted**: Same security level applied without internal/external distinction
- **Minimal trust scope**: Each component holds only the minimum required privileges

### 1.2 Defense in Depth

```yaml
# Security layer structure
security_layers:
  - layer: 1
    name: "Network"
    controls: ["TLS 1.3", "Rate Limiting"]
  - layer: 2
    name: "Authentication"
    controls: ["API Key (bcrypt)", "JWT"]
  - layer: 3
    name: "Authorization"
    controls: ["Policy Engine", "RBAC"]
  - layer: 4
    name: "Application"
    controls: ["Input Validation", "Sanitization"]
  - layer: 5
    name: "Data"
    controls: ["AES-256 Encryption", "PII Hashing"]
  - layer: 6
    name: "Audit"
    controls: ["Immutable Logs", "Anomaly Detection"]
```

```
Layer 1: Network (TLS 1.3, Rate Limiting)
Layer 2: Authentication (API Key, JWT)
Layer 3: Authorization (Policy Engine, RBAC)
Layer 4: Application (Input Validation, Sanitization)
Layer 5: Data (Encryption at Rest, PII Hashing)
Layer 6: Audit (Immutable Logs, Anomaly Detection)
```

### 1.3 Least Privilege Principle

- API Key can only access specific projects
- Policy can only be modified by owner
- Database access is separated into read/write
- Redis is for cache/metrics only (sensitive data excluded)

### 1.4 **Core Security Design: Proxy has no payment signing authority**

```
┌─────────────────────────────────────────────────┐
│ Why is it secure?                                │
├─────────────────────────────────────────────────┤
│ 1. Proxy does not hold Agent's Private Key      │
│ 2. Payment Payload is signed by Agent first     │
│ 3. Proxy only performs relay of signed Payload  │
│ 4. Even if Proxy is breached, fund theft is     │
│    impossible                                    │
└─────────────────────────────────────────────────┘
```

**Security structure of payment flow**:

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
  │ ├──► Sign Payment ─────────┤                       │
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

**Security guarantees**:

- Proxy can **only read** Payment Payload (cannot sign)
- Even if Proxy is compromised, **only signed payments are relayed** so funds are safe
- Policy Check is performed **only before payment** (cannot modify after payment)

---

## 2. Authentication

### 2.1 API Key Management

**Issuance format**:

```
pag0_[environment]_[random_32_bytes_hex]

Examples:
- pag0_dev_a1b2c3d4e5f6...
- pag0_prod_f6e5d4c3b2a1...
```

**Storage method**:

```typescript
// API Key is hashed with bcrypt for storage
import bcrypt from 'bcrypt';

async function createAPIKey(userId: string, projectId: string) {
  const rawKey = `pag0_${env}_${crypto.randomBytes(32).toString('hex')}`;
  const hashedKey = await bcrypt.hash(rawKey, 12); // cost factor 12

  await db.insert('api_keys', {
    user_id: userId,
    project_id: projectId,
    key_hash: hashedKey,
    key_prefix: rawKey.slice(0, 12), // for search
    created_at: new Date(),
    last_used_at: null,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  });

  // Original key is shown to user only once (cannot be reissued)
  return rawKey;
}
```

**Validation process**:

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

### 2.2 API Key Rotation Policy

| Scenario | Action | Automation |
|---------|------|--------|
| Regular rotation | Alert every 365 days | Dashboard notification |
| Suspected leak | Immediate revocation + reissuance | Manual |
| Unused keys | Auto-expire after 90 days of non-use | Cron Job |
| Key compromise | Reissue all project keys | CLI command |

**Rotation command**:

```bash
pag0 keys rotate --project my-agent --grace-period 7d
# → Issue new key, existing key expires after 7 days
```

### 2.3 JWT Token (Dashboard only)

**Purpose**: Web Dashboard session management

**Issuance**:

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

**Validation**:

- All Dashboard API requests require Bearer Token
- Refresh Token is stored as httpOnly Cookie (XSS defense)
- Access Token is in localStorage (7 day TTL)

### 2.4 Rate Limiting

**Limits by tier**:

```typescript
const rateLimits = {
  byIP: {
    windowMs: 60 * 1000,      // 1 minute
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

**Implementation** (Redis + Token Bucket):

```typescript
async function checkRateLimit(apiKey: string): Promise<boolean> {
  const key = `ratelimit:${apiKey}`;
  const now = Date.now();

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute TTL
  }

  const limit = await getUserLimit(apiKey);
  return count <= limit.max;
}
```

---

## 3. Authorization

### 3.1 Policy Ownership Verification

**Data model**:

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

**Verification logic**:

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

### 3.2 Project-level Isolation (Multi-Tenant)

**Isolation guarantee**:

- All queries must include `project_id` filter
- Row-Level Security (RLS) enabled (Supabase)
- API Key is bound to single project only

**Supabase RLS policies**:

```sql
-- policies table RLS
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

### 3.3 RBAC Design

**Role definition**:

```typescript
enum Role {
  ADMIN = 'admin',     // All permissions
  MEMBER = 'member',   // Read + Write (excluding delete)
  VIEWER = 'viewer'    // Read only
}

const permissions = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  member: ['read', 'write'],
  viewer: ['read']
};
```

**Project member management**:

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

## 4. Data Protection

### 4.1 Transport Encryption

**TLS 1.3 Required**:

```javascript
// Hono server configuration
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

**HSTS Header**:

```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
});
```

### 4.2 At-rest Encryption

**PostgreSQL at-rest encryption**:

- Supabase has AES-256 encryption enabled by default
- Additional column-level encryption (sensitive data):

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

### 4.3 PII Handling

**Request body stores only hash** (original not stored):

```typescript
import { createHash } from 'crypto';

async function logRequest(req: Request) {
  const body = await req.text();
  const bodyHash = createHash('sha256').update(body).digest('hex');

  await db.insert('request_logs', {
    timestamp: new Date(),
    endpoint: req.url,
    method: req.method,
    body_hash: bodyHash,        // Original body not stored
    response_status: null,
    cost: null
  });
}
```

**PII field masking**:

```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// When logging
console.log(`User ${maskEmail(user.email)} requested analytics`);
```

### 4.4 Cache Protection

**Redis TLS connection**:

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

**Cache key expiration (automatic deletion)**:

```typescript
async function cacheResponse(key: string, value: any, ttl: number) {
  await redis.setex(
    key,
    ttl,                    // Expiration time (seconds)
    JSON.stringify(value)
  );
}

// Sensitive data with short TTL
await cacheResponse('user:session', sessionData, 300); // 5 minutes
```

---

## 5. x402 Payment Protection

### 5.1 Payment Payload Integrity Verification

**Signature verification process**:

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

**Reject on verification failure**:

```typescript
if (!await verifyPaymentSignature(payment, sig, agent)) {
  return c.json({
    error: 'Invalid payment signature',
    code: 'INVALID_SIGNATURE'
  }, 403);
}
```

### 5.2 Replay Attack Prevention

**Nonce tracking**:

```typescript
const NONCE_TTL = 3600; // 1 hour

async function checkNonce(agentAddress: string, nonce: string): Promise<boolean> {
  const key = `nonce:${agentAddress}:${nonce}`;
  const exists = await redis.exists(key);

  if (exists) {
    return false; // Nonce already used
  }

  await redis.setex(key, NONCE_TTL, '1');
  return true;
}

// Usage example
if (!await checkNonce(agent, payment.nonce)) {
  return c.json({ error: 'Nonce already used (replay attack?)' }, 403);
}
```

**Timestamp validation**:

```typescript
const MAX_TIMESTAMP_DRIFT = 300; // 5 minutes

function validateTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= MAX_TIMESTAMP_DRIFT;
}
```

### 5.3 Facilitator Trust Chain Verification

**Coinbase CDP Facilitator validation**:

```typescript
const TRUSTED_FACILITATORS = [
  'https://facilitator.cdp.coinbase.com',
  'https://facilitator-testnet.cdp.coinbase.com'
];

function validateFacilitator(url: string): boolean {
  return TRUSTED_FACILITATORS.includes(url);
}

// When processing x402 response
const facilitatorUrl = x402Response.headers.get('X-Facilitator-URL');
if (!validateFacilitator(facilitatorUrl)) {
  throw new Error('Untrusted facilitator');
}
```

### 5.4 Proxy Man-in-the-Middle Attack Prevention

**Proxy cannot modify Payment**:

```typescript
async function relayPayment(signedPayment: SignedPayment) {
  // ❌ Wrong example: Proxy changes amount
  // signedPayment.amount = "999999999"; // Rejected due to signature mismatch

  // ✅ Correct example: Relay original as-is
  const response = await fetch(facilitatorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signedPayment.signature
    },
    body: JSON.stringify(signedPayment.payload) // Relay without modification
  });

  return response;
}
```

**Integrity verification logging**:

```typescript
await db.insert('payment_audit', {
  timestamp: new Date(),
  agent_address: agent,
  payload_hash: createHash('sha256').update(JSON.stringify(payment)).digest('hex'),
  signature: sig,
  facilitator_response: response.status,
  modified: false // Proxy is always false
});
```

---

## 6. Threat Modeling

```yaml
# Threat model summary
threats:
  - id: "T1"
    name: "Malicious agent budget bypass"
    severity: "High"
    mitigation: "Agent address-based budget tracking + On-chain contract"
  - id: "T2"
    name: "Cache poisoning"
    severity: "Medium"
    mitigation: "Agent-based cache key isolation + signature verification + TTL limit"
  - id: "T3"
    name: "API Key leak"
    severity: "High"
    mitigation: "GitHub Secret Scanning + log masking + anomaly access detection"
  - id: "T4"
    name: "DDoS attack"
    severity: "High"
    mitigation: "Cloudflare DDoS + Rate Limiting + Circuit Breaker"
  - id: "T5"
    name: "Proxy server compromise"
    severity: "Critical"
    mitigation: "Minimal privilege DB account + fund theft impossible design"
```

### Threat 1: Malicious agent budget bypass attempt

**Scenario**:

- Agent ignores Policy and directly calls x402 server
- Or uses different API Key to circumvent budget limit

**Mitigation strategy**:

1. **Budget tracked by Agent address** (independent of API Key)

   ```typescript
   async function checkBudget(agentAddress: string, amount: bigint) {
     const spent = await redis.get(`budget:${agentAddress}:daily`);
     const policy = await getPolicy(agentAddress);
     return BigInt(spent || 0) + amount <= BigInt(policy.dailyBudget);
   }
   ```

2. **On-chain budget contract** (P2 feature):

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

3. **Provide Policy URL to x402 server** (future standard):
   - x402 server confirms Pag0 Policy before payment
   - Once standardized, bypass becomes impossible

### Threat 2: Cache poisoning attack

**Scenario**:

- Attacker injects malicious response into cache
- Other users receive incorrect data

**Mitigation strategy**:

1. **Cache key includes Agent address**:

   ```typescript
   function getCacheKey(agent: string, url: string, body: string): string {
     const hash = createHash('sha256')
       .update(`${agent}:${url}:${body}`)
       .digest('hex');
     return `cache:${agent}:${hash}`;
   }
   ```

2. **Add signature to cached response** (verifiable):

   ```typescript
   const cacheEntry = {
     data: response,
     signature: await signData(response, PROXY_PRIVATE_KEY),
     timestamp: Date.now()
   };
   ```

3. **TTL limit** (maximum 1 hour):
   - Prevent long-term cache to minimize poisoning damage

### Threat 3: API Key leak

**Scenario**:

- API Key is committed to GitHub
- Or exposed in log files

**Mitigation strategy**:

1. **GitHub Secret Scanning registration**:
   - Auto-detect `pag0_` pattern
   - Immediate revocation + user notification on discovery

2. **Remove API Key from logs**:

   ```typescript
   function sanitizeLogs(log: string): string {
     return log.replace(/pag0_[a-z]+_[a-f0-9]{64}/g, 'pag0_***_REDACTED');
   }
   ```

3. **Leak detection**:
   - Alert on abnormal region/IP access
   - Automatic temporary suspension on sudden request spike

### Threat 4: DDoS attack

**Scenario**:

- Massive requests paralyze Proxy server
- Or Redis/PostgreSQL overload

**Mitigation strategy**:

1. **Cloudflare DDoS Protection**:
   - Auto-block L3/L4/L7 attacks
   - Rate Limiting at edge

2. **Redis connection pool limit**:

   ```typescript
   const redis = new Redis({
     maxRetriesPerRequest: 3,
     connectTimeout: 5000,
     lazyConnect: true
   });
   ```

3. **Circuit Breaker pattern**:

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
         setTimeout(() => { this.state = 'half-open'; }, 30000); // Retry after 30 seconds
       }
     }
   }
   ```

### Threat 5: Impact scope when Proxy server is compromised

**Scenario**:

- Attacker takes control of Proxy server
- Gains Database/Redis access privileges

**Mitigation strategy**:

1. **Minimal privilege Database account**:

   ```sql
   -- Proxy server account (read-only)
   CREATE USER pag0_proxy WITH PASSWORD 'xxx';
   GRANT SELECT ON policies, projects TO pag0_proxy;
   GRANT INSERT ON request_logs, analytics TO pag0_proxy;
   -- No UPDATE/DELETE permissions
   ```

2. **Separate sensitive data**:
   - API Key Hash in separate table/DB
   - Proxy only calls validation API (cannot directly read Hash)

3. **Breach detection system**:
   - Detect abnormal query patterns
   - Alert on Database changes
   - External log backup (Immutable)

4. **Core: Fund theft is impossible**:
   - Proxy does not hold Private Key
   - Only relays signed Payments, so amount tampering is impossible
   - Worst case scenario: Service disruption (no fund loss)

---

## 7. Audit Logs

### 7.1 Policy Change History

**Schema**:

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

**Automatic recording**:

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

### 7.2 Payment Event Immutable Logs

**SKALE Zero Gas blockchain recording**:

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

**Event verification**:

```solidity
// SKALE audit contract
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

### 7.3 Anomaly Detection Alerts (P2 feature)

**Anomaly pattern definition**:

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
        title: 'Cost spike detected',
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

**Real-time monitoring**:

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
          enabled: false // Auto-block
        });
      }
    }
  }
}, 60000); // Check every 1 minute
```

---

## Security Checklist

### Pre-deployment Mandatory Checks

- [ ] TLS 1.3 certificate installation and verification
- [ ] API Key hashing algorithm bcrypt cost=12 or higher
- [ ] Rate Limiting enabled (IP + API Key)
- [ ] Supabase RLS policies applied
- [ ] Redis TLS connection configured
- [ ] Environment variables encrypted (Vault/Secrets Manager)
- [ ] CORS policy configured (allowed domains only)
- [ ] CSP headers configured
- [ ] Sensitive data removal from logs verified
- [ ] Payment Signature verification logic tested
- [ ] Nonce duplicate check functionality verified
- [ ] Circuit Breaker tested
- [ ] DDoS protection configured (Cloudflare)
- [ ] Backup automation (PostgreSQL daily)
- [ ] Audit log external storage configured

### Regular Security Checks (Monthly)

- [ ] API Key expiration and unused key cleanup
- [ ] Vulnerability scan (npm audit, Snyk)
- [ ] Dependency updates
- [ ] Access log analysis (anomaly pattern detection)
- [ ] Policy change history review
- [ ] Rate Limit threshold adjustment
- [ ] Security patch application

### Incident Response Procedures

1. **When API Key leak is suspected**:

   ```bash
   pag0 keys revoke --key pag0_xxx...
   pag0 keys rotate --project affected-project --immediate
   # Send email to affected users
   ```

2. **When server compromise is suspected**:
   - Immediately isolate server (network block)
   - Switch Database to read-only mode
   - Backup and analyze audit logs
   - Deploy forensics team (or analyze Cloudflare logs)
   - Announce after determining impact scope

3. **During DDoS attack**:
   - Strengthen Cloudflare Rate Limiting
   - Apply temporary IP blacklist
   - Reduce Redis/PostgreSQL connection limits
   - Announce on status page

---

**Conclusion**: Pag0's core security strength lies in the design principle **"Proxy cannot control funds"**. Since only Agent-signed Payments are relayed, user funds remain safe even in worst-case breach scenarios. Additional defense-in-depth layers protect service availability and data integrity.
