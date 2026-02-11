# Pag0 Smart Proxy - 피치 스크립트 및 데모

> **TL;DR**: Pag0 해커톤 발표용 5분 피치 스크립트, 90초 라이브 데모 시나리오, Q&A 예상 질문/답변을 포함합니다. "x402가 결제를 해결했지만 지출 관리는 없다"는 핵심 메시지로 3-in-1 Smart Proxy Layer를 소개합니다.

## 관련 문서

- [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md) - 제품 개요
- [03-TECH-SPEC.md](03-TECH-SPEC.md) - 기술 사양
- [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) - 비즈니스 모델
- [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) - 유스케이스
- [07-02-PITCH-PREPARATION.md](07-02-PITCH-PREPARATION.md) - 발표 준비 및 체크리스트

---

## Part 1: 피치 발표 스크립트 (5분)

---

### Slide 1: Hook - "x402가 놓친 한 가지" (30초)

**화면 표시:**

```
"x402가 AI 에이전트 결제를 해결했습니다.
하지만 한 가지를 놓쳤습니다."

→ 지출 관리는요?
```

**발표 대사:**

"여러분, Coinbase의 x402 프로토콜이 AI 에이전트 결제 문제를 해결했습니다. HTTP 402 Payment Required를 통해 에이전트가 API를 호출할 때마다 자동으로 결제할 수 있게 됐죠.

하지만 한 가지 중요한 걸 놓쳤습니다. 바로 '지출 관리'입니다. 에이전트가 폭주하면? 동일한 요청을 계속 반복하면? 어떤 API가 진짜 좋은 건지 어떻게 알죠?

x402는 '결제 수단'을 제공했지만, '지출 통제'는 없습니다. 마치 신용카드는 줬는데 한도나 사용 내역 관리는 안 해주는 거죠."

**전환 멘트:**
"실제로 이게 얼마나 심각한 문제인지 보시죠."

---

### Slide 2: 문제 정의 - 3가지 문제 (30초)

**화면 표시:**

```
Problem 1: 과다지출 위험
- 에이전트 폭주 시 무제한 지출
- 실제 사례: GPT 에이전트 1시간에 $847 소진

Problem 2: 중복 결제 낭비
- 동일 요청 반복 → 매번 결제
- 평균 40%가 중복 호출 (OpenAI API 분석)

Problem 3: 선택 근거 부재
- 100개 번역 API 중 뭐가 좋은지 모름
- 마케팅 자료만 있고 실사용 데이터 없음
```

**발표 대사:**

"세 가지 구체적인 문제가 있습니다.

첫째, 과다지출 위험. 에이전트가 버그로 폭주하면 지출이 통제 불가능합니다. 실제로 어떤 개발자는 GPT 에이전트가 1시간 만에 847달러를 써버린 사례가 있었습니다.

둘째, 중복 결제 낭비. 에이전트는 동일한 번역 요청을 하루에도 수백 번 반복합니다. 그런데 매번 결제를 하죠. OpenAI API 분석 결과, 평균 40%가 중복 호출이었습니다.

셋째, 선택 근거 부재. x402 Bazaar에 번역 API가 100개 있다고 칩시다. 어떤 걸 써야 할까요? 마케팅 자료만 있고 실제 사용 데이터는 없습니다."

**전환 멘트:**
"이 세 문제를 동시에 해결하는 솔루션을 만들었습니다."

---

### Slide 3: 솔루션 - Pag0 Smart Proxy (45초)

**화면 표시:**

```
Pag0 = The Smart Proxy Layer for x402

3-in-1 가치 제안:

Spend Firewall
→ 요청당/일일/월별 예산 정책
→ 승인 워크플로우

Data-Driven Curation
→ 실사용 데이터로 API 평가
→ 비용/속도/신뢰도 기반 추천

Smart Cache
→ 중복 결제 40% 차단
→ Redis 기반 TTL 캐싱

포지셔닝: "The Smart Proxy Layer for x402"
(비유: Auth0가 OAuth 위 Identity Platform인 것처럼)
```

**발표 대사:**

"Pag0 Smart Proxy는 x402 위에 올라가는 intelligent proxy layer입니다.

세 가지 핵심 가치를 제공합니다.

