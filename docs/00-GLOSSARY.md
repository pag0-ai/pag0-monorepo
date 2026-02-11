# 용어집 (Glossary)

> **TL;DR**: Pag0 프로젝트에서 사용되는 핵심 용어, 약어, 기술 스택을 정리한 문서입니다. 프로토콜, 아키텍처, 비즈니스 용어를 빠르게 참조할 수 있습니다.

## 관련 문서

- [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md) - 제품 개요
- [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) - 경쟁사 분석
- [03-TECH-SPEC.md](03-TECH-SPEC.md) - 기술 사양
- [04-API-SPEC.md](04-API-SPEC.md) - API 명세
- [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) - 비즈니스 모델
- [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) - 보안 설계
- [12-SDK-GUIDE.md](12-SDK-GUIDE.md) - SDK 가이드

---

## 프로토콜 / 표준

| 용어 | 정의 |
|------|------|
| **x402** | Coinbase가 주도하는 HTTP 402 Payment Required 기반 결제 프로토콜. AI 에이전트가 API 호출 시 자동으로 마이크로페이먼트를 수행할 수 있게 하는 오픈 프로토콜이다. |
| **HTTP 402 (Payment Required)** | HTTP 상태 코드 중 하나로, 서버가 요청을 처리하려면 결제가 필요함을 나타낸다. x402 프로토콜의 핵심 메커니즘으로 사용된다. |
| **ERC-8004** | SlinkyLayer가 제안한 온체인 평판 시스템 표준. x402 생태계에서 서비스 제공자의 신뢰도를 토큰화하여 관리하는 Ethereum Request for Comments 규격이다. |
| **@x402/fetch** | Coinbase가 제공하는 x402 프로토콜 공식 JavaScript/TypeScript SDK. HTTP 402 응답 파싱, Payment Request 생성, 결제 서명 등을 처리한다. |
| **402pay** | HTTP 402 결제 표준의 대안적 프로토콜 구현체. x402와 유사한 목적을 가진 경쟁 프로토콜이다. |
| **h402** | 오픈소스 402 결제 구현체. 주로 교육 및 실험 용도로 사용된다. |
| **x4Pay** | IoT/ESP32 디바이스에 특화된 402 결제 구현체. |

---

## 제품 / 아키텍처 용어

| 용어 | 정의 |
|------|------|
| **Pag0 Smart Proxy** | x402 생태계 위에 올라가는 스마트 프록시 레이어. Policy Engine + Curation Engine + Cache Layer의 3-in-1 솔루션으로, AI 에이전트의 유료 API 호출을 제어하고 최적화한다. |
| **Proxy Core** | Pag0의 핵심 컴포넌트. x402 요청을 중계하고 결제 프로세스를 오케스트레이션한다. 프록시는 결제를 서명하지 않으며 Agent가 서명한 Payment Payload를 릴레이만 수행한다. |
| **Policy Engine (Spend Firewall)** | 예산 한도, whitelist/blacklist, 승인 워크플로우를 검증하는 엔진. 요청당/일일/월별 예산 정책을 적용하여 AI 에이전트의 과다 지출을 방지한다. |
| **Cache Layer (Smart Cache)** | Redis 기반 응답 캐싱 시스템. 동일한 API 요청의 중복 결제를 방지하여 40% 이상 비용 절감을 달성한다. TTL(Time To Live) 관리 및 패턴별 캐싱 규칙을 지원한다. |
| **Curation Engine** | 실사용 데이터 기반 API 점수화/추천 엔진. 비용(Cost), 응답 속도(Latency), 신뢰도(Reliability) 세 축으로 엔드포인트를 평가하고 카테고리별 랭킹 및 추천을 제공한다. |
| **Analytics Collector** | 모든 프록시 요청의 메트릭(요청 수, 지연시간, 성공률, 비용, 캐시 적중률)을 수집하고 집계하는 파이프라인. |
| **API Curation** | 프록시를 통과하는 실사용 데이터를 기반으로 x402 API 엔드포인트의 품질을 객관적으로 평가하고 추천하는 기능. 마케팅 자료가 아닌 실측 데이터로 API를 비교한다. |
| **Spend Policy** | 프로젝트별로 설정하는 지출 정책. 요청당 최대 금액(`maxPerRequest`), 일일 예산(`dailyBudget`), 월별 예산(`monthlyBudget`), 허용/차단 엔드포인트 목록 등을 포함한다. |
| **Facilitator** | x402 프로토콜에서 결제 검증(verification)과 정산(settlement)을 수행하는 서비스. Agent가 서명한 Payment Payload의 유효성을 확인하고 결제를 완료한다. |
| **Resource Server (x402 Server)** | x402 프로토콜에서 유료 API/데이터를 제공하는 서버. 결제가 필요할 때 HTTP 402 응답과 함께 Payment Request를 반환한다. |
| **Payment Request** | x402 서버가 402 응답과 함께 반환하는 결제 요청 정보. 금액, 수신자 주소, Facilitator URL, 만료 시간 등을 포함한다. |
| **Payment Relay** | Pag0 프록시가 Agent가 서명한 결제 페이로드를 Facilitator에 단순 전달하는 방식. 프록시는 서명하지 않으며 릴레이만 수행한다. |
| **Endpoint Score** | Curation Engine이 산출하는 API 엔드포인트의 종합 점수(0-100). 비용 점수(40%), 지연시간 점수(30%), 신뢰도 점수(30%)의 가중 합으로 계산된다. |
| **Dashboard** | 실시간 메트릭 시각화, 정책 관리, API 랭킹 보드를 제공하는 웹 UI. React/Next.js로 구현된다. |

