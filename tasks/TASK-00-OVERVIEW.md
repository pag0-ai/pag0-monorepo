# Pag0 MVP 구현 태스크 총괄

> Day 0 준비 완료 상태에서 Day 1~3 구현 시작
> **Last updated**: 2026-02-12 (Phase 10 추가, gap/requirements analysis 반영)

## 현재 상태 요약

| 패키지 | 상태 | 완성도 | 비고 |
|--------|------|--------|------|
| `packages/proxy` | **완성** (Phase 10 정렬 완료) | 100% | TASK-38, 39 반영 |
| `packages/dashboard` | **완성** (메트릭+정책+랭킹) | 100% | TASK-40 반영 |
| `packages/mcp` | **완성** (13개 MCP 도구, CDP Wallet 통합) | 100% | TASK-41 반영 |
| `packages/contracts` | **배포 완료** (SKALE bite-v2-sandbox) | 100% | ReputationRegistry + ValidationRegistry |
| `subgraph/` | **배포 완료** (Goldsky) | 100% | Agent, FeedbackEvent 인덱싱 |
| `prepare-hackathon/` | Day 0 검증 완성 | 100% | - |

### 전체 진행률: 40/41 완료 (97.6%) + 1 수동 대기 (TASK-22 Deployment)

## 의존성 그래프

```
TASK-01 (DB/Redis 클라이언트)
  ├─→ TASK-02 (Auth 미들웨어)
  ├─→ TASK-03 (Policy Engine)
  ├─→ TASK-04 (Cache Layer)
  ├─→ TASK-06 (Analytics Collector)
  └─→ TASK-09 (Curation API Routes)

TASK-02 (Auth 미들웨어)
  └─→ TASK-11 (index.ts 통합)

TASK-03 (Policy Engine)
  └─→ TASK-05 (Proxy Core)
       └─→ TASK-11 (index.ts 통합)

TASK-04 (Cache Layer)
  └─→ TASK-05 (Proxy Core)

TASK-06 (Analytics Collector)
  └─→ TASK-05 (Proxy Core)

TASK-07 (Policy CRUD Routes)  ← TASK-01
TASK-08 (Analytics Routes)    ← TASK-01, TASK-06
TASK-09 (Curation Routes)     ← TASK-01
TASK-10 (Auth Routes)         ← TASK-01

TASK-11 (index.ts 통합)       ← TASK-02, TASK-05, TASK-07~10

TASK-12 (Dashboard Layout)    ← (독립)
TASK-13 (Dashboard 메트릭)    ← TASK-12, TASK-08
TASK-14 (Policy 관리 UI)      ← TASK-12, TASK-07
TASK-15 (API Ranking Board)   ← TASK-12, TASK-09

TASK-16 (MCP 연동 테스트)     ← TASK-11
TASK-17 (통합 테스트 E2E)     ← TASK-11
TASK-18 (Demo 시나리오)       ← TASK-17

TASK-19 (CDP Wallet)          ← TASK-16
TASK-20 (ERC-8004 Audit)      ← TASK-05, TASK-19
TASK-21 (ERC-8004 MCP+Graph)  ← TASK-20, TASK-16
TASK-37 (Subgraph Query)      ← TASK-20, TASK-21
TASK-22 (Deployment)          ← TASK-11, TASK-12
```

## 태스크 목록

### Phase 1: 인프라 + 코어 로직 (Day 1 오전)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-01](./TASK-01-db-redis-client.md) | ~~DB/Redis 클라이언트 설정~~ | proxy | 30분 | ✅ 완료 |
| [TASK-02](./TASK-02-auth-middleware.md) | ~~Auth 미들웨어 + Rate Limiter~~ | proxy | 1시간 | ✅ 완료 |
| [TASK-03](./TASK-03-policy-engine.md) | ~~Policy Engine + Budget Tracker~~ | proxy | 1.5시간 | ✅ 완료 |
| [TASK-04](./TASK-04-cache-layer.md) | ~~Cache Layer (Redis)~~ | proxy | 1시간 | ✅ 완료 |

### Phase 2: Proxy Core + x402 (Day 1 오후)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-05](./TASK-05-proxy-core.md) | ~~Proxy Core + x402 통합~~ | proxy | 2시간 | ✅ 완료 |
| [TASK-06](./TASK-06-analytics-collector.md) | ~~Analytics Collector~~ | proxy | 1시간 | ✅ 완료 |

### Phase 3: API Routes (Day 2 오전)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-07](./TASK-07-policy-routes.md) | ~~Policy CRUD Routes~~ | proxy | 1시간 | ✅ 완료 |
| [TASK-08](./TASK-08-analytics-routes.md) | ~~Analytics API Routes~~ | proxy | 1.5시간 | ✅ 완료 |
| [TASK-09](./TASK-09-curation-routes.md) | ~~Curation API Routes~~ | proxy | 1.5시간 | ✅ 완료 |
| [TASK-10](./TASK-10-auth-routes.md) | ~~Auth Routes (register/login/me)~~ | proxy | 1시간 | ✅ 완료 |