첫째, Spend Firewall. 에이전트가 x402 호출할 때 우리 프록시를 거치면서 정책 검사를 합니다. 요청당 최대 1달러, 하루 최대 10달러 같은 룰을 설정하면 초과 시 자동 차단합니다.

둘째, Data-Driven Curation. 가장 혁신적인 부분인데요, Pag0를 통과하는 모든 요청의 실제 비용, 응답 속도, 성공률을 수집합니다. 그래서 '번역 API 추천해줘'라고 물으면 실사용 데이터 기반으로 점수를 매겨서 답해줍니다.

셋째, Smart Cache. 동일한 요청은 캐시에서 꺼내줍니다. 실제 결제는 안 하고요. 40% 이상 비용 절감 효과가 있습니다.

우리는 x402 위에서 Smart Proxy Layer를 만듭니다. Auth0가 OAuth 프로토콜 위에 Identity Platform을 만든 것처럼, 우리는 x402 프로토콜 위에 Payment Control Platform을 만듭니다."

**전환 멘트:**
"어떻게 작동하는지 보여드리겠습니다."

---

### Slide 4: 작동 방식 - Architecture (45초)

**화면 표시:**

```
Flow:

Agent → Pag0 Proxy → x402 Server
         ↓
    [Policy Check]
    [Cache Check]
    [Analytics Collect]
         ↓
    Agent ← Response + Meta

Key Point:
프록시는 결제 서명을 안 합니다.
Agent가 서명한 Payment를 릴레이만 합니다.

Tech Stack:
- Bun/Hono (Proxy Core)
- Redis/Upstash (Cache)
- PostgreSQL/Supabase (Analytics)
- SKALE (Zero Gas Payment)
```

**발표 대사:**

"Architecture는 간단합니다.

에이전트가 API를 호출할 때, 직접 x402 서버로 가는 게 아니라 Pag0 프록시를 거칩니다.

프록시는 세 가지 일을 합니다. 첫째, 캐시 체크. 이미 같은 요청이 있으면 바로 응답. 둘째, 없으면 x402 서버로 포워딩. 셋째, 402 Payment Required 응답이 오면 정책 검사. 예산 초과면 차단, 괜찮으면 에이전트에게 전달.

여기서 중요한 포인트 하나. 프록시는 절대 결제 서명을 안 합니다. 에이전트가 직접 서명한 Payment Payload를 릴레이만 합니다. 보안 무결성이 유지되죠.

응답이 오면 캐시에 저장하고, 분석 데이터 수집하고, 에이전트한테 메타 정보와 함께 응답을 줍니다.

기술 스택은 Bun과 Hono로 프록시 코어, Redis로 캐싱, PostgreSQL로 분석 데이터, 그리고 결제는 SKALE의 Zero Gas를 활용합니다."

**전환 멘트:**
"실제로 작동하는 모습을 보여드리겠습니다."

---

### Slide 5: 라이브 데모 (90초)

**화면 표시:**

```
Live Demo 시나리오:

1. 에이전트가 번역 API 3종 호출 (각 10회)
   → 실시간 분석 데이터 수집

2. 큐레이션 API 호출: "추천해줘"
   → DeepL 추천 (점수 87/100)

3. 정책 위반 트리거
   → 예산 초과 차단

4. 대시보드
   → API 랭킹 보드
   → 비용 절감 차트
```

**발표 대사:**

"이제 라이브 데모 보시죠.

[Demo 1 - 30초: API 호출 및 분석]
자, 여기 간단한 AI 에이전트가 있습니다. 번역 작업을 하는데, DeepL, OpenAI, Google 세 API를 각각 10번씩 호출합니다. Pag0 SDK로 감싸져 있죠.

실행합니다. 보시면 첫 요청은 캐시 미스, 실제 결제가 일어나고... 두 번째부터는 캐시 히트, 결제 안 일어납니다. 오른쪽 터미널에 실시간으로 분석 데이터가 쌓이는 게 보이시죠? 비용, latency, 성공률 모두 기록됩니다.

[Demo 2 - 30초: 큐레이션 추천]
자, 이제 에이전트가 묻습니다. '번역 API 중 비용 효율적인 걸 추천해줘'. Pag0의 recommend API를 호출하면... 짜잔! DeepL을 추천합니다. 점수 87점. 왜냐고요? 실제 사용 데이터를 보면 DeepL이 비용은 OpenAI의 60%인데 신뢰도는 98%거든요. 이게 바로 data-driven curation입니다.

