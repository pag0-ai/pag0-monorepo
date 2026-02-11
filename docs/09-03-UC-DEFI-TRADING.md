# UC3: DeFi 트레이딩 에이전트

← [UC2: 엔터프라이즈 팀 관리](09-02-UC-ENTERPRISE.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC4 →](09-04-UC-MCP-ORCHESTRATION.md)

---

> **TL;DR**: 차익거래 봇 "ArbitrageBot"이 초당 10-100건의 API 요청을 처리하면서, Pag0의 초엄격 Spend Firewall(시간당 $0.50 한도), 화이트리스트(악성 API 차단), 이상 탐지(Honeypot/무한루프/가스비 조작 공격 방어)로 버그 손실을 99.8% 방지하는 보안 중심 사례입니다.

---

## 시나리오

**배경**:

- 차익거래 봇 "ArbitrageBot"
- DEX 가격 데이터 API, 가스 추정 API, 라우팅 API 사용
- 빠른 의사결정 필요 (초당 10-100 요청)
- 악성 API 서버의 유인 공격 위험

**문제점 (Without Pag0)**:

```yaml
폭주 위험:
  - 버그로 무한 루프 시 무제한 지출
  - 2023년 사례: 봇이 10분에 $3,200 소진

악성 공격:
  - 가짜 저가 정보 제공 → 봇 유인
  - 고액 API 응답 → 지갑 고갈

감시 부재:
  - 비정상 패턴 감지 불가
  - 실시간 차단 메커니즘 없음
```

**솔루션 (With Pag0)**:

```typescript
// 1. 엄격한 정책 설정
import { createPag0Client } from "@pag0/sdk";

const arbitrageBot = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // 초엄격 Spend Firewall
  policy: {
    // 요청당 한도 (매우 낮게)
    maxPerRequest: "50000",         // 최대 $0.05/요청

    // 시간별 한도 (폭주 방지)
    hourlyBudget: "500000",         // 시간당 $0.50
    dailyBudget: "10000000",        // 일일 $10
    monthlyBudget: "250000000",     // 월 $250

    // 화이트리스트만 허용 (악성 API 차단)
    allowedEndpoints: [
      "api.coingecko.com",
      "api.1inch.io",
      "gas.etherscan.io",
      "router.uniswap.org"
    ],
    denyUnknownEndpoints: true,     // 미등록 API 전면 차단

    // 이상 탐지
    anomalyDetection: {
      enabled: true,

      // 급증 패턴 감지
      requestSpike: {
        threshold: 200,              // 분당 200건 초과 시
        window: "1m",
        action: "throttle"           // 속도 제한
      },

      // 비용 급증 감지
      costSpike: {
        threshold: 3.0,              // 평균의 3배 초과 시
        baseline: "1h",              // 1시간 평균 기준
        action: "alert_and_block"    // 알림 + 차단
      },

      // 새로운 엔드포인트 감지
      newEndpoint: {
        action: "require_approval"   // 승인 필요
      }
    },

    // 긴급 중단 (킬 스위치)
    killSwitch: {
      enabled: true,
      triggers: [
        "budget_90_percent",
        "anomaly_detected",
        "manual_trigger"
      ],
      cooldownPeriod: 300             // 5분 쿨다운
    }
  },

  // 캐싱 (가격 데이터는 짧게)
  cache: {
    enabled: true,
    customTTL: {
      "api.coingecko.com": 10,       // 가격은 10초만
      "gas.etherscan.io": 30,        // 가스는 30초
      "router.uniswap.org": 5        // 라우팅은 5초
    }
  },

  // 실시간 알림
  alerts: {
    channels: ["telegram", "sms"],   // 즉시 알림
    criticalOnly: true
  }
});

// 2. 트레이딩 로직 (보호된 API 호출)
async function checkArbitrageOpportunity(
  tokenA: string,
  tokenB: string
) {
  try {
    // 2.1. 가격 데이터 (빠른 캐시)
    const priceResponse = await arbitrageBot.fetch(
      `https://api.coingecko.com/v3/simple/price?ids=${tokenA},${tokenB}`,
      {
        method: "GET",

        // Pag0 메타: 중요도 표시
        pag0Meta: {
          priority: "high",
          criticality: "trading_decision",
          maxLatency: 100              // 100ms 초과 시 타임아웃
        }
      }
    );

    // 정책 위반 체크
    if (priceResponse.meta.policyViolation) {
      console.error("Policy violation:", priceResponse.meta.violation);
      // 트레이딩 중단
      return null;
    }

    const prices = await priceResponse.json();

    // 2.2. 차익 계산
    const spreadPct = calculateSpread(prices[tokenA], prices[tokenB]);

    if (spreadPct > 0.5) {  // 0.5% 이상 차익
      // 2.3. 가스비 추정
      const gasResponse = await arbitrageBot.fetch(
        "https://gas.etherscan.io/api/gastracker",
        { method: "GET" }
      );

      const gasPrice = await gasResponse.json();

      // 2.4. 최적 라우팅
      const routeResponse = await arbitrageBot.fetch(
        "https://router.uniswap.org/v2/quote",
        {
          method: "POST",
          body: JSON.stringify({
            tokenIn: tokenA,
            tokenOut: tokenB,
            amount: "1000000000000000000" // 1 ETH
          })
        }
      );

      const route = await routeResponse.json();

      // 총 비용 계산 (API 비용 포함)
      const apiCost =
        priceResponse.meta.cost +
        gasResponse.meta.cost +
        routeResponse.meta.cost;

      const profitAfterCosts =
        calculateProfit(route) - gasPrice.fee - apiCost;

      console.log("Trade analysis:", {
        spread: spreadPct,
        expectedProfit: profitAfterCosts,
        apiCost: apiCost,
        cached: {
          price: priceResponse.meta.cached,
          gas: gasResponse.meta.cached,
          route: routeResponse.meta.cached
        }
      });

      return profitAfterCosts > 0 ? route : null;
    }

    return null;

  } catch (error) {
    // Pag0 에러 핸들링
    if (error.code === "BUDGET_EXCEEDED") {
      console.error("⚠️ BUDGET EXCEEDED - Halting trading");
      await triggerKillSwitch();

    } else if (error.code === "ANOMALY_DETECTED") {
      console.error("🚨 ANOMALY DETECTED - Possible attack");
      await notifyAdmin({
        type: "security_alert",
        details: error.details,
        action: "trading_halted"
      });

    } else if (error.code === "ENDPOINT_BLOCKED") {
      console.error("❌ Blocked endpoint - check whitelist");
    }

    return null;
  }
}

