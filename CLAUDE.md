# Pag0 Smart Proxy — Hackathon CLAUDE.md

> Pag0 = x402 생태계의 유일한 스마트 프록시 레이어. Spend Firewall + API Curation + Smart Cache를 하나로 제공하는 3-in-1 미들웨어.

## 제품 요약

- **핵심 가치**: AI Agent가 x402 API를 안전하고 효율적으로 사용하도록 정책 기반 예산 관리, 실사용 데이터 기반 API 큐레이션, 지능형 캐싱(40%+ 비용 절감)을 제공
- **기능 우선순위**: Spend Firewall > API Curation > Smart Cache
- **목표**: 3일 해커톤 내 Working MVP 완성 (모든 핵심 기능 동작 + 3개 시나리오 데모 + 배포)

---

## 기술 스택

| 레이어 | 기술 | npm 패키지 |
|--------|------|-----------|
| Runtime | Bun | - |
| Framework | Hono | `hono`, `@hono/node-server` |
| x402 SDK | x402 fetch | `@x402/fetch` |
| Cache | Redis (Upstash) | `ioredis` (TCP, Fly.io용) |
| Database | PostgreSQL (Supabase) | `postgres` (NOT `pg`) |
| Blockchain | SKALE (Zero Gas) | `ethers` |
| Dashboard | Next.js + Tailwind | `recharts`, `@tanstack/react-query`, `lucide-react` |
| Hosting | Fly.io (backend) / Vercel (dashboard) | - |
| MCP Server | MCP SDK + ethers | `@modelcontextprotocol/sdk`, `ethers`, `zod` |
| Dev | TypeScript strict | `@types/node`, `typescript` |

> **주의**: Redis 클라이언트는 `ioredis` (TCP) 사용. Cloudflare Workers 전환 시에만 `@upstash/redis` (REST)로 변경.

---

## 프로젝트 구조

```
pag0-monorepo/
├── packages/
│   ├── proxy/                    # @pag0/proxy — Hono + Bun 백엔드
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point + Hono 라우트 + 미들웨어(auth, rate-limit)
│   │   │   ├── proxy/
│   │   │   │   ├── core.ts       # ProxyCore 클래스 (요청 중계 오케스트레이션)
│   │   │   │   └── x402.ts       # x402 SDK 래퍼 (X402Integration)
│   │   │   ├── policy/
│   │   │   │   ├── engine.ts     # PolicyEngine (예산/whitelist/blacklist 검증)
│   │   │   │   └── budget.ts     # BudgetTracker (일일/월별 지출 추적)
│   │   │   ├── curation/
│   │   │   │   └── engine.ts     # CurationEngine (점수 계산, 추천, 비교)
│   │   │   ├── cache/
│   │   │   │   ├── redis.ts      # Redis 클라이언트 설정
│   │   │   │   └── layer.ts      # CacheLayer (키 생성, TTL, 무효화)
│   │   │   ├── analytics/
│   │   │   │   └── collector.ts  # AnalyticsCollector (메트릭 수집/저장)
│   │   │   ├── db/
│   │   │   │   ├── postgres.ts   # PostgreSQL 클라이언트
│   │   │   │   └── schema.sql    # DDL 스크립트
│   │   │   └── types/
│   │   │       └── index.ts      # 공유 TypeScript 인터페이스
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── dashboard/                # @pag0/dashboard — Next.js + Tailwind
│   │   ├── app/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── policies/page.tsx
│   │   │   └── rankings/page.tsx
│   │   ├── components/
│   │   ├── lib/api.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mcp/                      # @pag0/mcp — Demo Agent MCP Server
│       ├── src/
│       │   ├── index.ts          # MCP Server entry (stdio transport)
│       │   ├── client.ts         # Pag0 Proxy API HTTP 클라이언트
│       │   ├── wallet.ts         # ethers.Wallet 래퍼 (잔액 조회 + 결제 서명)
│       │   └── tools/
│       │       ├── wallet.ts     # pag0_wallet_status
│       │       ├── proxy.ts      # pag0_request (402→sign→retry)
│       │       ├── policy.ts     # pag0_check_budget, pag0_check_policy, pag0_list_policies
│       │       ├── curation.ts   # pag0_recommend, pag0_compare, pag0_rankings, pag0_score
│       │       └── analytics.ts  # pag0_spending, pag0_cache_stats, pag0_tx_history
│       ├── .env                  # PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY
│       ├── package.json
│       └── tsconfig.json
├── docs/                         # 제품/기술 문서 (pag0/ 원본)
├── .env.example                  # 환경변수 템플릿
├── package.json                  # 루트 (pnpm workspace)
├── pnpm-workspace.yaml
└── tsconfig.json                 # 공유 TS 설정
```