[Demo 3 - 15초: 정책 차단]
이번엔 정책 위반을 트리거해보겠습니다. 일일 예산을 10달러로 설정했는데, 억지로 50번 더 호출하면... 보세요, 차단됩니다. '일일 예산 초과' 에러. Spend Firewall이 작동한 겁니다.

[Demo 4 - 15초: 대시보드]
마지막으로 대시보드입니다. API 랭킹 보드에 실시간으로 세 API의 점수가 업데이트되고, 비용 절감 차트를 보면... 30번 호출에 20번이 캐시 히트. 12달러 절감했네요."

**전환 멘트:**
"이게 왜 지금 타이밍이 좋은지 말씀드리겠습니다."

---

### Slide 6: 시장 기회 - 타이밍과 기회 (30초)

**화면 표시:**

```
Market Timing:

x402 Ecosystem Gap
- Phase 1: 프로토콜 (x402)
- Phase 2: Facilitators (Bazaar, SlinkyLayer)
- Phase 3: Platforms ← Pag0가 채움

Proven Pattern
- Auth0: OAuth 위 Identity Platform
  → Okta가 $6.5B에 인수
- Pag0: x402 위 Payment Control Platform
  → 같은 패턴

Compliance Pressure
- EU AI Act (2026.8)
- Colorado AI Act (2026.6)
- 86% 기업이 컴플라이언스 필요

Agentic Commerce 폭발
- Visa TAP, Google AP2, PayPal Agentic
- 모두 2025년 론칭
```

**발표 대사:**

"시장 타이밍이 완벽합니다.

x402 생태계를 보면, Phase 1 프로토콜은 완성됐고, Phase 2 Facilitator들이 나오고 있습니다. Bazaar, SlinkyLayer 같은 거죠. 그런데 Phase 3, 즉 플랫폼 레이어는 비어있습니다. Pag0가 바로 여기를 채웁니다.

검증된 패턴이 있습니다. Auth0가 OAuth 프로토콜 위에 Identity Platform을 만들어서 Okta에 65억 달러에 인수됐죠. 우리는 x402 프로토콜 위에 Payment Control Platform을 만듭니다. 똑같은 패턴입니다.

컴플라이언스 압박도 옵니다. EU AI Act가 올해 8월, Colorado AI Act가 6월에 발효됩니다. 기업 86%가 AI 에이전트 도입에 컴플라이언스가 필수라고 답했습니다. 지출 관리와 감사 추적이 핵심이죠.

그리고 Agentic Commerce 시장이 폭발하고 있습니다. Visa TAP, Google AP2, PayPal Agentic 모두 2025년에 론칭했습니다. 파이가 커지고 있습니다."

**전환 멘트:**
"어떻게 돈을 벌 건지 보시죠."

---

### Slide 7: 비즈니스 모델 (20초)

**화면 표시:**

```
Freemium + Savings Share

Free Tier:
- 1,000 requests/day
- Basic policy
- 7-day analytics

Pro ($49/mo):
- 50K requests/day
- Advanced policies
- 90-day analytics
- Curation API

Enterprise ($299/mo):
- Unlimited
- Custom policies
- Compliance reports
- SLA

+ Cache Savings Share: 15%
  (절감액의 15% 공유)

Unit Economics:
- LTV/CAC = 5.2x
- Payback period = 4 months
```

**발표 대사:**

"비즈니스 모델은 Freemium plus Savings Share입니다.

Free tier는 하루 천 건, 기본 정책, 7일 분석. 개발자들이 시작하기 좋죠.

Pro는 월 49달러로 5만 건, 고급 정책, 큐레이션 API까지.

Enterprise는 299달러로 무제한, 커스텀 정책, 컴플라이언스 리포트.

여기에 독특한 게 Savings Share입니다. 캐시로 절감한 비용의 15%를 받습니다. 고객은 85% 이득, 우리는 15% 수익. Win-win이죠.

Unit economics도 건강합니다. LTV 대 CAC 비율이 5.2배, 회수 기간 4개월입니다."

**전환 멘트:**
"마지막으로 팀과 요청사항입니다."

---

### Slide 8: 팀 & 요청사항 (10초)

**화면 표시:**

