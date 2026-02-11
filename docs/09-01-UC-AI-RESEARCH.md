# UC1: AI 리서치 에이전트

← [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC2 →](09-02-UC-ENTERPRISE.md)

---

> **TL;DR**: 학술 논문 요약 에이전트 "ResearchBot"이 하루 3,000개 논문을 처리하면서, Pag0 Smart Proxy의 Spend Firewall(예산 한도)과 큐레이션(최적 번역 API 자동 선택)으로 정책 통제를 확보하고, 캐시(45% 중복 제거)로 월 $1,672(37%)를 절감하는 사례입니다.

---

## 시나리오

**배경**:

- 학술 논문 요약 에이전트 "ResearchBot"
- 하루 3,000개 논문 처리
- 번역 API (다국어 논문), 검색 API (관련 논문), 분석 API (토픽 모델링) 사용
- 동일 논문이 여러 요청에서 반복 참조됨 (평균 중복률 45%)

**문제점 (Without Pag0)**:

```yaml
비용 문제:
  - 하루 3,000 요청 × $0.05/요청 = $150/일
  - 중복 요청 45% → 불필요한 지출 $67.5/일
  - 월 총 비용: $4,500 (중복 포함)

관리 문제:
  - 예산 초과 감지 불가
  - 에이전트 폭주 시 무제한 지출
  - 어떤 API가 비용 효율적인지 모름

선택 문제:
  - DeepL vs OpenAI vs Google Translate?
  - 마케팅 자료만 보고 선택
  - A/B 테스트 비용 부담
```

**솔루션 (With Pag0)**:

```typescript
// 1. Pag0 클라이언트 설정
import { createPag0Client } from "@pag0/sdk";

const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // Spend Firewall: 예산 정책
  policy: {
    maxPerRequest: "100000",      // 최대 $0.10/요청
    dailyBudget: "3000000",        // 일일 $3 한도
    monthlyBudget: "75000000",     // 월 $75 한도
    allowedEndpoints: [
      "api.deepl.com",
      "api.openai.com/v1/translate",
      "translation.googleapis.com"
    ],
    blockOnExceed: true,            // 초과 시 차단
    alertOnThreshold: 0.8           // 80% 사용 시 알림
  },

  // Smart Cache: 캐싱 정책
  cache: {
    enabled: true,
    defaultTTL: 3600,                // 1시간 캐시
    customTTL: {
      "api.deepl.com": 7200,         // 번역은 2시간 (안정적)
      "search.api.com": 300          // 검색은 5분 (실시간성)
    },
    cacheKey: (request) => {
      // 논문 ID + 언어로 캐시 키 생성
      const body = JSON.parse(request.body);
      return `${body.paperId}-${body.targetLang}`;
    }
  },

  // Analytics 수집 활성화
  analytics: {
    enabled: true,
    trackLatency: true,
    trackCost: true,
    trackCacheHits: true
  }
});

// 2. 에이전트 로직
async function processPaper(paper: Paper) {
  console.log(`Processing paper: ${paper.id}`);

  // 2.1. 번역 API 호출 (Pag0를 통해)
  const translationResponse = await pag0.fetch(
    "https://api.deepl.com/v2/translate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: paper.abstract,
        target_lang: "EN",
        paperId: paper.id  // 캐시 키에 사용
      })
    }
  );

  // 메타 정보 확인
  console.log("Translation meta:", {
    cached: translationResponse.meta.cached,
    cost: translationResponse.meta.cost,
    latency: translationResponse.meta.latency,
    cacheSavings: translationResponse.meta.cacheSavings
  });

  const translatedText = await translationResponse.json();

  // 2.2. 분석 API 호출
  const analysisResponse = await pag0.fetch(
    "https://api.analysis.com/v1/topics",
    {
      method: "POST",
      body: JSON.stringify({
        text: translatedText.text,
        paperId: paper.id
      })
    }
  );

  console.log("Analysis meta:", analysisResponse.meta);

  return {
    paperId: paper.id,
    translation: translatedText,
    analysis: await analysisResponse.json(),
    totalCost: translationResponse.meta.cost + analysisResponse.meta.cost,
    totalSavings: translationResponse.meta.cacheSavings +
                  analysisResponse.meta.cacheSavings
  };
}

// 3. 배치 처리 (3,000개 논문)
async function processBatch(papers: Paper[]) {
  const results = await Promise.all(
    papers.map(paper => processPaper(paper))
  );

  // 일일 요약
  const summary = {
    totalPapers: papers.length,
    totalCost: results.reduce((sum, r) => sum + r.totalCost, 0),
    totalSavings: results.reduce((sum, r) => sum + r.totalSavings, 0),
    cacheHitRate: results.filter(r => r.totalSavings > 0).length / results.length
  };

  console.log("Daily Summary:", summary);
  // Output:
  // {
  //   totalPapers: 3000,
  //   totalCost: $82.50 (45% 캐시 히트)
  //   totalSavings: $67.50
  //   cacheHitRate: 0.45
  // }
}

// 4. 큐레이션 활용: 최적 API 자동 선택
async function optimizeAPIs() {
  // Pag0에게 추천 요청
  const recommendation = await pag0.recommend({
    category: "translation",
    optimize: "cost",           // 비용 최적화 우선
    minReliability: 0.95,       // 최소 95% 성공률
    filters: {
      languages: ["EN", "KO", "JA", "ZH"]
    }
  });

  console.log("Recommended API:", recommendation);
  // Output:
  // {
  //   endpoint: "api.deepl.com",
  //   score: 87,
  //   evidence: {
  //     avgCost: "$0.04/request",
  //     reliability: 98.2%,
  //     avgLatency: "234ms",
  //     totalRequests: 45000,  // Pag0를 통한 실제 사용 데이터
  //     cacheHitRate: 47%
  //   },
  //   reasoning: "DeepL은 비용이 OpenAI의 60%이면서 신뢰도가 더 높음"
  // }

  // 추천 API로 자동 전환
  updateAPIEndpoint(recommendation.endpoint);
}

// 5. 비교 분석
async function compareAPIs() {
  const comparison = await pag0.compare([
    "api.deepl.com",
    "api.openai.com/v1/translate",
    "translation.googleapis.com"
  ]);

  console.table(comparison);
  // Output:
  // ┌─────────────┬──────────┬─────────────┬─────────┬──────────┐
  // │   Endpoint  │   Score  │  Avg Cost   │ Latency │ Reliability │
  // ├─────────────┼──────────┼─────────────┼─────────┼──────────┤
  // │ DeepL       │    87    │   $0.04     │  234ms  │   98.2%  │
  // │ OpenAI      │    73    │   $0.07     │  189ms  │   99.1%  │
  // │ Google      │    79    │   $0.03     │  312ms  │   96.8%  │
  // └─────────────┴──────────┴─────────────┴─────────┴──────────┘
}
```