---

## 기술 스택

| 용어 | 정의 |
|------|------|
| **Bun** | 고성능 JavaScript/TypeScript 런타임. Node.js 대비 빠른 실행 속도를 제공하며, Pag0 프록시의 기본 런타임으로 사용된다. |
| **Hono** | 경량 웹 프레임워크. Edge 환경(Cloudflare Workers 등) 호환이 뛰어나고 빠른 라우팅을 제공한다. Pag0 API 서버의 프레임워크로 사용된다. |
| **Upstash Redis** | 서버리스(Serverless) Redis 서비스. 글로벌 멀티 리전 복제, 저지연(<5ms), 종량제 가격을 제공한다. Pag0의 캐시 레이어, 예산 카운터, Rate Limiter에 사용된다. |
| **Supabase PostgreSQL** | 오픈소스 PostgreSQL 호스팅 서비스. 관계형 데이터 저장소로 정책, 요청 로그, 분석 데이터, 엔드포인트 점수를 관리한다. Row-Level Security(RLS) 지원. |
| **SKALE** | EVM 호환 레이어-1 블록체인으로 Zero Gas(가스비 무료)가 특징. Pag0에서 온체인 메트릭 저장 및 불변 감사 추적(Immutable Audit Trail)에 사용된다. |
| **The Graph** | 블록체인 데이터 인덱싱 프로토콜. 서브그래프(Subgraph)를 통해 x402 결제 이벤트를 인덱싱하여 투명한 결제 히스토리를 제공한다. |
| **Subgraph** | The Graph에서 특정 스마트 컨트랙트 이벤트를 인덱싱하는 단위. Pag0는 Payment Event와 Endpoint Aggregate를 인덱싱하는 서브그래프를 운영한다. |
| **Cloudflare Workers** | 엣지 컴퓨팅 플랫폼. 전 세계 분산 배포로 낮은 지연시간(<50ms P99)을 제공한다. Pag0 프로덕션 배포 옵션 중 하나. |
| **Fly.io** | 글로벌 분산 애플리케이션 호스팅 플랫폼. 멀티 리전 배포 및 자동 스케일링을 지원한다. Pag0 프로덕션 배포 옵션 중 하나. |
| **ethers.js** | Ethereum 및 EVM 호환 블록체인과 상호작용하는 JavaScript 라이브러리. SKALE 온체인 메트릭 기록에 사용된다. |
| **Docker Compose** | 로컬 개발 환경에서 Redis, PostgreSQL 등 서비스를 컨테이너로 관리하는 도구. |
| **TypeScript** | JavaScript의 정적 타입 확장 언어. Pag0의 모든 코드베이스에 사용된다. |

