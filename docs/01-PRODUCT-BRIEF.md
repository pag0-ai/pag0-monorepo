# Pag0 Smart Proxy - 제품 개요

> **TL;DR**: Pag0는 x402 생태계의 유일한 스마트 프록시 레이어로, 정책 기반 예산 관리(Spend Firewall), 실사용 데이터 기반 API 큐레이션, 지능형 캐싱(40%+ 비용 절감)을 하나의 솔루션으로 제공합니다. AI Agent 개발자가 x402 API를 안전하고 효율적으로 사용할 수 있게 해주는 3-in-1 미들웨어입니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) | 경쟁사 분석 및 포지셔닝 |
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처 및 기술 상세 |
| [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) | 비즈니스 모델 상세 |
| [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) | 사용자 시나리오 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 용어집 |

## 한 줄 요약

**Pag0는 x402 생태계를 위한 스마트 프록시 레이어로, 정책 기반 예산 관리, 실사용 데이터 기반 API 큐레이션, 지능형 캐싱을 제공하는 3-in-1 솔루션입니다.**

## 문제 정의

### 1. 비용 제어 부재

AI Agent 개발자들이 x402 결제 요청을 직접 사용할 때, 중복 요청으로 인한 불필요한 비용 발생 및 예산 초과 위험이 있습니다. 기업 환경에서는 팀별/프로젝트별 예산 관리와 승인 프로세스가 필요하지만 현재 x402 생태계에는 이를 제공하는 레이어가 없습니다.

### 2. 반복 요청으로 인한 비효율

동일한 데이터를 반복 조회하는 경우에도 매번 결제가 발생합니다. 캐싱 레이어가 없어 불필요한 비용과 대기 시간이 발생합니다.

### 3. API 선택 정보 부족

x402 Bazaar는 서비스 목록만 제공하며, SlinkyLayer의 평판 시스템은 주관적 리뷰에 의존합니다. 개발자는 실제 비용, 성능, 안정성 데이터를 기반으로 한 객관적 비교가 필요합니다.

## 솔루션: 3-in-1 Value

### 1. 비용 절감 (Cost Reduction)

- 지능형 캐싱으로 중복 결제 방지
- **40%+ 비용 절감** 달성 목표
- Cache hit rate 기반 실시간 절감액 추적

### 2. 지출 통제 (Spend Control)

- 정책 기반 예산 관리: 요청당/일일/월별 한도
- Whitelist/Blacklist 기반 엔드포인트 제어
- 임계값 기반 승인 워크플로우
- 이상 탐지 및 알림

### 3. 큐레이션 (Curation)

- 실사용 데이터 기반 API 점수화 (비용/지연시간/신뢰성)
- 카테고리별 랭킹 및 추천
- API 비교 도구
- 객관적 의사결정 지원

## 핵심 기능

| 기능 | 설명 | 핵심 가치 |
|------|------|-----------|
| **Proxy Core** | x402 요청 중계, Agent-signed payment relay (프록시는 결제 서명 안함) | x402 투명한 통합 |
| **Policy Engine** | 예산 한도, whitelist/blacklist, 승인 워크플로우 | 지출 통제 |
| **Cache Layer** | Redis 기반 응답 캐싱, TTL 관리, 패턴별 규칙 | 40%+ 비용 절감 |
| **Analytics Collector** | 요청 수, 지연시간 (P50/P95/P99), 성공률, 비용, 캐시 적중률 추적 | 데이터 기반 최적화 |
| **Curation Engine** | 엔드포인트 점수화, 랭킹, 추천, 비교 | 객관적 API 선택 |

## 포지셔닝

```
[x402 생태계 레이어 맵]

┌─────────────────────────────────────────────────┐
│ AI Agents (Virtuals G.A.M.E., Google ADK 등)     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ ★ Pag0 Smart Proxy Layer ★                      │ ← 유일한 프록시 레이어
│ (Policy + Curation + Cache + Analytics)         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ x402 Protocol (@x402/fetch SDK)                 │
│ + Facilitator (Payment Verification)            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ x402 Servers (Data/Service Providers)           │
└─────────────────────────────────────────────────┘

[보조 레이어]
- x402 Bazaar: 서비스 디스커버리 (Facilitator 중심)
- SlinkyLayer: 평판 시스템 (주관적 리뷰 기반)
```

**핵심 차별점**: Payment layer와 Discovery/Reputation은 이미 포화 상태. **Proxy/Control layer는 공백 시장** → Pag0가 선점.

## 타겟 사용자

### Primary: AI Agent 개발자

- **Pain Points**: 예산 관리, 비용 최적화, API 선택
- **Use Cases**: Agent 개발, 프로토타이핑, 프로덕션 배포
- **Value**: 빠른 개발, 예측 가능한 비용, 데이터 기반 의사결정

### Secondary: 기업 IT/Finance 팀