// 3. 메인 트레이딩 루프
async function tradingLoop() {
  const pairs = [
    ["ethereum", "usd-coin"],
    ["bitcoin", "ethereum"],
    // ... 100+ pairs
  ];

  while (true) {
    for (const [tokenA, tokenB] of pairs) {
      const opportunity = await checkArbitrageOpportunity(tokenA, tokenB);

      if (opportunity) {
        await executeTrade(opportunity);
      }

      // Rate limiting (초당 10 요청)
      await sleep(100);
    }

    // 시간당 예산 체크
    const hourlyStatus = await arbitrageBot.getBudgetStatus("hourly");

    if (hourlyStatus.utilizationRate > 0.9) {
      console.log("⚠️ 90% hourly budget used - slowing down");
      await sleep(5000);  // 5초 대기
    }
  }
}

// 4. 킬 스위치 트리거
async function triggerKillSwitch() {
  await arbitrageBot.killSwitch.activate({
    reason: "budget_protection",
    cooldown: 300  // 5분 후 재시작 가능
  });

  // Telegram 긴급 알림
  await sendTelegramAlert({
    message: "🚨 KILL SWITCH ACTIVATED - Trading halted",
    reason: "Budget limit reached",
    action: "Manual approval required to resume"
  });

  // 5분 후 상태 체크
  setTimeout(async () => {
    const status = await arbitrageBot.getBudgetStatus("hourly");

    if (status.utilizationRate < 0.5) {
      // 예산 회복되면 자동 재시작
      await arbitrageBot.killSwitch.deactivate();
      console.log("✅ Kill switch deactivated - resuming trading");
    }
  }, 300000);
}
```

---

## 보안 플로우 다이어그램

```
┌───────────────────┐
│  ArbitrageBot     │
│  (초당 10-100 req)│
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│         Pag0 Smart Proxy (Security Layer)           │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐│
│  │ Anomaly Detection│  │  Spend Firewall          ││
│  │                  │  │                          ││
│  │ ✓ Spike detect   │  │ ✓ Max $0.05/req         ││
│  │ ✓ Cost baseline  │  │ ✓ $0.50/hour            ││
│  │ ✓ New endpoint   │  │ ✓ Whitelist only        ││
│  │ ✓ Pattern anomaly│  │ ✓ Kill switch           ││
│  └──────────────────┘  └──────────────────────────┘│
│                                                      │
│  Decision Flow:                                      │
│  Request → Whitelist Check → Budget Check →         │
│  → Anomaly Check → [PASS] → Forward                 │
│                                                      │
│  [FAIL] → Block + Alert                             │
└─────────────────────────────────────────────────────┘
          │
          ├─────────────────┬──────────────────┐
          ▼ (allowed)       ▼ (allowed)        ▼ (blocked)
    ┌──────────┐      ┌──────────┐      ┌────────────────┐
    │ CoinGecko│      │ 1inch API│      │ unknown-api.com│
    │  (OK)    │      │  (OK)    │      │   (BLOCKED)    │
    └──────────┘      └──────────┘      └────────────────┘
          │                 │                     │
          └─────────────────┴─────────────────────┘
                            │
                            ▼
                    x402 Payment
                   (Only allowed)