---

## 블록체인 / 결제 용어

| 용어 | 정의 |
|------|------|
| **USDC** | USD Coin. Circle이 발행하는 달러 페깅 스테이블코인으로, x402 프로토콜의 기본 결제 수단이다. 6 decimals(소수점 6자리)를 사용하며, 1 USDC = 1,000,000 (저장값). |
| **Base (L2)** | Coinbase가 운영하는 Ethereum Layer 2 네트워크. x402 결제가 처리되는 기본 체인이다. Base Sepolia(테스트넷)과 Base Mainnet(프로덕션)을 사용한다. |
| **Zero Gas** | SKALE 네트워크의 가스비 무료 특성. 트랜잭션 수수료 없이 온체인 작업을 수행할 수 있어, 고빈도 메트릭 기록에 적합하다. |
| **pSLINKY** | SlinkyLayer의 평판 토큰. ERC-8004 표준 기반으로 서비스 제공자의 신뢰도를 토큰화한다. |
| **Nonce** | 결제 재사용(Replay Attack)을 방지하기 위한 일회성 식별자. 한 번 사용된 Payment ID는 Redis에 1시간 동안 저장되어 중복 제출을 차단한다. |
| **Payment Replay Prevention** | 동일한 결제 서명이 두 번 이상 제출되는 것을 방지하는 보안 메커니즘. Nonce 기반으로 구현된다. |
| **Coinbase CDP** | Coinbase Developer Platform. x402 Facilitator 및 결제 처리 인프라를 제공한다. |

---

## SDK / 개발 도구

| 용어 | 정의 |
|------|------|
| **@pag0/sdk** | Pag0 공식 TypeScript SDK. `createPag0Client`로 클라이언트를 생성하고, `pag0.fetch()`로 x402 API를 프록시 경유 호출한다. 정책 설정, 캐싱, 분석 조회 기능을 3줄 코드로 제공한다. |
| **@pag0/cli** | Pag0 CLI(Command Line Interface) 도구. 프로젝트 생성, API Key 발급, 정책 관리를 터미널에서 수행한다. |
| **createPag0Client** | @pag0/sdk의 메인 팩토리 함수. API Key, 정책, 캐시 설정을 인자로 받아 Pag0 클라이언트 인스턴스를 생성한다. |
| **pag0.fetch()** | @pag0/sdk의 핵심 메서드. 기존 `fetch()` API와 동일한 인터페이스로 x402 요청을 Pag0 프록시를 경유하여 전송한다. |
| **X-Pag0-API-Key** | Pag0 API 인증에 사용되는 HTTP 헤더. 형식은 `pag0_live_{32_char_random}` (프로덕션) 또는 `pag0_test_{32_char_random}` (테스트). |

---

## 보안 용어

| 용어 | 정의 |
|------|------|
| **Zero Trust** | "모든 요청을 신뢰하지 않는다"는 보안 아키텍처 원칙. 내부/외부 구분 없이 모든 API 요청에 동일한 인증/인가/검증을 적용한다. |
| **Defense in Depth (다층 방어)** | 보안을 단일 레이어에 의존하지 않고 Network, Authentication, Authorization, Application, Data, Audit의 6개 레이어로 중첩 방어하는 전략. |
| **Least Privilege (최소 권한)** | 각 컴포넌트가 필요한 최소한의 권한만 보유하는 보안 원칙. API Key는 특정 프로젝트에만, Database 접근은 읽기/쓰기 분리 등. |
| **Rate Limiting** | 단위 시간당 API 요청 수를 제한하는 메커니즘. Free tier는 분당 60건, Pro tier는 분당 1,000건으로 제한된다. |
| **Anomaly Detection (이상 탐지)** | 정상 패턴 대비 비정상적인 지출/요청 패턴을 자동 탐지하여 알림하는 기능. 설정된 편차(예: 200% = 평소 2배) 초과 시 Webhook으로 알림을 발송한다. |
| **Row-Level Security (RLS)** | PostgreSQL의 행 단위 접근 제어. 사용자가 자신의 프로젝트 데이터만 조회할 수 있도록 보장한다. |
| **Approval Workflow (승인 워크플로우)** | 고액 결제 요청 시 자동으로 관리자 승인을 요청하는 프로세스. 설정된 임계값(threshold) 초과 시 Webhook을 호출하여 승인/거절을 대기한다. |

