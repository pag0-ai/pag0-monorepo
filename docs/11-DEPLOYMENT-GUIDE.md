# Pag0 Deployment Guide

> **TL;DR**: Pag0 is deployed to Fly.io or Cloudflare Workers, configured with Upstash Redis (cache) + Supabase PostgreSQL (policy/metrics) + SKALE (audit logs). Step-by-step guidance from local Docker Compose to production CI/CD.

## Related Documentation

| Document | Relevance |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | Architecture and component details |
| [06-DEV-TASKS.md](06-DEV-TASKS.md) | Day-by-day implementation checklist |
| [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) | Security configuration and checklist |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Core terms and abbreviations |

---

## 1. Environment Configuration

### 1.1 Infrastructure by Environment

| Environment | Purpose | Infrastructure | Network |
|------|------|--------|----------|
| **Development** | Local development | Docker Compose | Base Sepolia |
| **Staging** | Integration testing | Fly.io + Upstash + Supabase | Base Sepolia |
| **Production** | Production | Cloudflare Workers / Fly.io | Base Mainnet |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐         ┌──────────────┐                      │
│  │  Agent   │────────>│  Cloudflare  │                      │
│  │  (SDK)   │         │   Workers    │                      │
│  └──────────┘         │  (Proxy API) │                      │
│                       └───────┬──────┘                       │
│                               │                              │
│                    ┌──────────┼──────────┐                  │
│                    │          │          │                  │
│              ┌─────▼────┐ ┌──▼────┐ ┌──▼──────┐            │
│              │ Upstash  │ │Supabase│ │ SKALE  │            │
│              │  Redis   │ │Postgres│ │ Chain  │            │
│              │ (Cache)  │ │(Policy)│ │ (Audit)│            │
│              └──────────┘ └────────┘ └─────────┘            │
│                                                               │
│              ┌──────────────────────────────┐                │
│              │  Coinbase CDP Facilitator    │                │
│              │  (x402 Payment Processing)   │                │
│              └──────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### 2.1 Development Tools Installation

```bash
# Install Bun (recommended)
curl -fsSL https://bun.sh/install | bash

# Or Node.js 20+
nvm install 20
nvm use 20

# Install Docker Desktop
# https://www.docker.com/products/docker-desktop/

# Git
git --version  # 2.x or higher
```

### 2.2 Required Account Creation

| Service | Purpose | Signup Link | Free Tier |
|--------|------|-----------|-----------|
| **Upstash** | Redis (Cache) | <https://upstash.com> | 10,000 requests/day |
| **Supabase** | PostgreSQL | <https://supabase.com> | 500 MB, 2 projects |
| **Fly.io** | Hosting | <https://fly.io> | $5 credit |
| **Cloudflare** | Workers (optional) | <https://cloudflare.com> | 100,000 req/day |
| **Coinbase CDP** | x402 Facilitator | <https://portal.cdp.coinbase.com> | Testnet free |

### 2.3 CLI Tools Installation

```bash
# Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Cloudflare Wrangler (optional)
npm install -g wrangler

# Supabase CLI
brew install supabase/tap/supabase
# or
npm install -g supabase
```

---

## 3. Environment Variables

### 3.1 Environment Variables Template

`.env.example`:

```env
# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# ============================================
# Database (Supabase PostgreSQL)
# ============================================
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?pgbouncer=true

# ============================================
# Redis (Upstash)
# ============================================
REDIS_URL=https://[ENDPOINT].upstash.io
REDIS_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==

# ============================================
# x402 Configuration
# ============================================
X402_FACILITATOR_URL=https://facilitator-testnet.cdp.coinbase.com
X402_NETWORK=base-sepolia
X402_CHAIN_ID=84532

# Production:
# X402_FACILITATOR_URL=https://facilitator.cdp.coinbase.com
# X402_NETWORK=base
# X402_CHAIN_ID=8453

# ============================================
# SKALE Configuration (Zero Gas Audit Logs)
# ============================================
SKALE_RPC_URL=https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox
ERC8004_SIGNER_KEY=0x[64_HEX_CHARS]
ERC8004_REPUTATION_REGISTRY=0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de
ERC8004_VALIDATION_REGISTRY=0x719dBB83664Ad25091CB91b0a39BF52BD7685c0A
ERC8004_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1/gn

# ============================================
# Authentication
# ============================================
JWT_SECRET=[RANDOM_256_BIT_HEX]
API_KEY_SALT=[RANDOM_128_BIT_HEX]

# ============================================
# Security
# ============================================
ENCRYPTION_KEY=[RANDOM_256_BIT_HEX]
CORS_ORIGINS=http://localhost:3000,https://pag0.io

# ============================================
# External Services
# ============================================
AXIOM_API_TOKEN=xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AXIOM_DATASET=pag0-logs

# Discord/Slack webhook for alerts
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3.2 Environment Variables Generation Script

```bash
#!/bin/bash
# scripts/generate-env.sh

echo "🔐 Generating secrets..."

JWT_SECRET=$(openssl rand -hex 32)
API_KEY_SALT=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > .env << EOF
# Auto-generated $(date)
PORT=3000
NODE_ENV=development

JWT_SECRET=$JWT_SECRET
API_KEY_SALT=$API_KEY_SALT
ENCRYPTION_KEY=$ENCRYPTION_KEY

# TODO: Fill in these values from service dashboards
DATABASE_URL=postgresql://postgres:PASSWORD@PROJECT.supabase.co:5432/postgres
REDIS_URL=https://ENDPOINT.upstash.io
REDIS_TOKEN=YOUR_TOKEN_HERE

X402_FACILITATOR_URL=https://facilitator-testnet.cdp.coinbase.com
X402_NETWORK=base-sepolia
X402_CHAIN_ID=84532

SKALE_RPC_URL=https://testnet.skalenodes.com/v1/CHAIN_NAME
ERC8004_SIGNER_KEY=0x$(openssl rand -hex 32)
ERC8004_REPUTATION_REGISTRY=0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de
ERC8004_VALIDATION_REGISTRY=0x719dBB83664Ad25091CB91b0a39BF52BD7685c0A
ERC8004_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1/gn

CORS_ORIGINS=http://localhost:3000
EOF

echo "✅ .env file created. Please fill in service credentials."
```

---

## 4. Local Development Environment Setup

### 4.1 Step-by-Step Setup

**Step 1: Clone Repository**

```bash
git clone https://github.com/yourusername/pag0.git
cd pag0
```

**Step 2: Install Dependencies**

```bash
bun install
# or
npm install
```

**Step 3: Run Docker Compose** (local Redis + PostgreSQL)

```bash
docker-compose up -d

# docker-compose.yml:
```

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pag0_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

**Step 4: Configure Environment Variables**

```bash
chmod +x scripts/generate-env.sh
./scripts/generate-env.sh

# Update with local development values
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pag0_dev
export REDIS_URL=redis://localhost:6379
```

**Step 5: Database Migration**

```bash
# Using Prisma
bunx prisma migrate dev --name init

# Or run SQL directly
psql $DATABASE_URL < migrations/001_initial_schema.sql
```

**Step 6: Run Development Server**

```bash
bun run dev
# or
npm run dev

# Server starts at: http://localhost:3000
```

**Step 7: Health Check**

```bash
curl http://localhost:3000/health