```
Team:
- [Your Name] - x402 Ecosystem Contributor
- [Team Members]

Traction:
- Hackathon: 5 core modules working
- 4 demo scenarios validated
- 40%+ cache hit rate achieved

Ask:
- Hackathon 우승
- x402/SKALE 파트너십
- Seed funding conversation

Contact: [Email/Twitter]
```

**발표 대사:**

"저희 팀은 x402 생태계 컨트리뷰터들로 구성됐습니다.

해커톤 기간 동안 핵심 5개 모듈을 완성했고, 4개 데모 시나리오를 검증했으며, 40% 이상 캐시 히트율을 달성했습니다.

요청사항은 세 가지입니다. 해커톤 우승, x402와 SKALE 팀과의 파트너십, 그리고 시드 펀딩 대화 시작입니다.

감사합니다!"

---

## Part 2: 라이브 데모 스크립트 (90초)

### 사전 준비 체크리스트

```bash
# Terminal 1: Pag0 Proxy 서버 실행
cd pag0-proxy
bun run dev
# Expected: "Pag0 Proxy listening on :3000"

# Terminal 2: Analytics 대시보드
cd pag0-dashboard
bun run dev
# Expected: "Dashboard running on :3001"

# Terminal 3: Demo Agent 준비
cd demo-agent
# .env 파일 확인
# PAG0_API_KEY=pag0_demo_xxx
# PAG0_PROXY_URL=http://localhost:3000
```

### 데모 시나리오 1: API 호출 및 실시간 분석 (30초)

**목표**: 에이전트가 여러 번역 API를 호출하며 실시간 분석 데이터가 쌓이는 것 보여주기

**단계별 실행**:

```bash
# Terminal 3에서 실행
bun run demo:translation

# Expected Output:
# [Pag0] Translating "Hello World" via DeepL...
# Response received (cached: false, cost: 100000, latency: 234ms)
# [Pag0] Translating "Hello World" via OpenAI...
# Response received (cached: false, cost: 150000, latency: 189ms)
# [Pag0] Translating "Hello World" via Google...
# Response received (cached: false, cost: 80000, latency: 312ms)
#
# [Pag0] Repeating same translations... (2nd round)
# DeepL cached: true, cost: 0, savings: 100000
# OpenAI cached: true, cost: 0, savings: 150000
# Google cached: true, cost: 0, savings: 80000
#
# Total: 9 requests, 6 cached (66.7%), saved: 660000 ($0.66)
```

**발표 대사**:
"자, 에이전트가 세 가지 번역 API를 각각 세 번씩 호출합니다. 첫 번째 라운드는 캐시 미스, 실제 결제가 일어나고... 두 번째부터는 캐시 히트, 결제 안 일어납니다. 총 9건 중 6건이 캐시 히트, 66센트 절감했습니다."

**대시보드 확인** (브라우저):

- <http://localhost:3001/analytics> 접속
- Real-time request graph에 9개 점이 찍힘
- Cache hit rate: 66.7% 표시
- Cost savings: $0.66 표시

---

### 데모 시나리오 2: 큐레이션 추천 (30초)

**목표**: 실사용 데이터 기반 API 추천

**단계별 실행**:

```bash
# Terminal 3에서 실행
bun run demo:recommend

# Expected Output:
# [Pag0] Asking: "Recommend the best cost-effective translation API"
#
# Recommendation Result:
#
# Rank 1: DeepL API (Score: 87/100)
# |- Cost Efficiency: 92/100 (avg $0.10/req vs $0.15 baseline)
# |- Reliability: 98% success rate (147/150 requests)
# +- Latency: 71/100 (avg 234ms)
#
# Evidence (last 7 days):
# - Total requests via Pag0: 147
# - Avg cost per request: $0.10 USDC
# - Avg latency: 234ms
# - Success rate: 98.0%
# - Cache hit rate: 68%
#
# Rank 2: Google Translate (Score: 79/100)
# |- Cost Efficiency: 98/100 (avg $0.08/req)
# |- Reliability: 94% success rate
# +- Latency: 45/100 (avg 312ms - slower)
#
# Rank 3: OpenAI Translation (Score: 73/100)
# |- Cost Efficiency: 65/100 (avg $0.15/req - expensive)
# |- Reliability: 99% success rate
# +- Latency: 85/100 (avg 189ms)
```