---

## 비즈니스 용어

| 용어 | 정의 |
|------|------|
| **Freemium** | 기본 기능을 무료로 제공하고 고급 기능을 유료화하는 비즈니스 모델. Pag0는 Free(1,000 req/day), Pro($49/월), Enterprise($299/월) 3개 티어를 운영한다. |
| **Savings Share** | 캐시 절감액의 15%를 Pag0가 수수료로 수취하는 수익 모델. 고객이 비용을 절감할 때만 Pag0도 수익을 얻는 Value-aligned pricing 구조이다. |
| **TAM (Total Addressable Market)** | 전체 시장 규모. API Management + AI Agent Payments 시장 합산 약 $20B (2028년 예상). |
| **SAM (Serviceable Addressable Market)** | 실제 접근 가능한 시장 규모. x402 Ecosystem + Enterprise AI Agents 시장 약 $2B/년. |
| **SOM (Serviceable Obtainable Market)** | 단기 획득 가능 시장 규모. Year 1 목표 ARR $1.17M (SAM의 0.58%). |
| **LTV (Lifetime Value)** | 고객 생애 가치. 한 고객이 서비스 이용 기간 동안 창출하는 총 수익. Pro tier LTV $16,133, Enterprise tier LTV $275,174. |
| **CAC (Customer Acquisition Cost)** | 고객 획득 비용. 한 명의 유료 고객을 확보하는 데 드는 비용. Pro tier CAC $150, Enterprise tier CAC $3,000. |
| **LTV/CAC** | 고객 생애 가치 대비 획득 비용 비율. SaaS 업계 기준 3x 이상이면 건강, 5x 이상이면 우수. Pag0 블렌디드 94.4x. |
| **MRR (Monthly Recurring Revenue)** | 월간 반복 수익. SaaS 비즈니스의 핵심 지표. |
| **ARR (Annual Recurring Revenue)** | 연간 반복 수익. MRR x 12로 산출. Year 1 목표 $1.31M. |
| **ARPU (Average Revenue Per User)** | 사용자당 평균 수익. Pro tier ARPU $949/월 (구독 $49 + Savings Share $900). |
| **NPS (Net Promoter Score)** | 고객 추천 의향 점수 (-100 ~ +100). Phase 1 목표 NPS 50+. |
| **MAU (Monthly Active Users)** | 월간 활성 사용자 수. 해커톤 이후 3개월 내 100 MAU 달성 목표. |
| **Churn Rate** | 고객 이탈률. Pro tier 월 5%, Enterprise tier 월 3% 가정. |
| **Payback Period** | CAC 회수 기간. Pag0 블렌디드 0.22개월 (약 6.6일). |
| **Product-Market Fit (PMF)** | 제품이 시장의 니즈를 충족하는 상태. Phase 1의 핵심 검증 목표. |
| **Blue Ocean Strategy** | 경쟁이 없는 새로운 시장을 창출하는 전략. Pag0는 x402 생태계에서 Proxy/Control 레이어라는 공백 시장을 선점한다. |
| **Data Moat (데이터 해자)** | 축적된 사용 데이터가 후발 주자의 진입을 어렵게 만드는 경쟁 우위. 더 많은 프록시 요청 → 더 정확한 큐레이션 → 더 많은 사용자의 선순환 구조. |
| **Network Effect (네트워크 효과)** | 사용자가 증가할수록 서비스 가치가 높아지는 현상. Pag0의 큐레이션 품질은 사용량 데이터에 비례하여 향상된다. |

---

## 생태계 / 파트너