### Phase 4: 통합 (Day 2 오후)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-11](./TASK-11-integration.md) | ~~index.ts 통합 + 에러 핸들링~~ | proxy | 1시간 | ✅ 완료 |

### Phase 5: Dashboard (Day 3 오전)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-12](./TASK-12-dashboard-layout.md) | ~~Dashboard Layout + Navigation~~ | dashboard | 1시간 | ✅ 완료 |
| [TASK-13](./TASK-13-dashboard-metrics.md) | ~~Dashboard 메트릭 시각화~~ | dashboard | 1.5시간 | ✅ 완료 |
| [TASK-14](./TASK-14-policy-ui.md) | ~~Policy 관리 UI~~ | dashboard | 1시간 | ✅ 완료 |
| [TASK-15](./TASK-15-ranking-board.md) | ~~API Ranking Board~~ | dashboard | 1시간 | ✅ 완료 |

### Phase 6: 테스트 + Demo (Day 3 오후)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-16](./TASK-16-mcp-integration.md) | ~~MCP 서버 연동 테스트~~ | mcp | 30분 | ✅ 완료 |
| [TASK-17](./TASK-17-e2e-test.md) | ~~로컬 통합 테스트 (E2E)~~ | 전체 | 1.5시간 | ✅ 완료 |
| [TASK-18](./TASK-18-demo-scenarios.md) | ~~Demo 시나리오 스크립트~~ | 전체 | 1시간 | ✅ 완료 |

### Phase 7: 확장 기능 — CDP Wallet + ERC-8004 + Deployment

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-19](./TASK-19-cdp-wallet.md) | ~~CDP Wallet Integration (Coinbase Server Wallet)~~ | mcp | 2~3시간 | ✅ 완료 |
| [TASK-20](./TASK-20-erc8004-audit.md) | ~~ERC-8004 Audit Trail (온체인 감사 기록)~~ | proxy | 3~4시간 | ✅ 완료 |
| [TASK-21](./TASK-21-erc8004-mcp-subgraph.md) | ~~ERC-8004 MCP Tools + The Graph Subgraph~~ | mcp, subgraph | 2~3시간 | ✅ 완료 |
| [TASK-22](./TASK-22-deployment.md) | Deployment (Fly.io + Vercel) | proxy, dashboard | 2시간 | ⏳ 수동 승인 대기 |
| [TASK-37](./TASK-37-subgraph-query-integration.md) | ~~Subgraph Query Integration (온체인 평판 읽기)~~ | proxy | 3~4시간 | ✅ 완료 |

### Phase 8: 스토리보드 갭 수정 — 프론트엔드/백엔드 데이터 계약 정렬

| ID | 태스크 | 패키지 | 우선순위 | 의존성 |
|----|--------|--------|----------|--------|
| [TASK-23](./TASK-23-api-response-unwrap.md) | ~~API 응답 언래핑 (모든 fetch 함수)~~ | dashboard | **HIGH** | ✅ 완료 |
| [TASK-24](./TASK-24-policy-field-mismatch.md) | ~~Policy 필드명 불일치 수정~~ | dashboard | **HIGH** | ✅ 완료 |
| [TASK-25](./TASK-25-analytics-field-mismatch.md) | ~~Analytics 필드명 불일치 수정~~ | dashboard | **HIGH** | ✅ 완료 |
| [TASK-26](./TASK-26-curation-field-mismatch.md) | ~~Curation 점수 필드명 불일치 수정~~ | dashboard | **HIGH** | ✅ 완료 |
| [TASK-27](./TASK-27-budget-mock-to-real.md) | ~~Dashboard 예산 Mock → 실제 데이터~~ | dashboard | **HIGH** | ✅ 완료 |
| [TASK-28](./TASK-28-empty-state-ux.md) | ~~빈 대시보드 UX (CTA + 빈 차트)~~ | dashboard | **MEDIUM** | ✅ 완료 |

> ~~**핵심 문제**: 백엔드는 `{ data: [...] }`, `{ policies: [...] }` 등 래퍼 객체로 응답하지만, 프론트엔드 fetch 함수들은 배열을 직접 기대함.~~ **해결 완료** (커밋 `7f02774`)

### Phase 9: Demo Polish — Seed 보강 + UX 완성 + 배포 준비

| ID | 태스크 | 패키지 | 우선순위 | 의존성 |
|----|--------|--------|----------|--------|
| [TASK-29](./TASK-29-seed-apikey-format.md) | ~~seed API key format 수정 (auth regex 일치)~~ | proxy | **P0** | ✅ 완료 |
| [TASK-30](./TASK-30-seed-requests-data.md) | ~~seed에 synthetic requests 데이터 추가~~ | proxy | **P0** | ✅ 완료 |
| [TASK-31](./TASK-31-seed-more-endpoints.md) | ~~seed endpoint_scores를 전체 카테고리로 확장~~ | proxy | **P0** | ✅ 완료 |
| [TASK-32](./TASK-32-onboarding-no-sidebar.md) | ~~Onboarding/Login 사이드바 제거~~ | dashboard | **P1** | ✅ 완료 |
| [TASK-33](./TASK-33-compare-winner-display.md) | ~~Rankings Compare winner 표시~~ | dashboard | **P1** | ✅ 완료 |
| [TASK-34](./TASK-34-error-state-handling.md) | ~~전체 페이지 에러 상태 처리~~ | dashboard | **P1** | ✅ 완료 |
| [TASK-35](./TASK-35-env-example-dashboard.md) | ~~.env.example에 Dashboard 환경변수 추가~~ | 전체 | **P2** | ✅ 완료 |
| [TASK-36](./TASK-36-nextconfig-rewrite-env.md) | ~~next.config rewrite 환경변수 분기~~ | dashboard | **P2** | ✅ 완료 |