# Response:
# {
#   "status": "ok",
#   "version": "0.1.0",
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "services": {
#     "redis": "connected",
#     "postgres": "connected",
#     "x402": "reachable"
#   }
# }
```

### 4.2 x402 Testnet Setup

**Step 1: Get Base Sepolia Testnet ETH**

```bash
# Add Base Sepolia network in Coinbase Wallet or MetaMask
# Faucet: https://portal.cdp.coinbase.com/products/faucet

# Check address
cast wallet address --private-key $SKALE_PRIVATE_KEY
```

**Step 2: Get USDC Testnet Tokens**

```bash
# Request USDC from Coinbase Faucet
# Or swap on Uniswap Testnet

# Check balance
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)(uint256)" \
  YOUR_ADDRESS \
  --rpc-url https://sepolia.base.org
```

**Step 3: Test Request**

```bash
# Using SDK
cat > test-proxy.ts << 'EOF'
import { createPag0Client } from '@pag0/sdk';

const pag0 = createPag0Client({
  apiKey: 'pag0_dev_test123',
  baseURL: 'http://localhost:3000',
  policy: {
    maxPerRequest: '1000000', // 1 USDC
    dailyBudget: '10000000'   // 10 USDC
  }
});

const response = await pag0.fetch('https://api.example.com/test', {
  method: 'GET'
});

console.log('Status:', response.status);
console.log('Cached:', response.meta.cached);
console.log('Cost:', response.meta.cost);
EOF

bun run test-proxy.ts
```

---

## 5. Deployment Procedures

### 5.1 Fly.io Deployment Setup

**Step 1: Initialize Fly.io**

```bash
fly auth login
fly launch --name pag0-staging --region nrt --no-deploy

# fly.toml created
```

**Step 2: Configure fly.toml**

```toml
app = "pag0-staging"
primary_region = "nrt"

[build]
  builder = "heroku/buildpacks:20"
  buildpacks = ["heroku/nodejs"]

[env]
  PORT = "8080"
  NODE_ENV = "staging"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[deploy]
  release_command = "bunx prisma migrate deploy"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

**Step 3: Set Environment Variables**

```bash
# Set secrets (encrypted storage)
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="https://..." \
  REDIS_TOKEN="..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  SKALE_PRIVATE_KEY="0x..." \
  --app pag0-staging

# Set regular environment variables
fly config env set \
  X402_FACILITATOR_URL=https://facilitator-testnet.cdp.coinbase.com \
  X402_NETWORK=base-sepolia \
  --app pag0-staging
```

**Step 4: Deploy**

```bash
fly deploy --app pag0-staging

# Check logs
fly logs --app pag0-staging

# Check status
fly status --app pag0-staging
```

**Step 5: Connect Domain** (optional)

```bash
# Add custom domain
fly certs add staging.pag0.io --app pag0-staging

# Add DNS records
# A record: staging.pag0.io → [FLY_IP]
# AAAA record: staging.pag0.io → [FLY_IPv6]
```

### 5.2 Cloudflare Workers Deployment Setup

**Step 1: Initialize Wrangler**

```bash
wrangler init pag0-worker
cd pag0-worker
```

**Step 2: Configure wrangler.toml**

```toml
name = "pag0-worker"
main = "src/index.ts"
compatibility_date = "2024-01-15"
node_compat = true

[env.production]
name = "pag0-worker"
routes = [
  { pattern = "api.pag0.io/*", zone_name = "pag0.io" }
]

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[env.production.d1_databases]]
binding = "DB"
database_name = "pag0-db"
database_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[env.production.vars]
X402_FACILITATOR_URL = "https://facilitator.cdp.coinbase.com"
X402_NETWORK = "base"

[env.staging]
name = "pag0-worker-staging"
kv_namespaces = [...]
vars = { X402_NETWORK = "base-sepolia" }
```

**Step 3: Convert Hono App to Workers Format**

```typescript
// src/index.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/proxy', async (c) => {
  // Proxy logic
  const cache = c.env.CACHE; // KV Namespace
  const db = c.env.DB;       // D1 Database

  // ...
});

export default app;
```

**Step 4: Deploy**

```bash
# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production

# Check logs
wrangler tail --env production
```

### 5.3 Supabase Migration

