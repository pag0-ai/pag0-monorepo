# Pag0 MVP 구현 태스크 총괄

> Day 0 준비 완료 상태에서 Day 1~3 구현 시작

## 현재 상태 요약

| 패키지 | 상태 | 완성도 |
|--------|------|--------|
| `packages/proxy` | 스켈레톤 (types + DB schema/seed만 존재) | ~5% |
| `packages/dashboard` | Next.js 보일러플레이트 | ~2% |
| `packages/mcp` | **완성** (11개 MCP 도구) | 100% |
| `prepare-hackathon/` | Day 0 검증 + 비즈니스 로직 테스트 패턴 완성 | 100% |

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
| [TASK-05](./TASK-05-proxy-core.md) | Proxy Core + x402 통합 | proxy | 2시간 | TASK-03, TASK-04 |
| [TASK-06](./TASK-06-analytics-collector.md) | ~~Analytics Collector~~ | proxy | 1시간 | ✅ 완료 |

### Phase 3: API Routes (Day 2 오전)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-07](./TASK-07-policy-routes.md) | Policy CRUD Routes | proxy | 1시간 | TASK-01, TASK-03 |
| [TASK-08](./TASK-08-analytics-routes.md) | Analytics API Routes | proxy | 1.5시간 | TASK-01, TASK-06 |
| [TASK-09](./TASK-09-curation-routes.md) | ~~Curation API Routes~~ | proxy | 1.5시간 | ✅ 완료 |
| [TASK-10](./TASK-10-auth-routes.md) | ~~Auth Routes (register/login/me)~~ | proxy | 1시간 | ✅ 완료 |

### Phase 4: 통합 (Day 2 오후)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-11](./TASK-11-integration.md) | index.ts 통합 + 에러 핸들링 | proxy | 1시간 | TASK-02, TASK-05, TASK-07~10 |

### Phase 5: Dashboard (Day 3 오전)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-12](./TASK-12-dashboard-layout.md) | Dashboard Layout + Navigation | dashboard | 1시간 | 없음 |
| [TASK-13](./TASK-13-dashboard-metrics.md) | Dashboard 메트릭 시각화 | dashboard | 1.5시간 | TASK-12, TASK-08 |
| [TASK-14](./TASK-14-policy-ui.md) | Policy 관리 UI | dashboard | 1시간 | TASK-12, TASK-07 |
| [TASK-15](./TASK-15-ranking-board.md) | API Ranking Board | dashboard | 1시간 | TASK-12, TASK-09 |

### Phase 6: 테스트 + Demo (Day 3 오후)

| ID | 태스크 | 패키지 | 예상 시간 | 의존성 |
|----|--------|--------|-----------|--------|
| [TASK-16](./TASK-16-mcp-integration.md) | MCP 서버 연동 테스트 | mcp | 30분 | TASK-11 |
| [TASK-17](./TASK-17-e2e-test.md) | 로컬 통합 테스트 (E2E) | 전체 | 1.5시간 | TASK-11 |
| [TASK-18](./TASK-18-demo-scenarios.md) | Demo 시나리오 스크립트 | 전체 | 1시간 | TASK-17 |

## 병렬 실행 가능 그룹

- **그룹 A** (독립): TASK-01
- **그룹 B** (TASK-01 완료 후 병렬): TASK-02, TASK-03, TASK-04, TASK-06, TASK-09, TASK-10
- **그룹 C** (TASK-03+04 완료 후): TASK-05
- **그룹 D** (API Routes, 병렬): TASK-07, TASK-08
- **그룹 E** (통합): TASK-11
- **그룹 F** (Dashboard, TASK-12 이후 병렬): TASK-13, TASK-14, TASK-15
- **그룹 G** (최종): TASK-16, TASK-17, TASK-18

## 참고 자료

- `docs/03-TECH-SPEC.md` — 아키텍처 상세
- `docs/04-API-SPEC.md` — API 엔드포인트 정의
- `docs/05-DB-SCHEMA.md` — DB 스키마 + Redis 키 패턴
- `docs/06-DEV-TASKS.md` — 원본 개발 태스크
- `prepare-hackathon/test-business-logic-day1.ts` — Day 1 테스트 패턴
- `prepare-hackathon/test-business-logic-day2.ts` — Day 2 테스트 패턴
- `prepare-hackathon/test-business-logic-day3.ts` — Day 3 테스트 패턴