| 용어 | 정의 |
|------|------|
| **x402 Bazaar** | x402 생태계의 서비스 디스커버리 플랫폼. Facilitator 중심으로 x402 서비스 목록과 검색 기능을 제공한다. Pag0와 보완재 관계. |
| **SlinkyLayer** | x402 생태계의 평판 시스템 + 마켓플레이스. ERC-8004 표준 기반 평판 시스템과 pSLINKY 토큰을 운영한다. 주관적 리뷰 기반 (vs Pag0의 객관적 데이터 기반). |
| **Virtuals G.A.M.E. SDK** | 게임 에이전트 생성 SDK. Pag0와 통합하여 게임 에이전트의 API 지출 관리 유스케이스를 지원한다. |
| **Google ADK (Agent Development Kit)** | Google의 AI 에이전트 개발 키트. Pag0 데모에서 에이전트 오케스트레이션 시나리오에 사용된다. |
| **Claude Code** | Anthropic의 AI 코딩 도구. AI 에이전트 개발 워크플로우에서 Pag0와 함께 활용되는 도구 중 하나. |
| **MCP (Model Context Protocol)** | AI 모델과 외부 도구 간의 상호작용 프로토콜. MCP Server를 통해 AI 에이전트가 API를 호출할 때 Pag0로 비용을 관리할 수 있다. |
| **MCP Server** | MCP 프로토콜을 구현하는 서버. AI 에이전트가 외부 도구/API에 접근하는 인터페이스를 제공하며, Pag0 프록시와 연동하여 비용 최적화가 가능하다. |
| **LangChain** | LLM 기반 애플리케이션 개발 프레임워크. Pag0 SDK와 공식 통합을 통해 에이전트의 x402 비용을 자동 관리한다. |
| **CrewAI** | 멀티 에이전트 오케스트레이션 프레임워크. Pag0 SDK 통합 대상. |

---

## 규제 / 컴플라이언스

| 용어 | 정의 |
|------|------|
| **EU AI Act** | 유럽연합의 AI 규제법. 2026년 8월 발효 예정. AI 에이전트의 자율적 금융 활동에 감사 추적 및 지출 통제를 요구한다. |
| **Colorado AI Act** | 미국 콜로라도주의 AI 규제법. 2026년 6월 발효 예정. AI 시스템의 투명성과 책임성을 요구한다. |
| **SOC2** | Service Organization Control 2. SaaS 기업의 보안/가용성/기밀성을 인증하는 표준. Year 2 취득 목표. |
| **ISO 27001** | 정보보안 경영시스템 국제 표준. Enterprise 고객 대응을 위해 Year 2 취득 목표. |
| **Agentic Commerce** | AI 에이전트가 자율적으로 결제/거래를 수행하는 상거래 패러다임. Visa TAP, Google AP2, PayPal Agentic 등이 2025년 론칭. |

---

## 메트릭 / 성능 지표

| 용어 | 정의 |
|------|------|
| **Cache Hit Rate (캐시 적중률)** | 전체 요청 중 캐시에서 응답을 제공한 비율. Pag0 목표 40% 이상. 높을수록 비용 절감 효과가 크다. |
| **P50 / P95 / P99 Latency** | 각각 50번째, 95번째, 99번째 백분위수 응답 시간(밀리초). P95 기준 Cache Hit <10ms, Cache Miss <200ms, 전체 API <300ms 목표. |
| **Success Rate (성공률)** | 전체 요청 중 2xx 상태 코드를 반환한 비율. Curation Engine의 신뢰도 점수 산출에 사용된다. |
| **TTL (Time To Live)** | 캐시 항목의 유효 시간(초). 만료 후 자동 삭제되며, 엔드포인트별 커스텀 TTL 설정이 가능하다. 기본값 300초(5분). |
| **Uptime** | 서비스 가용 시간 비율. 목표 99.9%. |
| **Rule of 40** | SaaS 기업의 건강도 지표. 매출 성장률(%) + 이익률(%)이 40 이상이면 우수. Pag0 목표 70+. |
| **Magic Number** | SaaS 영업 효율 지표. 신규 ARR / 전분기 S&M 비용. 0.75 이상이면 효율적. Pag0 목표 1.5. |
| **Net Revenue Retention (NRR)** | 기존 고객 기반의 순매출 유지율. 100% 이상이면 기존 고객의 매출 확장이 이탈을 상회. Pag0 목표 120%+. |

---

**Version**: 1.0
**Last Updated**: 2026-02-10