**Step 1: Create Supabase Project**

```bash
# Create project in Dashboard or use CLI
supabase projects create pag0-staging --org-id YOUR_ORG_ID

# Link locally
supabase link --project-ref YOUR_PROJECT_REF
```

**Step 2: Create Migration File**

```bash
# Create local migration
supabase migration new initial_schema

# Edit migrations/TIMESTAMP_initial_schema.sql
```

**Step 3: Run Migration**

```bash
# Test locally
supabase db reset

# Deploy to Staging
supabase db push --project-ref YOUR_PROJECT_REF

# Deploy to Production
supabase db push --project-ref PROD_PROJECT_REF --confirm
```

**Step 4: Enable RLS (Row Level Security)**

```sql
-- Run in Supabase Dashboard > SQL Editor
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own policies"
  ON policies FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

-- Additional policies...
```

### 5.4 Upstash Redis Provisioning

**Step 1: Create Database in Upstash Console**

- Region: Select region close to your application (e.g., Tokyo)
- Type: Redis (Global or Regional)
- TLS: Enable

**Step 2: Copy Connection Information**

```bash
# Copy from Dashboard
REDIS_URL=https://us1-xxxxx.upstash.io
REDIS_TOKEN=AxxxxxxxxxxxxxxxxxxxQ==

# Set in Fly.io
fly secrets set \
  REDIS_URL=$REDIS_URL \
  REDIS_TOKEN=$REDIS_TOKEN \
  --app pag0-staging
```

**Step 3: Test Connection**

```bash
# Test Upstash REST API
curl -H "Authorization: Bearer $REDIS_TOKEN" \
  "$REDIS_URL/SET/test/hello"

curl -H "Authorization: Bearer $REDIS_TOKEN" \
  "$REDIS_URL/GET/test"

# Response: {"result":"hello"}
```

---

## 6. CI/CD

### 6.1 GitHub Actions Workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Staging and Production

on:
  push:
    branches:
      - main        # → Production
      - staging     # → Staging

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Lint
        run: bun run lint

      - name: Type check
        run: bun run type-check

      - name: Run tests
        run: bun test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Staging
        run: flyctl deploy --app pag0-staging --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Production
        run: flyctl deploy --app pag0-prod --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

      - name: Health check
        run: |
          sleep 10
          curl -f https://api.pag0.io/health || exit 1

      - name: Notify Discord
        run: |
          curl -X POST ${{ secrets.DISCORD_WEBHOOK }} \
            -H "Content-Type: application/json" \
            -d '{
              "content": "✅ Pag0 Production deployed successfully!",
              "embeds": [{
                "title": "Deployment Details",
                "fields": [
                  {"name": "Commit", "value": "${{ github.sha }}", "inline": true},
                  {"name": "Author", "value": "${{ github.actor }}", "inline": true}
                ]
              }]
            }'
```

### 6.2 Branch Strategy

```
main (Production)
  ↑
  │ PR + Review
  │
staging (Staging)
  ↑
  │ PR
  │
