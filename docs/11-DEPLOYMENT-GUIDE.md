# Pag0 배포 가이드

> **TL;DR**: Pag0는 Fly.io 또는 Cloudflare Workers로 배포하며, Upstash Redis(캐시) + Supabase PostgreSQL(정책/메트릭) + SKALE(감사 로그)로 구성됩니다. 로컬 Docker Compose부터 프로덕션 CI/CD까지 단계별로 안내합니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처 및 컴포넌트 상세 |
| [06-DEV-TASKS.md](06-DEV-TASKS.md) | Day별 구현 체크리스트 |
| [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) | 보안 설정 및 체크리스트 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 핵심 용어 및 약어 정리 |

---

## 1. 환경 구성

### 1.1 환경별 인프라

| 환경 | 목적 | 인프라 | 네트워크 |
|------|------|--------|----------|
| **Development** | 로컬 개발 | Docker Compose | Base Sepolia |
| **Staging** | 통합 테스트 | Fly.io + Upstash + Supabase | Base Sepolia |
| **Production** | 프로덕션 | Cloudflare Workers / Fly.io | Base Mainnet |

### 1.2 아키텍처 다이어그램

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

## 2. 사전 요구사항

### 2.1 개발 도구 설치

```bash
# Bun 설치 (권장)
curl -fsSL https://bun.sh/install | bash

# 또는 Node.js 20+
nvm install 20
nvm use 20

# Docker Desktop 설치
# https://www.docker.com/products/docker-desktop/

# Git
git --version  # 2.x 이상
```

### 2.2 필수 계정 생성

| 서비스 | 용도 | 가입 링크 | 무료 티어 |
|--------|------|-----------|-----------|
| **Upstash** | Redis (Cache) | <https://upstash.com> | 10,000 requests/day |
| **Supabase** | PostgreSQL | <https://supabase.com> | 500 MB, 2 projects |
| **Fly.io** | Hosting | <https://fly.io> | $5 credit |
| **Cloudflare** | Workers (optional) | <https://cloudflare.com> | 100,000 req/day |
| **Coinbase CDP** | x402 Facilitator | <https://portal.cdp.coinbase.com> | Testnet free |

### 2.3 CLI 도구 설치

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

## 3. 환경 변수

### 3.1 환경 변수 템플릿

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

### 3.2 환경 변수 생성 스크립트

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

## 4. 로컬 개발 환경 설정

### 4.1 단계별 설정

**Step 1: 저장소 클론**

```bash
git clone https://github.com/yourusername/pag0.git
cd pag0
```

**Step 2: 의존성 설치**

```bash
bun install
# or
npm install
```

**Step 3: Docker Compose 실행** (로컬 Redis + PostgreSQL)

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

**Step 4: 환경 변수 설정**

```bash
chmod +x scripts/generate-env.sh
./scripts/generate-env.sh

# 로컬 개발용 값으로 수정
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pag0_dev
export REDIS_URL=redis://localhost:6379
```

**Step 5: Database Migration**

```bash
# Prisma 사용 시
bunx prisma migrate dev --name init

# 또는 SQL 직접 실행
psql $DATABASE_URL < migrations/001_initial_schema.sql
```

**Step 6: 개발 서버 실행**

```bash
bun run dev
# or
npm run dev

# 서버 시작: http://localhost:3000
```

**Step 7: Health Check**

```bash
curl http://localhost:3000/health

# 응답:
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

### 4.2 x402 테스트넷 설정

**Step 1: Base Sepolia Testnet ETH 받기**

```bash
# Coinbase Wallet 또는 MetaMask에서 Base Sepolia 네트워크 추가
# Faucet: https://portal.cdp.coinbase.com/products/faucet

# 주소 확인
cast wallet address --private-key $SKALE_PRIVATE_KEY
```

**Step 2: USDC Testnet 토큰 받기**

```bash
# Coinbase Faucet에서 USDC 요청
# 또는 Uniswap Testnet에서 스왑

# 잔액 확인
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)(uint256)" \
  YOUR_ADDRESS \
  --rpc-url https://sepolia.base.org
```

**Step 3: 테스트 요청**

```bash
# SDK 사용
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

## 5. 배포 절차

### 5.1 Fly.io 배포 설정

**Step 1: Fly.io 초기화**

```bash
fly auth login
fly launch --name pag0-staging --region nrt --no-deploy

# fly.toml 생성됨
```

**Step 2: fly.toml 설정**

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

**Step 3: 환경 변수 설정**

```bash
# Secrets 설정 (암호화 저장)
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="https://..." \
  REDIS_TOKEN="..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  SKALE_PRIVATE_KEY="0x..." \
  --app pag0-staging

# 일반 환경 변수
fly config env set \
  X402_FACILITATOR_URL=https://facilitator-testnet.cdp.coinbase.com \
  X402_NETWORK=base-sepolia \
  --app pag0-staging
```