```

---

## 공격 시나리오 및 방어

### 시나리오 1: Honeypot 공격

```yaml
공격 방식:
  1. 악성 API가 "초저가 ETH" 정보 제공
  2. 봇이 유인당해 해당 API 반복 호출
  3. 고액 API 응답 ($5/요청)
  4. 지갑 고갈

Pag0 방어:
  - 화이트리스트: 미등록 API 차단 (공격 1단계에서 차단)
  - Max per request ($0.05): 고액 응답 차단 (공격 3단계에서 차단)
  - Anomaly detection: 새 엔드포인트 → 승인 필요

결과: 공격 실패
```

### 시나리오 2: 무한 루프 버그

```yaml
버그 시나리오:
  - 코드 버그로 동일 요청 무한 반복
  - 10분에 6,000 요청
  - 예상 손실: $300

Pag0 방어:
  - Hourly budget ($0.50): 10건 후 차단
  - Spike detection (200/min): 이상 패턴 감지
  - Kill switch: 자동 중단

실제 손실: $0.50 (시간당 한도)
절감: $299.50 (99.8%)
```

### 시나리오 3: 가스비 급등 공격

```yaml
공격 시나리오:
  - 가스 추정 API가 조작된 고액 가스비 반환
  - 봇이 비합리적 트레이드 실행
  - 실제 가스비 + API 비용 이중 손실

Pag0 방어:
  - Cost spike detection (3x baseline): 비정상 비용 감지
  - Alert + Block: 즉시 차단 및 알림
  - Baseline 학습: 1시간 평균 기준

결과: 비정상 요청 차단 + 관리자 알림
```

---

## 효과 비교

| 지표 | Without Pag0 | With Pag0 | 효과 |
|------|--------------|-----------|------|
| **보안** |
| 악성 API 차단 | 0% (사후 발견) | 100% (화이트리스트) | 공격 원천 차단 |
| 버그 폭주 손실 | $300 (10분 버그) | $0.50 (시간당 한도) | **99.8% 손실 방지** |
| 이상 패턴 감지 | 없음 | 실시간 ML 탐지 | 평균 30초 내 감지 |
| **비용** |
| 월 API 비용 | $450 | $230 (캐시 효과) | -$220 (49%) |
| 보안 사고 손실 | $1,200/년 (추정) | $0 | **-$1,200/년** |
| **운영** |
| 모니터링 시간 | 주 10시간 | 자동화 | -40시간/월 |
| 긴급 대응 시간 | 평균 15분 | <30초 (자동) | **30배 빠름** |

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - Spend Firewall 이상 탐지 엔진, 킬 스위치 구현 상세
- [04-API-SPEC](04-API-SPEC.md) - `anomalyDetection`, `killSwitch`, `getBudgetStatus()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - 보안 중심 정책 설정 가이드

---

← [UC2: 엔터프라이즈 팀 관리](09-02-UC-ENTERPRISE.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC4 →](09-04-UC-MCP-ORCHESTRATION.md)