feature/* (Feature branches)
```

**Workflow**:

1. Create `feature/new-feature` branch
2. After development complete, PR to `staging`
3. Deploy to Staging and test
4. After tests pass, PR to `main`
5. Deploy to Production (automatic)

### 6.3 Automated Deployment Triggers

| Trigger | Action | Environment |
|---------|--------|-------------|
| Push to `staging` | Auto-deploy | Staging |
| Push to `main` | Auto-deploy (with approval) | Production |
| PR to `main` | Preview deployment | Temporary |
| Tag `v*` | Release build | Production |

---

## 7. Monitoring

### 7.1 Health Check Endpoint

```typescript
// src/routes/health.ts
app.get('/health', async (c) => {
  const checks = await Promise.allSettled([
    checkRedis(),
    checkPostgres(),
    checkX402Facilitator()
  ]);

  const redis = checks[0].status === 'fulfilled' ? 'ok' : 'error';
  const postgres = checks[1].status === 'fulfilled' ? 'ok' : 'error';
  const x402 = checks[2].status === 'fulfilled' ? 'ok' : 'error';

  const allOk = redis === 'ok' && postgres === 'ok' && x402 === 'ok';

  return c.json({
    status: allOk ? 'ok' : 'degraded',
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
    services: { redis, postgres, x402 }
  }, allOk ? 200 : 503);
});

async function checkRedis() {
  await redis.ping();
}

async function checkPostgres() {
  await db.raw('SELECT 1');
}

async function checkX402Facilitator() {
  const res = await fetch(process.env.X402_FACILITATOR_URL!);
  if (!res.ok) throw new Error('Facilitator unreachable');
}
```

### 7.2 Metrics Endpoint

```typescript
app.get('/metrics', async (c) => {
  const stats = await Promise.all([
    redis.info('stats'),
    db.raw('SELECT COUNT(*) FROM request_logs WHERE timestamp > NOW() - INTERVAL \'1 hour\''),
    redis.get('cache:hit_rate')
  ]);

  return c.text(`
# HELP pag0_requests_total Total requests in last hour
# TYPE pag0_requests_total counter
pag0_requests_total ${stats[1].rows[0].count}

# HELP pag0_cache_hit_rate Cache hit rate (0-1)
# TYPE pag0_cache_hit_rate gauge
pag0_cache_hit_rate ${stats[2] || 0}

# HELP pag0_redis_connected_clients Redis connected clients
# TYPE pag0_redis_connected_clients gauge
pag0_redis_connected_clients ${parseRedisInfo(stats[0], 'connected_clients')}
  `.trim());
});
```

### 7.3 Logging (Axiom/Logtail)

**Axiom Integration**:

```typescript
import { Axiom } from '@axiomhq/js';

const axiom = new Axiom({
  token: process.env.AXIOM_API_TOKEN!,
  dataset: process.env.AXIOM_DATASET!
});

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  await axiom.ingest([{
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    user_agent: c.req.header('user-agent'),
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
  }]);
});

// Error logging
app.onError((err, c) => {
  axiom.ingest([{
    timestamp: new Date().toISOString(),
    level: 'error',
    message: err.message,
    stack: err.stack,
    path: c.req.path
  }]);

  return c.json({ error: 'Internal Server Error' }, 500);
});
```

### 7.4 Alerts (Discord/Slack)

```typescript
async function sendAlert(message: string, severity: 'info' | 'warning' | 'error') {
  const colors = { info: 0x3498db, warning: 0xf39c12, error: 0xe74c3c };

  await fetch(process.env.ALERT_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `Pag0 Alert - ${severity.toUpperCase()}`,
        description: message,
        color: colors[severity],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

// Usage example
if (errorRate > 0.05) {
  await sendAlert(`Error rate spike: ${(errorRate * 100).toFixed(2)}%`, 'error');
}
```

---

## 8. Incident Response

### 8.1 When Proxy is Down

**Agent SDK Fallback**:

```typescript
// Built-in fallback logic in SDK
const pag0 = createPag0Client({
  apiKey: 'pag0_xxx',
  fallbackMode: 'direct', // Direct x402 call if Proxy fails
  retries: 3
});

// Automatically calls directly when Proxy is down
const response = await pag0.fetch(url);
```

**Manual Recovery**:

```bash
# When health check fails
fly status --app pag0-prod

# Check logs
fly logs --app pag0-prod | grep ERROR

# Emergency restart
fly apps restart pag0-prod

# Scale up (traffic spike)
fly scale count 3 --app pag0-prod
```

### 8.2 When Redis is Down

**Cache Bypass Mode**:

```typescript
let redisAvailable = true;

async function cachedFetch(key: string, fetcher: () => Promise<any>) {
  if (!redisAvailable) {
    console.warn('Redis unavailable, bypassing cache');
    return await fetcher();
  }

  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const result = await fetcher();
    await redis.setex(key, 300, JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('Redis error:', err);
    redisAvailable = false;
    setTimeout(() => { redisAvailable = true; }, 60000); // Retry after 1 minute
    return await fetcher();
  }
}
```

### 8.3 When PostgreSQL is Down

**Policy Cache Fallback**:

```typescript
const policyCache = new Map<string, Policy>();

async function getPolicy(projectId: string): Promise<Policy> {
  // Check memory cache first
  if (policyCache.has(projectId)) {
    return policyCache.get(projectId)!;
  }

  try {
    const policy = await db.query('SELECT * FROM policies WHERE project_id = ?', [projectId]);
    policyCache.set(projectId, policy);
    return policy;
  } catch (err) {
    console.error('Database error:', err);

    // Try backup from Redis
    const cached = await redis.get(`policy:${projectId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Return default policy
    return {
      maxPerRequest: '1000000',
      dailyBudget: '10000000',
      allowedEndpoints: ['*']
    };
  }
}
```

### 8.4 Rollback Procedure

**Fly.io Rollback**:

```bash
# Rollback to previous version
fly releases --app pag0-prod

# Rollback to specific version
fly deploy --image registry.fly.io/pag0-prod:v42 --app pag0-prod

# Immediate rollback (latest stable version)
fly releases rollback --app pag0-prod
```

**Database Migration Rollback**:

```bash
# Rollback Supabase migration
supabase db reset --version PREVIOUS_VERSION

# Or run manual SQL
psql $DATABASE_URL < migrations/rollback/002_rollback_new_feature.sql
```

**Cloudflare Workers Rollback**:

```bash
# Rollback to previous deployment
wrangler rollback --env production

# Rollback to specific version
wrangler rollback --message "Rollback to v1.2.3" --env production
```

---

## 9. Production Checklist

### Pre-Deployment Verification

- [ ] All environment variables configured
- [ ] Database migration executed and verified
- [ ] TLS certificates configured (Fly.io/Cloudflare)
- [ ] Rate limiting enabled
- [ ] CORS policy configured (allowed domains only)
- [ ] Health check endpoint working
- [ ] Metrics endpoint secured (authentication required)
- [ ] External logging configured (Axiom)
- [ ] Alert webhook tested
- [ ] Backup automation (PostgreSQL daily)
- [ ] DNS records configured (A/AAAA)
- [ ] CDN caching policy (Cloudflare)
- [ ] Load testing (1000 req/s)

### Post-Deployment Validation

```bash
# Health check
curl https://api.pag0.io/health

# Proxy request test
curl -X POST https://api.pag0.io/proxy \
  -H "X-API-Key: pag0_prod_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/test",
    "method": "GET"
  }'

# Analytics check
curl https://api.pag0.io/api/analytics/summary \
  -H "Authorization: Bearer $JWT_TOKEN"

# Load test (wrk)
wrk -t12 -c400 -d30s https://api.pag0.io/health
```

---

## 10. Cost Estimation (Monthly)

| Service | Free Tier | Paid (Staging) | Paid (Production) |
|--------|-----------|----------------|-------------------|
| Fly.io | $0 (Sleep) | $5-10 | $20-50 |
| Upstash Redis | $0 (10K req) | $10-20 | $50-100 |
| Supabase | $0 (500MB) | $25 | $25-100 |
| Cloudflare Workers | $0 (100K req) | $5 | $20-50 |
| SKALE | $0 (Zero Gas) | $0 | $0 |
| Axiom Logs | $0 (500MB) | $0-10 | $20-50 |
| **Total** | **$0** | **$45-65** | **$135-350** |

---

**Next Steps**: After deployment is complete, refer to [12-SDK-GUIDE.md](12-SDK-GUIDE.md) to proceed with SDK integration and user onboarding.