- **Pain Points**: 팀별 예산 관리, 승인 프로세스, 리포팅
- **Use Cases**: 다중 프로젝트 관리, 예산 할당, 비용 분석
- **Value**: 중앙화된 통제, 투명한 리포팅, 컴플라이언스

## 기술 스택

| 레이어 | 기술 | 선택 이유 |
|--------|------|-----------|
| Runtime | Bun / Node.js | 빠른 개발, TypeScript native |
| Framework | Hono | 경량, Edge 호환, 빠른 라우팅 |
| Cache | Redis (Upstash) | Serverless, 글로벌 저지연 |
| Database | PostgreSQL (Supabase) | 관계형 데이터, 강력한 쿼리 |
| Blockchain | SKALE | Zero Gas (무료 on-chain metrics) |
| Indexing | The Graph | Payment event 서브그래프 |
| Hosting | Cloudflare Workers / Fly.io | Edge deployment, 글로벌 분산 |

```yaml
# 기술 스택 요약
tech_stack:
  runtime: "Bun / Node.js"
  framework: "Hono"
  cache: "Redis (Upstash)"
  database: "PostgreSQL (Supabase)"
  blockchain: "SKALE (Zero Gas)"
  indexing: "The Graph"
  hosting: "Cloudflare Workers / Fly.io"
```

## MVP 범위 (3일)

```yaml
# MVP 범위
target_timeline: "3일 (해커톤)"
core_features:
  - "Proxy Core (x402 요청 중계)"
  - "Policy Engine (예산 한도, whitelist/blacklist)"
  - "Cache Layer (Redis 기반 응답 캐싱)"
  - "Analytics Collector (메트릭 수집/저장)"
  - "Curation Engine (점수 계산, 추천 API)"
  - "Web Dashboard (시각화, 관리)"
deliverables:
  - "배포된 프로덕션 엔드포인트"
  - "3개 시나리오 데모"
  - "Pitch Deck"
```

### Day 1: Proxy Core + Policy Engine

- ✅ x402 요청 프록시 (402 응답 파싱, payment relay)
- ✅ 예산 한도 검증 (요청당/일일/월별)
- ✅ Whitelist/Blacklist 엔드포인트 필터링
- ✅ Policy CRUD API

### Day 2: Curation + Cache + Analytics

- ✅ Curation Engine (점수 계산, 추천 API)
- ✅ Redis 캐싱 (URL+Method+Body 기반 키 생성)
- ✅ TTL 관리 및 패턴별 규칙
- ✅ Metrics 수집 및 저장 (PostgreSQL)
- ✅ Analytics API (summary, endpoints, costs, cache)

### Day 3: Dashboard + Demo + Pitch

- ✅ Web Dashboard (metrics 시각화, policy 관리)
- ✅ API Ranking Board (카테고리별 점수)
- ✅ Agent 데모 스크립트 (시나리오 기반)
- ✅ Pitch Deck + 배포 (Fly.io/Vercel)

## 성공 지표

### Hackathon (3일)

- ✅ Working MVP (모든 핵심 기능 동작)
- ✅ Agent 데모 (3개 시나리오: policy enforcement, cache savings, curation)
- ✅ 배포된 프로덕션 엔드포인트
- ✅ 완성된 Pitch Deck

### Post-Hackathon (3개월)

- **100 agents MAU** (월간 활성 에이전트)
- **100K requests/day** (일일 프록시 요청)
- **30%+ 평균 비용 절감** (캐싱 효과)
- **70%+ 추천 채택률** (큐레이션 품질)
- **500+ 인덱싱된 엔드포인트** (생태계 커버리지)

```yaml
# 성공 지표
hackathon_kpi:
  working_mvp: true
  demo_scenarios: 3
  production_endpoint: true
  pitch_deck: true
post_hackathon_kpi:
  mau_agents: 100
  daily_requests: 100000
  avg_cost_savings: "30%+"
  recommendation_adoption: "70%+"
  indexed_endpoints: 500
```

## 비즈니스 모델

### Freemium Tier

- 기본 무료: 1,000 requests/day
- 기본 정책 및 캐싱
- Analytics 대시보드

### Cache Savings Share

- 캐시 절감액의 **15% 수수료**
- 사용자는 여전히 순절감 (85% 이익)
- 사용량 기반 자동 과금

### Pro Subscription

- Unlimited requests
- 고급 정책 (승인 워크플로우, 이상 탐지)
- 상세 Analytics + 큐레이션
- Priority 지원
- **$99/month** (초기 가격)

---

## 해커톤 스폰서 연동

- **Coinbase**: x402 Protocol 사용 (core integration)
- **SKALE**: On-chain metrics 저장 (zero gas)
- **The Graph**: Payment event subgraph (투명성)
- **Google Cloud**: ADK agent 오케스트레이션 (demo scenario)
- **Virtuals**: G.A.M.E. SDK (optional agent creation)

---

**Version**: 1.0 (Hackathon MVP)
**Last Updated**: 2026-02-10