---

## 아키텍처 플로우

```
┌─────────────────┐
│  ResearchBot    │
│   (AI Agent)    │
└────────┬────────┘
         │ 3,000 requests/day
         ▼
┌─────────────────────────────────────────────────────────┐
│              Pag0 Smart Proxy                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Policy Engine │  │  Cache Layer │  │  Analytics   │  │
│  │             │  │              │  │              │  │
│  │ ✓ Daily<$3  │  │ Redis Cache  │  │ Cost Tracker │  │
│  │ ✓ Max $0.10 │  │ 45% hit rate │  │ Latency Track│  │
│  │ ✓ Whitelist │  │ TTL: 1-2hr   │  │ Success Rate │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────┬───────────────────────────────────────────────┘
          │
          ├─────────────┬──────────────┬─────────────────┐
          ▼             ▼              ▼                 ▼
    ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐
    │ DeepL   │   │ OpenAI  │   │  Google  │   │ Analysis │
    │   API   │   │   API   │   │   API    │   │   API    │
    └─────────┘   └─────────┘   └──────────┘   └──────────┘
         │             │              │              │
         └─────────────┴──────────────┴──────────────┘
                       │
                       ▼
              x402 Payment Protocol
              (SKALE Zero Gas)
```

---

## 비용 비교표

| 항목 | Without Pag0 | With Pag0 | 절감액 |
|------|--------------|-----------|--------|
| **일일 비용** |
| 총 요청 | 3,000 | 3,000 | - |
| 실제 결제 요청 | 3,000 | 1,650 (45% 캐시) | -1,350 |
| 평균 요청당 비용 | $0.05 | $0.05 | - |
| 일일 API 비용 | $150.00 | $82.50 | **$67.50** |
| Pag0 비용 (Savings Share 15%) | $0 | $10.13 | - |
| 순 지출 | $150.00 | $92.63 | **$57.37** |
| **월별 비용 (30일)** |
| API 비용 | $4,500 | $2,475 | $2,025 |
| Pag0 구독료 (Pro) | $0 | $49 | - |
| Pag0 Savings Share | $0 | $304 | - |
| 순 지출 | $4,500 | $2,828 | **$1,672** |
| **절감률** | - | - | **37%** |

---

## 정량적 효과

```yaml
비용 절감:
  월 절감액: $1,672 (37%)
  연 절감액: $20,064
  ROI: 47배 (투자 $428/월, 절감 $2,025/월)

운영 효율:
  정책 위반 차단: 월 평균 3회 (폭주 방지)
  예산 알림: 80% 도달 시 자동 알림
  자동 API 최적화: 큐레이션으로 최적 API 발견

개발 생산성:
  A/B 테스트 불필요: 실사용 데이터로 즉시 비교
  모니터링 자동화: 대시보드에서 실시간 비용 추적
  시간 절약: 주 5시간 (비용 분석 + API 선택 시간)
```

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - Smart Cache 및 Spend Firewall 구현 상세
- [04-API-SPEC](04-API-SPEC.md) - `pag0.fetch()`, `pag0.recommend()`, `pag0.compare()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - `@pag0/sdk` 설치 및 설정 가이드

---

← [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC2 →](09-02-UC-ENTERPRISE.md)
