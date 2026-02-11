# UC5: API 큐레이션 자동 최적화

← [UC4: MCP 서버 오케스트레이션](09-04-UC-MCP-ORCHESTRATION.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC6 →](09-06-UC-CLAUDE-CODE.md)

---

> **TL;DR**: 다국어 챗봇 "MultiLingualBot"이 5개 번역 API(DeepL, OpenAI, Google, Azure, AWS) 중 상황별 최적 API를 Pag0 큐레이션 엔진의 실사용 데이터 기반 추천으로 자동 선택하여, 비용 36% 절감 + 속도 23% 개선 + A/B 테스트 비용 100% 제거를 달성하는 사례입니다.

---

## 시나리오

**배경**:

- 다국어 챗봇 "MultiLingualBot"
- 번역 API 선택: DeepL, OpenAI, Google, Azure, AWS
- 각 API의 비용, 속도, 품질이 다름
- 에이전트가 상황에 맞게 최적 API 자동 선택 필요

**문제점 (Without Pag0)**:

```yaml
선택 근거 부재:
  - 마케팅 자료만 보고 선택
  - 실제 사용 데이터 없음
  - A/B 테스트 비용 부담

수동 관리:
  - 개발자가 직접 성능 모니터링
  - 수동으로 API 전환
  - 시간 소모 많음

최적화 불가:
  - 언어별 최적 API 모름
  - 비용/속도 트레이드오프 판단 어려움
```

**솔루션 (With Pag0 Curation)**:

```typescript
// 1. 초기 설정: 여러 API 등록
import { createPag0Client } from "@pag0/sdk";

const chatbot = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // 5개 번역 API 모두 허용
  policy: {
    allowedEndpoints: [
      "api.deepl.com",
      "api.openai.com/v1/translate",
      "translation.googleapis.com",
      "api.cognitive.microsofttranslator.com",
      "translate.amazonaws.com"
    ]
  },

  // 캐싱 활성화
  cache: {
    enabled: true,
    defaultTTL: 3600
  },

  // 큐레이션 활성화
  curation: {
    enabled: true,
    autoOptimize: true,           // 자동 최적화
    collectMetrics: true,          // 메트릭 수집
    minDataPoints: 100             // 최소 100회 데이터 수집 후 추천
  }
});

// 2. 초기 단계: 모든 API 골고루 사용 (데이터 수집)
async function translateWithDataCollection(
  text: string,
  sourceLang: string,
  targetLang: string
) {
  // Pag0에게 추천 요청 (데이터 부족 시 랜덤 선택)
  const recommendation = await chatbot.recommend({
    category: "translation",
    context: {
      sourceLang,
      targetLang,
      textLength: text.length
    },
    optimize: "balanced",  // 비용/속도/품질 균형
    fallbackStrategy: "round_robin"  // 데이터 부족 시 순환 선택
  });

  console.log("[Pag0] Recommended API:", recommendation.endpoint);

  // 추천 API로 번역
  const response = await chatbot.fetch(
    recommendation.endpoint,
    {
      method: "POST",
      body: JSON.stringify({
        text,
        source_lang: sourceLang,
        target_lang: targetLang
      }),

      // 메타 정보 (분석용)
      pag0Meta: {
        sourceLang,
        targetLang,
        textLength: text.length,
        useCase: "chatbot_translation"
      }
    }
  );

  const result = await response.json();

  // Pag0가 자동으로 수집하는 메트릭:
  // - 비용: response.meta.cost
  // - 속도: response.meta.latency
  // - 성공률: response.status === 200
  // - 컨텍스트: sourceLang, targetLang, textLength

  return {
    translatedText: result.text,
    meta: {
      api: recommendation.endpoint,
      cost: response.meta.cost,
      latency: response.meta.latency,
      cached: response.meta.cached,
      confidence: recommendation.confidence
    }
  };
}

// 3. 충분한 데이터 수집 후: 스마트 추천
async function getSmartRecommendation(scenario: string) {
  switch (scenario) {
    case "cost_sensitive":
      // 비용 최적화 (정확도 90% 이상 유지)
      return await chatbot.recommend({
        category: "translation",
        optimize: "cost",
        minReliability: 0.90,
        context: {
          budget: "tight",
          volume: "high"
        }
      });

    case "speed_critical":
      // 속도 최적화 (정확도 95% 이상)
      return await chatbot.recommend({
        category: "translation",
        optimize: "latency",
        minReliability: 0.95,
        maxLatency: 200  // 200ms 이내
      });

    case "quality_first":
      // 품질 최우선 (비용 무관)
      return await chatbot.recommend({
        category: "translation",
        optimize: "reliability",
        minReliability: 0.99
      });

    case "balanced":
      // 균형 (종합 점수)
      return await chatbot.recommend({
        category: "translation",
        optimize: "balanced",
        weights: {
          cost: 0.3,
          latency: 0.3,
          reliability: 0.4
        }
      });
  }
}

// 4. 실제 사용 예시
async function handleUserMessage(message: string, userLang: string) {
  // 시나리오별 최적 API 자동 선택
  const timeOfDay = new Date().getHours();
  const isRushHour = timeOfDay >= 9 && timeOfDay <= 17;

  let scenario: string;

  if (isRushHour) {
    // 러시아워: 속도 우선
    scenario = "speed_critical";
  } else if (message.length > 1000) {
    // 긴 텍스트: 비용 우선 (비싸니까)
    scenario = "cost_sensitive";
  } else {
    // 일반: 균형
    scenario = "balanced";
  }

  const recommendation = await getSmartRecommendation(scenario);

  console.log(`[Pag0] Scenario: ${scenario}, Selected: ${recommendation.endpoint}`);
  console.log(`[Pag0] Evidence:`, recommendation.evidence);
  // Evidence:
  // {
  //   avgCost: "$0.04/request",
  //   avgLatency: "234ms",
  //   reliability: 98.2%,
  //   totalRequests: 1500,  // Pag0를 통한 실사용 데이터
  //   cacheHitRate: 45%,
  //   performanceByContext: {
  //     "EN-KO": { latency: 198ms, reliability: 99% },
  //     "EN-JA": { latency: 267ms, reliability: 97% }
  //   }
  // }

  // 번역 실행
  const translation = await translateWithDataCollection(
    message,
    "EN",
    userLang
  );

  return translation;
}

// 5. 비교 분석 대시보드
async function showAPIComparison() {
  const comparison = await chatbot.compare([
    "api.deepl.com",
    "api.openai.com/v1/translate",
    "translation.googleapis.com",
    "api.cognitive.microsofttranslator.com",
    "translate.amazonaws.com"
  ], {
    groupBy: ["targetLang"],  // 언어별 비교
    metrics: ["cost", "latency", "reliability", "cacheHitRate"]
  });

  console.table(comparison.overall);
  // ┌────────────────┬───────┬─────────┬─────────┬─────────────┬──────────────┐
  // │ API            │ Score │ Cost    │ Latency │ Reliability │ Cache Hit    │
  // ├────────────────┼───────┼─────────┼─────────┼─────────────┼──────────────┤
  // │ DeepL          │  87   │ $0.04   │  234ms  │    98.2%    │     47%      │
  // │ OpenAI         │  73   │ $0.07   │  189ms  │    99.1%    │     42%      │
  // │ Google         │  79   │ $0.03   │  312ms  │    96.8%    │     51%      │
  // │ Azure          │  68   │ $0.06   │  278ms  │    95.5%    │     38%      │
  // │ AWS            │  71   │ $0.05   │  245ms  │    97.2%    │     44%      │
  // └────────────────┴───────┴─────────┴─────────┴─────────────┴──────────────┘

  console.log("\nBy Language Pair:");
  console.table(comparison.byContext["EN-KO"]);
  // EN-KO 번역:
  // ┌────────────────┬─────────┬─────────────┐
  // │ API            │ Latency │ Reliability │
  // ├────────────────┼─────────┼─────────────┤
  // │ DeepL          │  198ms  │    99.0%    │ ← 최고
  // │ OpenAI         │  201ms  │    98.8%    │
  // │ Google         │  289ms  │    97.1%    │
  // └────────────────┴─────────┴─────────────┘

  console.log("\nRecommendations by scenario:");
  console.log("Cost-optimized (EN-KO):", comparison.recommendations.cost);
  // Output: { api: "Google", reason: "30% cheaper with 97% reliability" }

  console.log("Speed-optimized (EN-KO):", comparison.recommendations.latency);
  // Output: { api: "DeepL", reason: "198ms avg with 99% reliability" }

  console.log("Quality-optimized (EN-KO):", comparison.recommendations.reliability);
  // Output: { api: "DeepL", reason: "99.0% reliability, best for EN-KO" }
}

// 6. 자동 최적화 (선택적)
async function enableAutoOptimization() {
  await chatbot.curation.configure({
    autoSwitch: {
      enabled: true,

      // 조건: API 점수가 10% 이상 차이나면 자동 전환
      threshold: 0.10,

      // 안전장치: 최소 200회 데이터 수집 후
      minDataPoints: 200,

      // 알림: 전환 시 알림
      notifyOnSwitch: true
    }
  });

  // 이후 모든 요청은 실시간으로 최적 API 자동 선택
}
```