**발표 대사**:
"이제 에이전트가 묻습니다. '비용 효율적인 번역 API 추천해줘'. Pag0의 recommend API를 호출하면... DeepL 1위, 87점. 왜냐? 실제 데이터를 보면 DeepL이 요청당 10센트로 OpenAI의 67%인데 신뢰도는 98%. Google이 더 저렴하지만 느려요. 이게 data-driven curation입니다."

**대시보드 확인**:

- <http://localhost:3001/curation> 접속
- API Ranking Board에 3개 API 점수 표시
- Evidence 데이터 차트 표시

---

### 데모 시나리오 3: 정책 위반 차단 (15초)

**목표**: Spend Firewall이 예산 초과 요청을 차단하는 것 보여주기

**단계별 실행**:

```bash
# Terminal 3에서 실행
bun run demo:policy-violation

# Expected Output:
# [Pag0] Policy: dailyBudget = 1000000 ($1.00)
# [Pag0] Current spent today: 330000 ($0.33)
#
# [Pag0] Calling expensive API 10 times... (each costs $0.15)
# Request 1/10: Success (spent: $0.48)
# Request 2/10: Success (spent: $0.63)
# Request 3/10: Success (spent: $0.78)
# Request 4/10: Success (spent: $0.93)
# Request 5/10: BLOCKED!
#
# Error: Daily budget exceeded
# {
#   "error": "POLICY_VIOLATION",
#   "reason": "Daily budget limit reached",
#   "limit": "1000000",
#   "spent": "930000",
#   "requested": "150000"
# }
```

**발표 대사**:
"일일 예산을 1달러로 설정했습니다. 이미 33센트 썼고, 비싼 API를 10번 호출하면... 4번까지는 성공, 5번째에서 차단됩니다. '일일 예산 초과' 에러. Spend Firewall이 작동한 겁니다."

---

### 데모 시나리오 4: 대시보드 종합 (15초)

**목표**: 모든 분석 데이터를 한눈에 보여주기

**브라우저 시연**:

1. <http://localhost:3001/dashboard> 접속
2. Overview 탭:
   - Total Requests: 26
   - Cache Hit Rate: 65.4%
   - Total Cost: $2.81
   - Total Savings: $1.23
3. API Ranking 탭:
   - 실시간 점수 업데이트되는 차트
   - DeepL (87) > Google (79) > OpenAI (73)
4. Cost Analysis 탭:
   - 시간대별 비용 절감 그래프
   - 캐시 히트/미스 파이 차트

**발표 대사**:
"대시보드를 보시면, 총 26건 요청, 65% 캐시 히트율, 1.23달러 절감. API 랭킹 보드에 실시간 점수, 비용 분석 차트까지. 모든 게 실사용 데이터 기반입니다."

---

### Fallback Plan (라이브 데모 실패 시)

**시나리오 A: 네트워크 이슈**

- 미리 녹화한 데모 비디오 재생 (90초 버전)
- "네트워크 이슈로 비디오로 보여드리겠습니다"
- 비디오 경로: `/demo-assets/pag0-demo-full.mp4`

**시나리오 B: 서버 크래시**

- 스크린샷 슬라이드로 대체
- 각 데모 단계별 스크린샷 4장 준비
- "실행 결과 화면을 보여드리겠습니다"

**시나리오 C: 데이터 없음 (콜드 스타트)**

- Seed data 스크립트 실행

```bash
bun run seed:demo-data
# 30초 안에 샘플 데이터 생성
```

**긴급 대응 우선순위**:

1. 비디오 재생 (가장 안전)
2. 스크린샷 + 설명
3. 코드 + 예상 결과 설명

---

## Part 3: Q&A 예상 질문 및 모범 답변

### Q1: "SlinkyLayer와 어떻게 다른가요?"

**답변**:

"좋은 질문입니다. SlinkyLayer와는 세 가지 차이가 있습니다.

첫째, 데이터 소스. SlinkyLayer는 유저 리뷰 기반 평판 시스템입니다. 주관적이죠. Pag0는 실제 API 호출 데이터 기반입니다. 객관적입니다. 비용, latency, 성공률을 직접 측정하죠.

둘째, 기능 범위. SlinkyLayer는 마켓플레이스와 평판 시스템에 집중합니다. Pag0는 지출 관리, 큐레이션, 캐싱을 모두 제공합니다. 더 넓은 문제를 풉니다.