### Phase 10: API 계약 정렬 — docs vs codebase gap 해소 (2026-02-12)

> Gap Analysis (.omc/gap-analysis.md) 및 Requirements Analysis (.omc/requirements.md) 기반으로 식별된 데이터 계약 불일치 수정.

| ID | 태스크 | 패키지 | 우선순위 | 상태 |
|----|--------|--------|----------|------|
| [TASK-38](./TASK-38-analytics-response-enrichment.md) | Analytics 응답 보강 (topEndpoints cost, endpoints total, costs summary) | proxy | **P1** | ✅ 완료 |
| [TASK-39](./TASK-39-policy-response-field-rename.md) | Policy 응답 필드명 통일 (dailyLimit → dailyBudget) | proxy, mcp | **P0** | ✅ 완료 |
| [TASK-40](./TASK-40-dashboard-204-nullable-fix.md) | Dashboard fetchApi 204 처리 + Category nullable 필드 | dashboard | **P1** | ✅ 완료 |
| [TASK-41](./TASK-41-mcp-route-field-alignment.md) | MCP client/tools 라우트 및 필드명 정렬 | mcp | **P1** | ✅ 완료 |

### 미착수 / 보류

| ID | 태스크 | 패키지 | 우선순위 | 상태 |
|----|--------|--------|----------|------|
| [TASK-22](./TASK-22-deployment.md) | Deployment (Fly.io + Vercel) | proxy, dashboard | - | ⏳ 수동 승인 대기 |

### Gap Analysis 발견 사항 (구현 불필요 — 문서 업데이트 또는 Post-MVP)

아래 항목들은 gap-analysis에서 발견되었으나 코드 수정이 아닌 문서 업데이트 대상이거나 MVP 범위 제외 항목:

- **P2-1**: Approval workflow — MVP 제외 (CLAUDE.md에 명시)
- **P2-2**: Anomaly detection — MVP 제외
- **P2-3**: Background aggregation jobs — MVP에서는 실시간 쿼리로 대체
- **P2-6**: SDK package (`@pag0/sdk`) — Post-hackathon
- **P2-7**: Webhook support — Post-hackathon
- **P2-8**: Score history tracking — Post-hackathon

### Beyond-Spec 기능 (문서에 없지만 구현 완료된 보너스 기능)

- `/api/smart-request` — AI 프로바이더 자동 선택 + 프록시
- `/api/reputation/*` — 온체인 평판 프로필/피드백/리더보드
- `onChainReputation` 필드 — 프록시 응답 메타데이터에 온체인 평판 포함
- 4-factor 스코어링 — 기존 3차원(cost/latency/reliability) + reputation
- CDP Wallet (Coinbase Server Wallet) — MCP에서 dual wallet mode
- OAuth registration — 추가 인증 플로우

## 병렬 실행 가능 그룹

- **그룹 A** (독립): TASK-01
- **그룹 B** (TASK-01 완료 후 병렬): TASK-02, TASK-03, TASK-04, TASK-06, TASK-09, TASK-10
- **그룹 C** (TASK-03+04 완료 후): TASK-05
- **그룹 D** (API Routes, 병렬): TASK-07, TASK-08
- **그룹 E** (통합): TASK-11
- **그룹 F** (Dashboard, TASK-12 이후 병렬): TASK-13, TASK-14, TASK-15
- **그룹 G** (최종): TASK-16, TASK-17, TASK-18
- **그룹 H** (확장, TASK-16 이후): TASK-19, TASK-22 (병렬)
- **그룹 I** (TASK-19 완료 후): TASK-20
- **그룹 J** (TASK-20 완료 후): TASK-21
- **그룹 K** (Phase 10, 병렬): TASK-38, TASK-39, TASK-40, TASK-41

## 참고 자료

- `docs/03-TECH-SPEC.md` — 아키텍처 상세
- `docs/04-API-SPEC.md` — API 엔드포인트 정의
- `docs/05-DB-SCHEMA.md` — DB 스키마 + Redis 키 패턴
- `docs/06-DEV-TASKS.md` — 원본 개발 태스크
- `.omc/gap-analysis.md` — docs vs codebase 갭 분석 결과
- `.omc/requirements.md` — 갭 기반 요구사항 분석
- `prepare-hackathon/test-business-logic-day1.ts` — Day 1 테스트 패턴
- `prepare-hackathon/test-business-logic-day2.ts` — Day 2 테스트 패턴
- `prepare-hackathon/test-business-logic-day3.ts` — Day 3 테스트 패턴