---

## 큐레이션 데이터 흐름

```
┌─────────────────────────────────────────────────────────┐
│         Pag0 Curation Engine (Data Collection)          │
│                                                          │
│  Every Request:                                          │
│  ┌─────────┐    ┌─────────┐    ┌──────────┐            │
│  │ Cost    │───▶│ Store   │───▶│ Analyze  │            │
│  │ Latency │    │ in DB   │    │ Patterns │            │
│  │ Success │    │         │    │          │            │
│  │ Context │    │         │    │          │            │
│  └─────────┘    └─────────┘    └──────────┘            │
│                                      │                   │
│                                      ▼                   │
│                          ┌───────────────────────┐      │
│                          │  Scoring Algorithm    │      │
│                          │                       │      │
│                          │  Score = Σ(wi × Mi)  │      │
│                          │                       │      │
│                          │  w1=cost weight       │      │
│                          │  w2=latency weight    │      │
│                          │  w3=reliability wgt   │      │
│                          │                       │      │
│                          │  M1=cost metric       │      │
│                          │  M2=latency metric    │      │
│                          │  M3=reliability met   │      │
│                          └───────────────────────┘      │
│                                      │                   │
│                                      ▼                   │
│  ┌────────────────────────────────────────────────┐    │
│  │           API Ranking Board                     │    │
│  │  ┌──────┬───────┬──────┬─────────┬────────┐   │    │
│  │  │ Rank │  API  │Score │Evidence │Context │   │    │
│  │  ├──────┼───────┼──────┼─────────┼────────┤   │    │
│  │  │  1   │DeepL  │  87  │1500 req │EN-KO   │   │    │
│  │  │  2   │Google │  79  │1200 req │EN-JA   │   │    │
│  │  │  3   │OpenAI │  73  │900 req  │All     │   │    │
│  │  └──────┴───────┴──────┴─────────┴────────┘   │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  recommend() API Returns:     │
         │  {                            │
         │    endpoint: "api.deepl.com", │
         │    score: 87,                 │
         │    evidence: { ... }          │
         │  }                            │
         └───────────────────────────────┘
```

---

## 효과 분석

**월간 10,000 번역 요청 기준**:

| 시나리오 | Manual (개발자 선택) | Pag0 Auto-Optimize | 개선 |
|---------|---------------------|-------------------|------|
| **비용** |
| DeepL 고정 | $400 (항상) | $320 (상황별 최적) | **-20%** |
| OpenAI 고정 | $700 (항상) | $320 (상황별 최적) | **-54%** |
| Random 선택 | $500 (평균) | $320 (상황별 최적) | **-36%** |
| **속도** |
| 평균 latency | 278ms (랜덤) | 215ms (최적화) | **-23%** |
| P95 latency | 450ms | 320ms | **-29%** |
| **품질** |
| 성공률 | 96.5% (랜덤) | 98.2% (최적) | **+1.7%** |
| **운영** |
| A/B 테스트 비용 | $2,000 (1회) | $0 (자동) | **-100%** |
| 모니터링 시간 | 주 5시간 | 0시간 (자동) | **-20시간/월** |

**정성적 가치**:

- **의사결정 자동화**: 에이전트가 스스로 최적 API 선택
- **데이터 기반**: 실사용 데이터로 객관적 비교
- **상황 인식**: 시간/언어/텍스트 길이별 최적화
- **지속 개선**: 사용할수록 추천 정확도 향상

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - Curation Engine 스코어링 알고리즘, 데이터 수집 파이프라인 상세
- [04-API-SPEC](04-API-SPEC.md) - `chatbot.recommend()`, `chatbot.compare()`, `curation.configure()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - 큐레이션 활성화 및 자동 최적화 설정 가이드
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Data-Driven Curation 제품 비전

---

← [UC4: MCP 서버 오케스트레이션](09-04-UC-MCP-ORCHESTRATION.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC6 →](09-06-UC-CLAUDE-CODE.md)