셋째, 포지셔닝. SlinkyLayer는 Facilitator 레이어입니다. Pag0는 Platform 레이어입니다. 사실 상호 보완적입니다. SlinkyLayer에서 API를 발견하고, Pag0로 비용 관리하며 사용하면 시너지가 나죠.

경쟁이 아니라 협력 관계입니다."

**보충 자료 (슬라이드)**:

```
SlinkyLayer vs Pag0:

SlinkyLayer (Facilitator):
- User reviews (subjective)
- Marketplace + ERC-8004 reputation
- Discovery focus

Pag0 (Platform):
- Real usage data (objective)
- Spend control + Curation + Cache
- Management focus

→ Complementary, not competitive
```

---

### Q2: "x402 Bazaar가 이미 Discovery를 제공하는데, 왜 Pag0가 필요한가요?"

**답변**:

"Bazaar는 훌륭한 디스커버리 플랫폼입니다. 하지만 디스커버리 '이후'가 문제죠.

Bazaar에서 API를 찾았다고 칩시다. 이제 사용 단계입니다. 여기서 세 가지 질문이 생깁니다.

하나, 이 API가 우리 예산에 맞나? Bazaar는 모르죠.
둘, 실제로 써보니 어떤가? 마케팅 자료만 있지 실사용 데이터는 없습니다.
셋, 비슷한 API 10개 중 뭐가 제일 나은가? Bazaar는 리스트만 보여줍니다.

Pag0는 바로 이 '사용 단계'의 문제를 풉니다. Bazaar가 'what's available'을 보여준다면, Pag0는 'what's best for you'를 알려줍니다.

Discovery + Management = 완전한 솔루션. Bazaar와 파트너십을 하면 시너지가 극대화됩니다."

---

### Q3: "캐싱이 x402 결제 무결성에 영향 안 주나요? 서버가 돈을 못 받는 거 아닌가요?"

**답변**:

"아주 중요한 보안 질문입니다. 답은 '영향 없다'입니다. 세 가지 이유가 있습니다.

첫째, 캐시는 선택적입니다. API 제공자가 x402 응답 헤더에 `Cache-Control: no-cache`를 설정하면 Pag0는 캐싱 안 합니다. 제공자가 통제권을 갖습니다.

둘째, 캐시 정책은 사용자가 설정합니다. 에이전트 개발자가 'TTL 300초'로 설정했다면, 그건 개발자의 선택입니다. 서버 입장에서는 같은 클라이언트가 5분 안에 재요청 안 한 거나 마찬가지죠.

셋째, 첫 요청은 항상 실제 결제가 일어납니다. 캐시는 중복 요청만 막습니다. 서버는 첫 요청에 대한 정당한 대가를 받습니다.

오히려 서버에게도 이득입니다. 불필요한 중복 요청이 줄어서 서버 부하가 감소하거든요. Win-win입니다."

**보충 자료**:

```
Cache Integrity Safeguards:

1. Server Control:
   Cache-Control header respected

2. Client Choice:
   User-configured TTL

3. Fair Payment:
   First request always paid
   Only duplicates cached

4. Server Benefit:
   Reduced load from duplicate requests
```

---

### Q4: "비즈니스 모델이 지속 가능한가요? Savings Share 15%가 충분한 수익인가요?"

**답변**:

"Unit economics를 보시면 충분히 지속 가능합니다.

시뮬레이션을 해볼까요? Pro tier 고객 한 명이 하루 10,000 요청을 합니다.

캐시 히트율 40% 가정 시, 하루 4,000건이 캐시됩니다.
평균 요청당 비용이 $0.05라면, 하루 절감액은 $200입니다.
우리가 받는 Savings Share 15%는 $30입니다.
월 30일이면 $900입니다.

고객은 월 $49를 내고 $5,100 절감합니다. (ROI 104배)
우리는 월 $949를 벌죠. ($49 subscription + $900 savings share)

게다가 subscription revenue는 안정적 MRR이고, savings share는 usage-based upside입니다.

CAC가 $200이고 LTV가 $11,388이면 (12개월 기준), LTV/CAC 비율이 56배입니다.

충분히 지속 가능하고, 오히려 매우 건강한 economics입니다."

**보충 자료**:

```
Sample Customer Economics:

Assumptions:
- 10,000 requests/day
- 40% cache hit rate
- $0.05 avg cost per request

Customer Perspective:
- Monthly savings: $6,000
- Subscription cost: $49
- Net benefit: $5,951
- ROI: 121x

Pag0 Revenue:
- Subscription: $49/mo
- Savings share (15%): $900/mo
- Total: $949/mo
- Annual LTV: $11,388

Economics:
- CAC: ~$200
- LTV/CAC: 56x
- Payback: <3 weeks
```

---

### Q5: "보안 문제는 없나요? Proxy가 결제를 중간에서 가로챌 수 있지 않나요?"

**답변**:

"보안은 우리 아키텍처의 핵심 원칙입니다. 명확히 말씀드리면, Pag0 프록시는 절대 결제를 '서명'하지 않습니다.

작동 방식은 이렇습니다.

1. 에이전트가 API 호출 → Pag0 프록시
2. 프록시가 x402 서버로 포워딩
3. 서버가 402 Payment Required 응답 + Payment Request
4. 프록시가 Payment Request를 에이전트에게 릴레이
5. 에이전트가 자기 지갑으로 직접 서명
6. 프록시가 서명된 Payment Payload를 서버로 릴레이
7. Facilitator가 서명 검증

프록시는 단순 메신저입니다. 에이전트의 private key를 절대 모릅니다. 서명도 안 합니다. 그냥 전달만 합니다.

이건 x402 프로토콜 스펙을 100% 준수하는 겁니다. 기존 x402 보안 모델이 그대로 유지됩니다.

오히려 정책 검사를 통해 보안을 강화합니다. 에이전트가 악성 서버한테 유인당해도, Pag0가 예산 초과를 차단하죠."

**보충 자료**:

```
Security Architecture:

Proxy Role: RELAY ONLY
- Never signs payments
- Never holds private keys
- Never modifies payment payloads

Payment Flow:
Agent → Pag0 → Server (request)
Server → Pag0 → Agent (402 + PayReq)
Agent signs with own wallet
Agent → Pag0 → Facilitator (signed Payment)
Facilitator verifies signature ← Agent's key

Additional Security:
+ Policy enforcement (budget limits)
+ Anomaly detection
+ Whitelist/blacklist
+ Audit trail
```

---

### Q6: "해커톤 이후 로드맵은 어떻게 되나요?"

**답변**:

"3단계 로드맵이 있습니다.

Phase 1 (해커톤 ~ 3개월): Community Adoption

- 목표: x402 개발자 커뮤니티에서 검증
- 오픈소스 SDK 공개, 프리 티어 제공
- Bazaar, SlinkyLayer와 파트너십 시작
- 100 MAU, 100K requests/day 달성

Phase 2 (3-6개월): Enterprise Pilot

- 목표: 유료 전환 검증
- Pro tier 론칭, enterprise pilot 5곳
- 컴플라이언스 기능 강화 (EU AI Act 대응)
- $10K MRR 달성

Phase 3 (6-12개월): Platform Expansion

- 목표: x402 생태계의 필수 인프라로 자리잡기
- Enterprise tier, white-label 옵션
- The Graph subgraph로 온체인 분석 제공
- Virtuals G.A.M.E. SDK 통합으로 게임 에이전트 지원
- $100K MRR, Seed 라운드

핵심은 'ecosystem play'입니다. x402, SKALE, The Graph, Virtuals 모두와 협력해서 생태계 전체를 키웁니다."

---

### Q7: "경쟁자가 나오면 어떻게 방어하나요?"

**답변**:

"세 가지 방어벽이 있습니다.

첫째, Data Moat. 우리가 먼저 시작할수록 더 많은 실사용 데이터가 쌓입니다. 큐레이션 품질은 데이터 양에 비례하죠. 선발 주자 이점이 명확합니다.

둘째, Ecosystem Integration. x402, SKALE, The Graph, Virtuals와 깊게 통합합니다. 이게 스폰서들과의 파트너십 이점입니다. 후발 주자는 이 관계를 복제하기 어렵습니다.

셋째, Network Effect. 더 많은 에이전트가 쓸수록 큐레이션 데이터가 정교해지고, 정교할수록 더 많은 에이전트가 씁니다. 양의 피드백 루프죠.

