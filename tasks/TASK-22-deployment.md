# TASK-22: Deployment (Fly.io + Vercel)

| Item | Content |
|------|---------|
| **Package** | `packages/proxy` (Fly.io), `packages/dashboard` (Vercel) |
| **Estimated Time** | 2 hours |
| **Dependencies** | [TASK-11](./TASK-11-integration.md) (backend complete), [TASK-12](./TASK-12-dashboard-layout.md) (dashboard complete) |
| **Blocks** | None (final deployment) |
| **Reference Docs** | `docs/CLAUDE-hackathon.md` deployment strategy section |

## ⚠️ Manual Approval Required

> **This task will NOT proceed without explicit user permission.** After sufficient local testing is complete, the user will decide the deployment timing.

## Goal

Deploy Proxy API to **Fly.io** and Dashboard to **Vercel** to set up a live demo environment.

## Deployment Targets

| Component | Project | Platform | URL Pattern |
|-----------|---------|----------|-------------|
| **Proxy API** | `packages/proxy` | Fly.io | `pag0-proxy.fly.dev` |
| **Dashboard** | `packages/dashboard` | Vercel | `pag0-dashboard.vercel.app` |
| **MCP Server** | `packages/mcp` | Local (stdio) | Claude Code integration |
| **PostgreSQL** | - | Supabase | Already provisioned |
| **Redis** | - | Upstash | Already provisioned |

## Implementation Items

### 1. Proxy API → Fly.io

#### 1.1 Create fly.toml

```toml
app = "pag0-proxy"
primary_region = "nrt"

[build]
  builder = "heroku/buildpacks:22"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

#### 1.2 Dockerfile (Bun runtime)

```dockerfile
FROM oven/bun:1 as builder
WORKDIR /app
COPY . .
RUN bun install && bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

#### 1.3 Environment Variables Setup

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGINS="https://pag0-dashboard.vercel.app" \
  NODE_ENV="production" \
  --app pag0-proxy
```

#### 1.4 Deploy and Verify

```bash
fly launch --name pag0-proxy --region nrt --no-deploy
fly deploy --app pag0-proxy
curl https://pag0-proxy.fly.dev/health
```

### 2. Dashboard → Vercel

#### 2.1 Vercel Configuration

```bash
cd packages/dashboard
npx vercel link
npx vercel env add NEXT_PUBLIC_API_URL  # → https://pag0-proxy.fly.dev
npx vercel env add NEXT_PUBLIC_APP_NAME # → Pag0
```

#### 2.2 Deploy

```bash
npx vercel --prod
```

#### 2.3 CORS Connection Verification

- Must add Vercel Dashboard URL to Proxy's `CORS_ORIGINS`
- Verify Dashboard → Proxy API calls work correctly

### 3. Connection Architecture

```
Dashboard (Vercel)  ──HTTPS──>  Proxy API (Fly.io)  ──TCP──>  Redis (Upstash)
                                                     ──TCP──>  PostgreSQL (Supabase)
                                                     ──HTTPS─> x402 Facilitator
```

## Deployment Timeline

| Timing | Action |
|--------|--------|
| Day 1 PM | First Proxy API deployment (Fly.io) — verify `/health` + `/proxy` work |
| Day 2 Evening | Proxy API update — all API endpoints working |
| Day 3 AM | First Dashboard deployment (Vercel) — verify API integration |
| Day 3 PM | Final deployment — demo data seeding + live demo |

## Fallback Strategy

| Risk | Fallback |
|------|----------|
| Fly.io deployment fails | Demo on `localhost:3000` + screen recording |
| Vercel deployment fails | Demo on `localhost:3001` with Next.js dev server |
| Both fail | Pitch with test script results + architecture diagram |

## Completion Criteria

- [ ] `fly.toml` created and configured
- [ ] Dockerfile written (Bun runtime)
- [ ] Fly.io environment variables configured
- [ ] Proxy API deployed + `/health` response verified
- [ ] Vercel project setup + environment variables
- [ ] Dashboard deployed + API integration verified
- [ ] CORS configuration validated (Dashboard → Proxy)
- [ ] Demo scenarios verified in live environment
