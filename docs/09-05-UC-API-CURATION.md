# UC5: Automatic API Curation Optimization

← [UC4: MCP Server Orchestration](09-04-UC-MCP-ORCHESTRATION.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC6 →](09-06-UC-CLAUDE-CODE.md)

---

> **TL;DR**: A multilingual chatbot "MultiLingualBot" automatically selects the optimal API among 5 translation APIs (DeepL, OpenAI, Google, Azure, AWS) based on Pag0's curation engine recommendations from real usage data, achieving 36% cost reduction + 23% speed improvement + 100% A/B testing cost elimination.

---

## Scenario

**Background**:

- Multilingual chatbot "MultiLingualBot"
- Translation API options: DeepL, OpenAI, Google, Azure, AWS
- Each API has different cost, speed, and quality
- Agent needs to automatically select the optimal API for each situation

**Problems (Without Pag0)**:

```yaml
No selection criteria:
  - Selection based only on marketing materials
  - No actual usage data
  - A/B testing cost burden

Manual management:
  - Developers manually monitor performance
  - Manual API switching
  - Time-consuming

Optimization impossible:
  - Unknown optimal API per language
  - Difficult to judge cost/speed tradeoffs
```

**Solution (With Pag0 Curation)**:

```typescript
// 1. Initial setup: Register multiple APIs
import { createPag0Client } from "@pag0/sdk";

const chatbot = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // Allow all 5 translation APIs
  policy: {
    allowedEndpoints: [
      "api.deepl.com",
      "api.openai.com/v1/translate",
      "translation.googleapis.com",
      "api.cognitive.microsofttranslator.com",
      "translate.amazonaws.com"
    ]
  },

  // Enable caching
  cache: {
    enabled: true,
    defaultTTL: 3600
  },

  // Enable curation
  curation: {
    enabled: true,
    autoOptimize: true,           // Auto-optimization
    collectMetrics: true,          // Metrics collection
    minDataPoints: 100             // Recommend after collecting min 100 data points
  }
});

// 2. Initial phase: Use all APIs evenly (data collection)
async function translateWithDataCollection(
  text: string,
  sourceLang: string,
  targetLang: string
) {
  // Request recommendation from Pag0 (random selection if insufficient data)
  const recommendation = await chatbot.recommend({
    category: "translation",
    context: {
      sourceLang,
      targetLang,
      textLength: text.length
    },
    optimize: "balanced",  // Balance cost/speed/quality
    fallbackStrategy: "round_robin"  // Round-robin selection if insufficient data
  });

  console.log("[Pag0] Recommended API:", recommendation.endpoint);

  // Translate using recommended API
  const response = await chatbot.fetch(
    recommendation.endpoint,
    {
      method: "POST",
      body: JSON.stringify({
        text,
        source_lang: sourceLang,
        target_lang: targetLang
      }),

      // Meta information (for analysis)
      pag0Meta: {
        sourceLang,
        targetLang,
        textLength: text.length,
        useCase: "chatbot_translation"
      }
    }
  );

  const result = await response.json();

  // Metrics automatically collected by Pag0:
  // - Cost: response.meta.cost
  // - Speed: response.meta.latency
  // - Success rate: response.status === 200
  // - Context: sourceLang, targetLang, textLength

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

// 3. After sufficient data collection: Smart recommendations
async function getSmartRecommendation(scenario: string) {
  switch (scenario) {
    case "cost_sensitive":
      // Cost optimization (maintain 90%+ accuracy)
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
      // Speed optimization (95%+ accuracy)
      return await chatbot.recommend({
        category: "translation",
        optimize: "latency",
        minReliability: 0.95,
        maxLatency: 200  // Within 200ms
      });

    case "quality_first":
      // Quality priority (cost irrelevant)
      return await chatbot.recommend({
        category: "translation",
        optimize: "reliability",
        minReliability: 0.99
      });

    case "balanced":
      // Balanced (overall score)
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

// 4. Real usage example
async function handleUserMessage(message: string, userLang: string) {
  // Auto-select optimal API per scenario
  const timeOfDay = new Date().getHours();
  const isRushHour = timeOfDay >= 9 && timeOfDay <= 17;

  let scenario: string;

  if (isRushHour) {
    // Rush hour: prioritize speed
    scenario = "speed_critical";
  } else if (message.length > 1000) {
    // Long text: prioritize cost (because it's expensive)
    scenario = "cost_sensitive";
  } else {
    // Normal: balanced
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
  //   totalRequests: 1500,  // Real usage data through Pag0
  //   cacheHitRate: 45%,
  //   performanceByContext: {
  //     "EN-KO": { latency: 198ms, reliability: 99% },
  //     "EN-JA": { latency: 267ms, reliability: 97% }
  //   }
  // }

  // Execute translation
  const translation = await translateWithDataCollection(
    message,
    "EN",
    userLang
  );

  return translation;
}

// 5. Comparison analysis dashboard
async function showAPIComparison() {
  const comparison = await chatbot.compare([
    "api.deepl.com",
    "api.openai.com/v1/translate",
    "translation.googleapis.com",
    "api.cognitive.microsofttranslator.com",
    "translate.amazonaws.com"
  ], {
    groupBy: ["targetLang"],  // Compare by language
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
  // EN-KO translation:
  // ┌────────────────┬─────────┬─────────────┐
  // │ API            │ Latency │ Reliability │
  // ├────────────────┼─────────┼─────────────┤
  // │ DeepL          │  198ms  │    99.0%    │ ← Best
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

// 6. Auto-optimization (optional)
async function enableAutoOptimization() {
  await chatbot.curation.configure({
    autoSwitch: {
      enabled: true,

      // Condition: Auto-switch if API score differs by 10%+
      threshold: 0.10,

      // Safety measure: After collecting min 200 data points
      minDataPoints: 200,

      // Notification: Notify on switch
      notifyOnSwitch: true
    }
  });

  // After this, all requests automatically select optimal API in real-time
}
```

