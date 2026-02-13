# UC1: AI Research Agent

← [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC2 →](09-02-UC-ENTERPRISE.md)

---

> **TL;DR**: Academic paper summarization agent "ResearchBot" processes 3,000 papers per day, gaining policy control through Pag0 Smart Proxy's Spend Firewall (budget limits) and curation (automatic optimal translation API selection), while saving $1,672/month (37%) through caching (45% deduplication).

---

## Scenario

**Background**:

- Academic paper summarization agent "ResearchBot"
- Processes 3,000 papers per day
- Uses translation API (multilingual papers), search API (related papers), analysis API (topic modeling)
- Same papers are repeatedly referenced across multiple requests (average 45% duplication rate)

**Problems (Without Pag0)**:

```yaml
Cost Issues:
  - 3,000 requests/day × $0.05/request = $150/day
  - 45% duplicate requests → unnecessary spending $67.5/day
  - Total monthly cost: $4,500 (including duplicates)

Management Issues:
  - Cannot detect budget overruns
  - Unlimited spending when agent goes rogue
  - No visibility into which APIs are cost-effective

Selection Issues:
  - DeepL vs OpenAI vs Google Translate?
  - Choosing based only on marketing materials
  - High cost of A/B testing
```

**Solution (With Pag0)**:

```typescript
// 1. Pag0 client setup
import { createPag0Client } from "@pag0/sdk";

const pag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // Spend Firewall: budget policy
  policy: {
    maxPerRequest: "100000",      // max $0.10/request
    dailyBudget: "3000000",        // daily $3 limit
    monthlyBudget: "75000000",     // monthly $75 limit
    allowedEndpoints: [
      "api.deepl.com",
      "api.openai.com/v1/translate",
      "translation.googleapis.com"
    ],
    blockOnExceed: true,            // block on exceed
    alertOnThreshold: 0.8           // alert at 80% usage
  },

  // Smart Cache: caching policy
  cache: {
    enabled: true,
    defaultTTL: 3600,                // 1 hour cache
    customTTL: {
      "api.deepl.com": 7200,         // 2 hours for translation (stable)
      "search.api.com": 300          // 5 minutes for search (real-time)
    },
    cacheKey: (request) => {
      // generate cache key from paper ID + language
      const body = JSON.parse(request.body);
      return `${body.paperId}-${body.targetLang}`;
    }
  },

  // Analytics collection enabled
  analytics: {
    enabled: true,
    trackLatency: true,
    trackCost: true,
    trackCacheHits: true
  }
});

// 2. Agent logic
async function processPaper(paper: Paper) {
  console.log(`Processing paper: ${paper.id}`);

  // 2.1. Translation API call (via Pag0)
  const translationResponse = await pag0.fetch(
    "https://api.deepl.com/v2/translate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: paper.abstract,
        target_lang: "EN",
        paperId: paper.id  // used in cache key
      })
    }
  );

  // Check meta information
  console.log("Translation meta:", {
    cached: translationResponse.meta.cached,
    cost: translationResponse.meta.cost,
    latency: translationResponse.meta.latency,
    cacheSavings: translationResponse.meta.cacheSavings
  });

  const translatedText = await translationResponse.json();

  // 2.2. Analysis API call
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

// 3. Batch processing (3,000 papers)
async function processBatch(papers: Paper[]) {
  const results = await Promise.all(
    papers.map(paper => processPaper(paper))
  );

  // Daily summary
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
  //   totalCost: $82.50 (45% cache hits)
  //   totalSavings: $67.50
  //   cacheHitRate: 0.45
  // }
}

// 4. Curation usage: automatic optimal API selection
async function optimizeAPIs() {
  // Request recommendation from Pag0
  const recommendation = await pag0.recommend({
    category: "translation",
    optimize: "cost",           // prioritize cost optimization
    minReliability: 0.95,       // minimum 95% success rate
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
  //     totalRequests: 45000,  // actual usage data via Pag0
  //     cacheHitRate: 47%
  //   },
  //   reasoning: "DeepL costs 60% of OpenAI while having higher reliability"
  // }

  // Auto-switch to recommended API
  updateAPIEndpoint(recommendation.endpoint);
}

// 5. Comparison analysis
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

## Architecture Flow

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

## Cost Comparison Table

| Item | Without Pag0 | With Pag0 | Savings |
|------|--------------|-----------|---------|
| **Daily Cost** |
| Total requests | 3,000 | 3,000 | - |
| Actual paid requests | 3,000 | 1,650 (45% cache) | -1,350 |
| Avg cost per request | $0.05 | $0.05 | - |
| Daily API cost | $150.00 | $82.50 | **$67.50** |
| Pag0 cost (Savings Share 15%) | $0 | $10.13 | - |
| Net spending | $150.00 | $92.63 | **$57.37** |
| **Monthly Cost (30 days)** |
| API cost | $4,500 | $2,475 | $2,025 |
| Pag0 subscription (Pro) | $0 | $49 | - |
| Pag0 Savings Share | $0 | $304 | - |
| Net spending | $4,500 | $2,828 | **$1,672** |
| **Savings Rate** | - | - | **37%** |

---

## Quantitative Impact

```yaml
Cost Savings:
  Monthly savings: $1,672 (37%)
  Annual savings: $20,064
  ROI: 47x (investment $428/month, savings $2,025/month)

Operational Efficiency:
  Policy violations blocked: avg 3/month (prevents runaway)
  Budget alerts: automatic alert at 80% threshold
  Automatic API optimization: discover optimal APIs via curation

Development Productivity:
  No A/B testing needed: instant comparison with real usage data
  Automated monitoring: real-time cost tracking on dashboard
  Time saved: 5 hours/week (cost analysis + API selection time)
```

---

## Related Documents

- [03-TECH-SPEC](03-TECH-SPEC.md) - Smart Cache and Spend Firewall implementation details
- [04-API-SPEC](04-API-SPEC.md) - `pag0.fetch()`, `pag0.recommend()`, `pag0.compare()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - `@pag0/sdk` installation and setup guide

---

← [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC2 →](09-02-UC-ENTERPRISE.md)