> **미들웨어**: Auth(API Key 검증), Rate Limiter는 `index.ts`에 Hono 미들웨어로 통합 구현.

---

## 명령어

```bash
# Root (monorepo)
pnpm install                       # 전체 의존성 설치
pnpm dev                           # proxy + dashboard 동시 실행
pnpm dev:proxy                     # Backend만 (localhost:3000)
pnpm dev:dashboard                 # Dashboard만 (localhost:3001)
pnpm dev:mcp                       # MCP Server (stdio, Claude Code 연동용)
pnpm build                         # 전체 빌드
pnpm test                          # 테스트 (proxy)

# Database
pnpm db:migrate                    # 스키마 마이그레이션
pnpm db:seed                       # 시드 데이터 삽입

# 배포
fly launch && fly deploy           # Backend → Fly.io
fly secrets set KEY=VALUE          # 환경변수 설정
vercel --prod                      # Dashboard → Vercel
```

### 환경변수 (이름만, 값은 .env에)

```
# Server
PORT, NODE_ENV, LOG_LEVEL

# Database (Supabase)
DATABASE_URL, DIRECT_URL

# Redis (Upstash) — ioredis TCP 연결용
REDIS_URL, REDIS_TOKEN

# x402
X402_FACILITATOR_URL, X402_NETWORK, X402_CHAIN_ID

# SKALE
SKALE_RPC_URL, SKALE_PRIVATE_KEY, SKALE_AUDIT_CONTRACT

# Auth & Security
JWT_SECRET, API_KEY_SALT, ENCRYPTION_KEY, CORS_ORIGINS

# MCP Server (packages/mcp)
PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY, NETWORK
```

> **중요**: 기존 `.env`에 Redis 크레덴셜이 이미 존재할 수 있음. 새로 생성하지 말고 기존 파일을 확장할 것.

---

## 아키텍처 & 핵심 개념

### 5개 핵심 컴포넌트

1. **Proxy Core** — x402 요청 중계, 402 응답 파싱, payment relay
2. **Policy Engine (Spend Firewall)** — 예산 한도, whitelist/blacklist, 승인 워크플로우
3. **Curation Engine** — 엔드포인트 점수화(비용/지연/신뢰성), 추천, 비교
4. **Cache Layer** — Redis 응답 캐싱, TTL 관리, 패턴별 규칙
5. **Analytics Collector** — 요청 메트릭 수집/집계/저장 (비동기)

### 요청 흐름

```
Agent → Pag0 Proxy → Auth Check → Policy Check → Cache Check
  → [Cache HIT] → Response + metadata (cost=0)
  → [Cache MISS] → x402 Server → 402 응답 → Agent가 서명 → Facilitator 검증
    → Post-processing: Cache Store + Analytics Log (async) + Budget Update
    → Response + metadata (cost, latency, cache info)
```

### CRITICAL INVARIANTS

- **프록시는 절대 결제를 서명하지 않는다** — payment relay만 수행, Agent가 직접 서명
- **USDC는 항상 BIGINT 6 decimals** — 1 USDC = 1,000,000. 절대 floating point 금지
- **인증**: `X-Pag0-API-Key` 헤더, SHA-256 해시로 DB 조회
- **API Key**: SHA-256 → `users.api_key_hash` VARCHAR(64). Password: bcrypt(12) → `users.password_hash`. 별도 `api_keys` 테이블은 MVP에서 사용 안함

### 캐시 조건 (isCacheable)

4가지 조건 모두 충족 시에만 캐시:
1. HTTP status 2xx
2. GET 또는 idempotent 메서드
3. `Cache-Control: no-store` 헤더 없음
4. 응답 크기 < `maxCacheSizeBytes`

### 성능 목표 (P95)