그리고 솔직히, 경쟁은 환영입니다. 시장 검증이거든요. Auth0도 경쟁자 수십 개 있었지만 1위를 지켰습니다. 실행력 차이죠."

---

### Q8: "x402가 실패하면 어떻게 하나요? 의존도가 너무 높지 않나요?"

**답변**:

"리스크 맞습니다. 하지만 두 가지 측면에서 괜찮다고 봅니다.

첫째, x402는 Coinbase가 밀고 있습니다. Coinbase의 리소스와 생태계를 고려하면 실패 확률이 낮습니다. 그리고 이미 Phase 2까지 왔습니다. Facilitator들이 움직이고 있어요.

둘째, 기술적으로 우리는 'HTTP 402 Payment Required' 표준 위에 있습니다. x402만의 이야기가 아니에요. 402pay, h402, x4Pay 같은 다른 구현체도 있습니다. 필요하면 멀티 프로토콜 지원으로 피봇할 수 있습니다.

셋째, 최악의 경우 피봇 옵션이 있습니다. 우리 핵심은 'AI agent spend management'입니다. x402 없어도 Anthropic MCP, OpenAI Assistants API 같은 다른 에이전트 프레임워크에 적용 가능합니다.

물론 x402 성공이 베스트 시나리오입니다. 하지만 all-in은 아닙니다."

---

### Q9: "왜 지금 이걸 해야 하나요? 1년 후에 해도 되지 않나요?"

**답변**:

"First-mover advantage 타이밍이 지금입니다.

x402가 Phase 2에서 Phase 3로 넘어가는 순간이 바로 지금입니다. Bazaar가 나오고, SlinkyLayer가 나오고, Facilitator들이 움직이기 시작했어요. Platform 레이어는 아직 비어있습니다.

1년 후면 누군가 이미 차지하고 있을 겁니다. Data moat는 시간에 비례합니다. 1년 늦으면 1년치 데이터 차이가 나죠.

그리고 컴플라이언스 압박이 올해 8월부터 시작됩니다. EU AI Act 발효죠. 기업들이 지금 솔루션을 찾고 있습니다. 타이밍이 완벽합니다.

Coinbase도 x402를 지금 푸시하고 있습니다. SKALE도 Zero Gas를 지금 홍보하고 있고요. 생태계 모멘텀이 지금 모이고 있습니다.

지금 안 하면 기회가 닫힙니다."

---

### Q10: "수익화까지 얼마나 걸리나요? Burn rate은?"

**답변**:

"보수적으로 12개월 안에 수익화 가능합니다.

Phase 1 (0-3개월): $0 MRR, Free tier로 트래픽 모으기
Phase 2 (3-6개월): $10K MRR, Pro tier 전환율 5% 가정
Phase 3 (6-12개월): $100K MRR, Enterprise tier + volume discount

Burn rate은 매우 낮습니다. 2명 창업자, 클라우드 비용 월 $500, 마케팅 $1K. 월 $15K면 충분합니다.

Seed 라운드 $500K 유치하면 33개월 런웨이입니다. 12개월 안에 수익화하면 21개월 남죠. 충분한 버퍼입니다.

그리고 해커톤 상금으로 초기 6개월은 커버됩니다. 리스크가 낮습니다."

**보충 자료**:

```
12-Month Revenue Projection:

Month 0-3 (Community):
- Users: 0 → 100 MAU
- MRR: $0
- Focus: Adoption

Month 3-6 (Monetization):
- Users: 100 → 500 MAU
- Pro conversion: 5%
- MRR: $0 → $10K

Month 6-12 (Scale):
- Users: 500 → 2000 MAU
- Enterprise: 5 customers
- MRR: $10K → $100K

Break-even: Month 8
Burn rate: $15K/mo
Seed needed: $500K
Runway: 33 months
```

---

## 관련 문서 참조

- [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md) - 제품 개요 및 핵심 기능
- [03-TECH-SPEC.md](03-TECH-SPEC.md) - 시스템 아키텍처 상세
- [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) - 수익 모델 및 재무 프로젝션
- [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) - 유스케이스 및 활용 시나리오
- [07-02-PITCH-PREPARATION.md](07-02-PITCH-PREPARATION.md) - 발표 준비, 심사위원 설득 전략, 최종 체크리스트

---

**Version**: 1.0
**Last Updated**: 2026-02-10