**Step 4: 배포**

```bash
fly deploy --app pag0-staging

# 로그 확인
fly logs --app pag0-staging

# 상태 확인
fly status --app pag0-staging
```

**Step 5: 도메인 연결** (optional)

```bash
# Custom domain 추가
fly certs add staging.pag0.io --app pag0-staging

# DNS 레코드 추가
# A record: staging.pag0.io → [FLY_IP]
# AAAA record: staging.pag0.io → [FLY_IPv6]
```

### 5.2 Cloudflare Workers 배포 설정

**Step 1: Wrangler 초기화**

```bash
wrangler init pag0-worker
cd pag0-worker
```

**Step 2: wrangler.toml 설정**

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

**Step 3: Hono 앱을 Workers 형식으로 변환**

```typescript
// src/index.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/proxy', async (c) => {
  // Proxy 로직
  const cache = c.env.CACHE; // KV Namespace
  const db = c.env.DB;       // D1 Database

  // ...
});

export default app;
```

**Step 4: 배포**

```bash
# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production

# 로그 확인
wrangler tail --env production
```

### 5.3 Supabase 마이그레이션

**Step 1: Supabase 프로젝트 생성**

```bash
# Dashboard에서 프로젝트 생성 또는 CLI 사용
supabase projects create pag0-staging --org-id YOUR_ORG_ID

# 로컬에서 연결
supabase link --project-ref YOUR_PROJECT_REF
```

**Step 2: Migration 파일 생성**

```bash
# 로컬 마이그레이션 생성
supabase migration new initial_schema

# migrations/TIMESTAMP_initial_schema.sql 편집
```

**Step 3: Migration 실행**

```bash
# 로컬에서 테스트
supabase db reset

# Staging에 배포
supabase db push --project-ref YOUR_PROJECT_REF

# Production에 배포
supabase db push --project-ref PROD_PROJECT_REF --confirm
```

**Step 4: RLS (Row Level Security) 활성화**

```sql
-- Supabase Dashboard > SQL Editor에서 실행
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own policies"
  ON policies FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

-- 추가 정책들...
```

### 5.4 Upstash Redis 프로비저닝

**Step 1: Upstash Console에서 Database 생성**

- Region: 애플리케이션과 가까운 지역 선택 (예: Tokyo)
- Type: Redis (Global or Regional)
- TLS: 활성화

**Step 2: 연결 정보 복사**

```bash
# Dashboard에서 복사
REDIS_URL=https://us1-xxxxx.upstash.io
REDIS_TOKEN=AxxxxxxxxxxxxxxxxxxxQ==

# Fly.io에 설정
fly secrets set \
  REDIS_URL=$REDIS_URL \
  REDIS_TOKEN=$REDIS_TOKEN \
  --app pag0-staging
```

**Step 3: 연결 테스트**

```bash
# Upstash REST API 테스트
curl -H "Authorization: Bearer $REDIS_TOKEN" \
  "$REDIS_URL/SET/test/hello"

curl -H "Authorization: Bearer $REDIS_TOKEN" \
  "$REDIS_URL/GET/test"

# 응답: {"result":"hello"}
```

---

## 6. CI/CD

### 6.1 GitHub Actions 워크플로우

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

### 6.2 브랜치 전략

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

**워크플로우**:

1. `feature/new-feature` 브랜치 생성
2. 개발 완료 후 `staging`으로 PR
3. Staging 배포 및 테스트
4. 테스트 통과 후 `main`으로 PR
5. Production 배포 (자동)

### 6.3 자동 배포 트리거

| Trigger | Action | Environment |
|---------|--------|-------------|
| Push to `staging` | Auto-deploy | Staging |
| Push to `main` | Auto-deploy (with approval) | Production |
| PR to `main` | Preview deployment | Temporary |
| Tag `v*` | Release build | Production |

---

## 7. 모니터링

### 7.1 상태 확인 엔드포인트

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

### 7.2 메트릭 엔드포인트

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

### 7.3 로깅 (Axiom/Logtail)

**Axiom 연동**:

```typescript
import { Axiom } from '@axiomhq/js';

const axiom = new Axiom({
  token: process.env.AXIOM_API_TOKEN!,
  dataset: process.env.AXIOM_DATASET!
});

// 요청 로깅
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

// 에러 로깅
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

### 7.4 알림 (Discord/Slack)

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

// 사용 예시
if (errorRate > 0.05) {
  await sendAlert(`Error rate spike: ${(errorRate * 100).toFixed(2)}%`, 'error');
}
```

---

## 8. 장애 대응

### 8.1 Proxy 다운 시

**Agent SDK Fallback**:

```typescript
// SDK에 내장된 fallback 로직
const pag0 = createPag0Client({
  apiKey: 'pag0_xxx',
  fallbackMode: 'direct', // Proxy 실패 시 직접 x402 호출
  retries: 3
});

// Proxy 다운 감지 시 자동으로 직접 호출
const response = await pag0.fetch(url);
```

**수동 복구**:

```bash
# Health check 실패 시
fly status --app pag0-prod

# 로그 확인
fly logs --app pag0-prod | grep ERROR

# 긴급 재시작
fly apps restart pag0-prod

# 스케일 업 (트래픽 급증 시)
fly scale count 3 --app pag0-prod
```

### 8.2 Redis 다운 시

**캐시 바이패스 모드**:

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
    setTimeout(() => { redisAvailable = true; }, 60000); // 1분 후 재시도
    return await fetcher();
  }
}
```

### 8.3 PostgreSQL 다운 시

**Policy 캐시 Fallback**:

```typescript
const policyCache = new Map<string, Policy>();

async function getPolicy(projectId: string): Promise<Policy> {
  // 먼저 메모리 캐시 확인
  if (policyCache.has(projectId)) {
    return policyCache.get(projectId)!;
  }

  try {
    const policy = await db.query('SELECT * FROM policies WHERE project_id = ?', [projectId]);
    policyCache.set(projectId, policy);
    return policy;
  } catch (err) {
    console.error('Database error:', err);

    // Redis에서 백업 시도
    const cached = await redis.get(`policy:${projectId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 기본 정책 반환
    return {
      maxPerRequest: '1000000',
      dailyBudget: '10000000',
      allowedEndpoints: ['*']
    };
  }
}
```

### 8.4 롤백 절차

**Fly.io Rollback**:

```bash
# 이전 버전으로 롤백
fly releases --app pag0-prod

# 특정 버전으로 롤백
fly deploy --image registry.fly.io/pag0-prod:v42 --app pag0-prod

# 즉시 롤백 (최신 stable 버전)
fly releases rollback --app pag0-prod
```

**Database Migration Rollback**:

```bash
# Supabase migration 되돌리기
supabase db reset --version PREVIOUS_VERSION

# 또는 수동 SQL 실행
psql $DATABASE_URL < migrations/rollback/002_rollback_new_feature.sql
```

**Cloudflare Workers Rollback**:

```bash
# 이전 배포로 롤백
wrangler rollback --env production

# 특정 버전으로
wrangler rollback --message "Rollback to v1.2.3" --env production
```

---

## 9. 프로덕션 체크리스트

### 배포 전 확인 항목

- [ ] 모든 환경 변수 설정 완료
- [ ] Database migration 실행 및 검증
- [ ] TLS 인증서 설정 (Fly.io/Cloudflare)
- [ ] Rate limiting 활성화
- [ ] CORS 정책 설정 (허용 도메인만)
- [ ] Health check endpoint 동작 확인
- [ ] Metrics endpoint 보안 (인증 필요)
- [ ] 로깅 외부 저장 설정 (Axiom)
- [ ] 알림 webhook 테스트
- [ ] Backup 자동화 (PostgreSQL daily)
- [ ] DNS 레코드 설정 (A/AAAA)
- [ ] CDN 캐싱 정책 (Cloudflare)
- [ ] 부하 테스트 (1000 req/s)

### 배포 후 검증

```bash
# Health check
curl https://api.pag0.io/health

# Proxy 요청 테스트
curl -X POST https://api.pag0.io/proxy \
  -H "X-API-Key: pag0_prod_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/test",
    "method": "GET"
  }'

# Analytics 확인
curl https://api.pag0.io/api/analytics/summary \
  -H "Authorization: Bearer $JWT_TOKEN"

# 부하 테스트 (wrk)
wrk -t12 -c400 -d30s https://api.pag0.io/health
```

---

## 10. 비용 추정 (월간)

| 서비스 | Free Tier | Paid (Staging) | Paid (Production) |
|--------|-----------|----------------|-------------------|
| Fly.io | $0 (Sleep) | $5-10 | $20-50 |
| Upstash Redis | $0 (10K req) | $10-20 | $50-100 |
| Supabase | $0 (500MB) | $25 | $25-100 |
| Cloudflare Workers | $0 (100K req) | $5 | $20-50 |
| SKALE | $0 (Zero Gas) | $0 | $0 |
| Axiom Logs | $0 (500MB) | $0-10 | $20-50 |
| **Total** | **$0** | **$45-65** | **$135-350** |

---

**다음 단계**: 배포 완료 후 [12-SDK-GUIDE.md](12-SDK-GUIDE.md)를 참고하여 SDK 통합 및 사용자 온보딩을 진행하세요.