| 작업 | 목표 |
|------|------|
| Cache Hit | <10ms |
| Policy Check | <5ms |
| Analytics Write | <50ms (비동기) |
| 전체 API 응답 | <300ms |
| 처리량 | 1,000+ req/sec/instance |

---

## DB 빠른 참조

### PostgreSQL 10개 테이블

| 테이블 | 용도 |
|--------|------|
| `users` | 사용자 계정, api_key_hash (SHA-256), password_hash (bcrypt) |
| `projects` | 프로젝트 (사용자당 복수) |
| `policies` | 지출 정책 (예산, whitelist, blacklist) |
| `budgets` | 예산 추적 (daily_spent, monthly_spent) |
| `requests` | 요청 로그 (월별 파티셔닝) |
| `endpoint_scores` | 엔드포인트 점수 (overall, cost, latency, reliability) |
| `categories` | API 카테고리 |
| `endpoint_metrics_hourly` | 시간별 집계 |
| `endpoint_metrics_daily` | 일별 집계 |
| `endpoint_metrics_monthly` | 월별 집계 |

> **categories 시드 데이터**: AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage (8개)

### Redis 6개 키 패턴

```
cache:{sha256(url+method+body)}           → JSON response    (TTL: 설정 가능, 기본 300s)
budget:{projectId}:daily                   → spent amount     (TTL: 자정 UTC)
budget:{projectId}:monthly                 → spent amount     (TTL: 월말)
rate:{projectId}:{window}                  → request count    (TTL: 60s)
score:{endpoint}                           → EndpointScore    (TTL: 300s)
metrics:{projectId}:{endpoint}:hourly      → hash counters    (TTL: 7200s)
nonce:{paymentId}                          → "1"              (TTL: 3600s, replay 방지)
```

---

## API 빠른 참조

### 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| POST | `/proxy` | x402 요청 중계 (핵심) |
| GET | `/api/policies` | 정책 목록 |
| POST | `/api/policies` | 정책 생성 |
| GET | `/api/policies/:id` | 정책 상세 |
| PUT | `/api/policies/:id` | 정책 수정 |
| DELETE | `/api/policies/:id` | 정책 삭제 |
| GET | `/api/analytics/summary` | 전체 요약 통계 |
| GET | `/api/analytics/endpoints` | 엔드포인트별 통계 |
| GET | `/api/analytics/costs` | 비용 시계열 |
| GET | `/api/analytics/cache` | 캐시 성능 |
| GET | `/api/curation/recommend` | 카테고리별 추천 |
| GET | `/api/curation/compare` | 엔드포인트 비교 |
| GET | `/api/curation/rankings` | 카테고리별 랭킹 |
| GET | `/api/curation/categories` | 카테고리 목록 |
| GET | `/api/curation/score/:endpoint` | 개별 엔드포인트 점수 |
| POST | `/api/auth/register` | 사용자 등록 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| GET | `/health` | 헬스 체크 |

### 인증 & Rate Limit

- **인증 헤더**: `X-Pag0-API-Key: pag0_live_{32_char_random}`
- **Rate Limit**:
  - Free: 60 req/min, 1,000 req/day
  - Pro: 1,000 req/min, Unlimited req/day
- **응답 형식**: `application/json`

> **참고**: `04-API-SPEC.md` TL;DR에 "1,000/min freemium"으로 기재되어 있으나, 상세 Rate Limiting 테이블 기준 Free=60/min이 정확한 값임.

---

## 코딩 컨벤션

- **TypeScript strict mode** 필수 (`strict: true` in tsconfig)
- **네이밍**: camelCase (변수/함수), PascalCase (타입/클래스/인터페이스), kebab-case (파일명)
- **Hono 패턴**: `app.get('/path', handler)`, `c.json()` 응답, `c.req.json()` 바디 파싱
- **USDC 금액**: 항상 `BigInt` 또는 `string`으로 처리 — `parseFloat` 금지
- **DB 쿼리**: `postgres` 패키지의 template literal — 문자열 연결 금지 (SQL injection 방지)
- **비동기**: `async/await` 사용, 콜백 금지
- **에러 처리**: 커스텀 에러 클래스 (`PolicyViolationError`, `UnauthorizedError`, `RateLimitError`)
- **에러 응답 형식**: `{ error: { code: string, message: string, details?: any } }`
- **Analytics 쓰기**: 반드시 비동기 (요청 응답을 블로킹하지 않음)

