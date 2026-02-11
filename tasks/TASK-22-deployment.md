# TASK-22: Deployment (Fly.io + Vercel)

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` (Fly.io), `packages/dashboard` (Vercel) |
| **예상 시간** | 2시간 |
| **의존성** | [TASK-11](./TASK-11-integration.md) (백엔드 완성), [TASK-12](./TASK-12-dashboard-layout.md) (대시보드 완성) |
| **차단 대상** | 없음 (최종 배포) |
| **참조 문서** | `docs/CLAUDE-hackathon.md` 배포 전략 섹션 |

## ⚠️ 수동 승인 필요

> **이 태스크는 사용자의 명시적 허락 없이 진행하지 않는다.** 로컬 테스트가 충분히 완료된 후 사용자가 직접 배포 시점을 결정한다.

## 목표

Proxy API를 **Fly.io**에, Dashboard를 **Vercel**에 배포하여 라이브 데모 환경을 구성한다.

## 배포 대상

| 컴포넌트 | 프로젝트 | 플랫폼 | URL 패턴 |
|----------|----------|--------|----------|
| **Proxy API** | `packages/proxy` | Fly.io | `pag0-proxy.fly.dev` |
| **Dashboard** | `packages/dashboard` | Vercel | `pag0-dashboard.vercel.app` |
| **MCP Server** | `packages/mcp` | 로컬 (stdio) | Claude Code 연동 |
| **PostgreSQL** | - | Supabase | 이미 프로비저닝됨 |
| **Redis** | - | Upstash | 이미 프로비저닝됨 |

## 구현 항목

### 1. Proxy API → Fly.io

#### 1.1 fly.toml 생성

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

#### 1.2 Dockerfile (Bun 런타임)

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

#### 1.3 환경변수 설정

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGINS="https://pag0-dashboard.vercel.app" \
  NODE_ENV="production" \
  --app pag0-proxy
```

#### 1.4 배포 및 확인

```bash
fly launch --name pag0-proxy --region nrt --no-deploy
fly deploy --app pag0-proxy
curl https://pag0-proxy.fly.dev/health
```

### 2. Dashboard → Vercel

#### 2.1 Vercel 설정

```bash
cd packages/dashboard
npx vercel link
npx vercel env add NEXT_PUBLIC_API_URL  # → https://pag0-proxy.fly.dev
npx vercel env add NEXT_PUBLIC_APP_NAME # → Pag0
```

#### 2.2 배포

```bash
npx vercel --prod
```

#### 2.3 CORS 연결 확인

- Proxy의 `CORS_ORIGINS`에 Vercel Dashboard URL 추가 필수
- Dashboard → Proxy API 호출 정상 동작 확인

### 3. 연결 아키텍처

```
Dashboard (Vercel)  ──HTTPS──>  Proxy API (Fly.io)  ──TCP──>  Redis (Upstash)
                                                     ──TCP──>  PostgreSQL (Supabase)
                                                     ──HTTPS─> x402 Facilitator
```

## 배포 타이밍

| 시점 | 액션 |
|------|------|
| Day 1 오후 | Proxy API 첫 배포 (Fly.io) — `/health` + `/proxy` 동작 확인 |
| Day 2 저녁 | Proxy API 업데이트 — 전체 API 엔드포인트 동작 |
| Day 3 오전 | Dashboard 첫 배포 (Vercel) — API 연동 확인 |
| Day 3 오후 | 최종 배포 — 데모 데이터 시딩 + 라이브 데모 |

## 폴백 전략

| 리스크 | 폴백 |
|--------|------|
| Fly.io 배포 실패 | `localhost:3000`에서 데모 + 화면 녹화 |
| Vercel 배포 실패 | `localhost:3001`에서 Next.js dev 서버로 데모 |
| 둘 다 실패 | 테스트 스크립트 실행 결과 + 아키텍처 다이어그램으로 피치 |

## 완료 기준

- [ ] `fly.toml` 생성 및 구성
- [ ] Dockerfile 작성 (Bun 런타임)
- [ ] Fly.io 환경변수 설정 완료
- [ ] Proxy API 배포 + `/health` 응답 확인
- [ ] Vercel 프로젝트 설정 + 환경변수
- [ ] Dashboard 배포 + API 연동 확인
- [ ] CORS 설정 검증 (Dashboard → Proxy)
- [ ] 데모 시나리오 라이브 환경 동작 확인