---

## Curation Data Flow

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

## Impact Analysis

**Based on 10,000 monthly translation requests**:

| Scenario | Manual (Developer selection) | Pag0 Auto-Optimize | Improvement |
|---------|---------------------|-------------------|------|
| **Cost** |
| Fixed DeepL | $400 (always) | $320 (context-optimal) | **-20%** |
| Fixed OpenAI | $700 (always) | $320 (context-optimal) | **-54%** |
| Random selection | $500 (average) | $320 (context-optimal) | **-36%** |
| **Speed** |
| Avg latency | 278ms (random) | 215ms (optimized) | **-23%** |
| P95 latency | 450ms | 320ms | **-29%** |
| **Quality** |
| Success rate | 96.5% (random) | 98.2% (optimal) | **+1.7%** |
| **Operations** |
| A/B testing cost | $2,000 (one-time) | $0 (automatic) | **-100%** |
| Monitoring time | 5 hours/week | 0 hours (automatic) | **-20 hours/month** |

**Qualitative value**:

- **Automated decision-making**: Agent autonomously selects optimal API
- **Data-driven**: Objective comparison based on real usage data
- **Context-aware**: Optimization by time/language/text length
- **Continuous improvement**: Recommendation accuracy improves with usage

---

## Related Documents

- [03-TECH-SPEC](03-TECH-SPEC.md) - Curation Engine scoring algorithm, data collection pipeline details
- [04-API-SPEC](04-API-SPEC.md) - `chatbot.recommend()`, `chatbot.compare()`, `curation.configure()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - Curation activation and auto-optimization configuration guide
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Data-Driven Curation product vision

---

← [UC4: MCP Server Orchestration](09-04-UC-MCP-ORCHESTRATION.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC6 →](09-06-UC-CLAUDE-CODE.md)