---

## 해커톤 제약 & 폴백

### 타임라인

| Day | 시간 | 핵심 목표 |
|-----|------|-----------|
| Day 0 | ~2h | 환경 설정, 외부 서비스 계정, x402 SDK 테스트 |
| Day 1 | 8h | Proxy Core (오전) + Policy Engine (오후) |
| Day 2 | 9h | Curation+Cache (오전) + Analytics (오후) + 통합 테스트 (저녁) |
| Day 3 | 8h | Dashboard UI (오전) + Demo+Pitch+배포 (오후) |

### MVP 범위 (포함)

- Proxy Core, Policy Engine, Curation Engine, Cache Layer, Analytics Collector
- Web Dashboard (기본 시각화, 정책 관리, API 랭킹)
- 3개 데모 시나리오 (Policy enforcement, Cache savings, API curation)

### MVP 범위 (제외 — Post-hackathon)

- Approval workflow (승인 워크플로우)
- Anomaly detection (이상 탐지)
- Background aggregation jobs
- SKALE on-chain metrics (선택사항)
- 고급 Dashboard 차트/애니메이션

### 폴백 전략

| 리스크 | 폴백 |
|--------|------|
| x402 SDK 통합 실패 | Mock x402 server (402 응답 시뮬레이션) |
| Upstash Redis 연결 실패 | 로컬 Redis (Docker) 또는 In-memory Map |
| Supabase 연결 실패 | 로컬 PostgreSQL (Docker) |
| Curation 데이터 부족 | Seed data (synthetic metrics) |
| Dashboard 시간 부족 | 기본 테이블만 (Tailwind, 차트 생략) |
| 배포 실패 | localhost demo + 녹화 영상 |

> **Day 0**: `@x402/fetch` SDK의 실제 API surface 검증 필수 — `X402Client`, `fetch()`, payment header 파싱 동작 확인.

---

## Do's and Don'ts

### DO

- USDC 금액에 BigInt 사용 (1 USDC = `"1000000"`)
- 모든 프록시 요청 전에 Policy 검증
- 캐시 조건 4가지 모두 확인 후 캐시 저장
- 모든 요청을 Analytics에 비동기 로깅
- API Key는 SHA-256 해시로 저장 및 조회
- Password는 bcrypt(12)로 해싱
- 기존 `.env` 파일 확인 후 확장 (덮어쓰기 금지)

### DON'T

- 프록시에서 결제 서명 — Agent만 서명
- USDC에 `parseFloat` / `Number` 사용
- Policy 검증 건너뛰기
- API Key 원문 저장 (해시만)
- Analytics 쓰기로 요청 응답 블로킹
- `pg` 패키지 사용 (`postgres` 사용)
- `@upstash/redis` 사용 (`ioredis` TCP 사용, Fly.io 배포)
- 별도 `api_keys` 테이블 생성 (MVP는 `users.api_key_hash`)

---

## 참고 문서

상세 문서는 `docs/` 디렉토리 참조:

| 문서 | 내용 |
|------|------|
| [docs/01-PRODUCT-BRIEF.md](docs/01-PRODUCT-BRIEF.md) | 제품 개요, 포지셔닝, 타겟 사용자 |
| [docs/03-TECH-SPEC.md](docs/03-TECH-SPEC.md) | 아키텍처, 컴포넌트 상세, 성능 목표 |
| [docs/04-API-SPEC.md](docs/04-API-SPEC.md) | API 엔드포인트 상세 정의 |
| [docs/05-DB-SCHEMA.md](docs/05-DB-SCHEMA.md) | DB 스키마 DDL, Redis 키 패턴 |
| [docs/06-DEV-TASKS.md](docs/06-DEV-TASKS.md) | Day별 개발 태스크 상세 |
| [docs/07-01-PITCH-SCRIPT.md](docs/07-01-PITCH-SCRIPT.md) | 피치 스크립트 |
| [docs/08-BUSINESS-MODEL.md](docs/08-BUSINESS-MODEL.md) | 비즈니스 모델 |
| [docs/00-GLOSSARY.md](docs/00-GLOSSARY.md) | 용어집 |
