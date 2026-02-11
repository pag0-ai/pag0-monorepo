# UC4: MCP 서버 오케스트레이션

← [UC3: DeFi 트레이딩 에이전트](09-03-UC-DEFI-TRADING.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC5 →](09-05-UC-API-CURATION.md)

---

> **TL;DR**: Claude Desktop에서 유료 MCP 서버(Exa, Browserbase, Firecrawl)를 사용할 때, Pag0 MCP Bridge를 통해 세션당 $1 예산 한도, 도구별 비용 추적, 크로스-도구 캐시(30% 히트)를 제공하여 비용 가시성과 통제력을 확보하는 사례입니다.

---

## 시나리오

**배경**:

- Claude Desktop이 유료 MCP 서버 사용
  - Exa (웹 검색): $0.02/검색
  - Browserbase (브라우저 자동화): $0.10/세션
  - Firecrawl (웹 크롤링): $0.05/페이지
- 긴 세션에서 비용 누적
- 사용자가 비용 인식 못함

**문제점 (Without Pag0)**:

```yaml
비용 불투명:
  - 세션당 총 비용 모름
  - 각 도구 호출 비용 추적 안됨
  - 월말에 청구서 보고 깜짝 놀람

통제 불가:
  - 예산 설정 불가
  - 고액 작업 사전 승인 불가
  - 자동 중단 메커니즘 없음

최적화 어려움:
  - 어떤 MCP 서버가 비용 효율적인지 모름
  - 대안 비교 불가
```

**솔루션 (With Pag0 + MCP Bridge)**:

```typescript
// 1. Pag0 MCP Bridge 설정
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    // Pag0 래핑된 MCP 서버들
    "pag0-exa": {
      "command": "npx",
      "args": ["@pag0/mcp-bridge", "exa"],
      "env": {
        "PAG0_API_KEY": "pag0_xxx...",
        "EXA_API_KEY": "exa_xxx...",

        // Pag0 정책
        "PAG0_POLICY_SESSION_BUDGET": "1000000",  // 세션당 $1
        "PAG0_POLICY_HOURLY_BUDGET": "2000000",   // 시간당 $2
        "PAG0_CACHE_ENABLED": "true",
        "PAG0_CACHE_TTL": "600"
      }
    },

    "pag0-browserbase": {
      "command": "npx",
      "args": ["@pag0/mcp-bridge", "browserbase"],
      "env": {
        "PAG0_API_KEY": "pag0_xxx...",
        "BROWSERBASE_API_KEY": "bb_xxx...",
        "PAG0_POLICY_MAX_PER_REQUEST": "200000",  // 최대 $0.20/세션
        "PAG0_CACHE_ENABLED": "true"
      }
    },

    "pag0-firecrawl": {
      "command": "npx",
      "args": ["@pag0/mcp-bridge", "firecrawl"],
      "env": {
        "PAG0_API_KEY": "pag0_xxx...",
        "FIRECRAWL_API_KEY": "fc_xxx...",
        "PAG0_POLICY_MAX_PER_REQUEST": "100000",  // 최대 $0.10/페이지
        "PAG0_CACHE_ENABLED": "true",
        "PAG0_CACHE_TTL": "3600"  // 페이지는 1시간 캐시
      }
    }
  }
}

// 2. MCP Bridge 구현 (간소화 버전)
import { MCPServer } from "@modelcontextprotocol/sdk";
import { createPag0Client } from "@pag0/sdk";

class Pag0MCPBridge {
  private pag0: ReturnType<typeof createPag0Client>;
  private upstreamMCP: MCPServer;

  constructor(upstreamConfig: MCPConfig) {
    // Pag0 클라이언트
    this.pag0 = createPag0Client({
      apiKey: process.env.PAG0_API_KEY!,
      policy: {
        sessionBudget: process.env.PAG0_POLICY_SESSION_BUDGET,
        hourlyBudget: process.env.PAG0_POLICY_HOURLY_BUDGET,
        maxPerRequest: process.env.PAG0_POLICY_MAX_PER_REQUEST,
      },
      cache: {
        enabled: process.env.PAG0_CACHE_ENABLED === "true",
        defaultTTL: parseInt(process.env.PAG0_CACHE_TTL || "600")
      }
    });

    // 원본 MCP 서버
    this.upstreamMCP = new MCPServer(upstreamConfig);
  }

  // MCP 도구 호출 래핑
  async callTool(toolName: string, args: any) {
    console.log(`[Pag0] Calling ${toolName} via Pag0 proxy...`);

    // Pag0를 통해 upstream MCP 서버 호출
    const response = await this.pag0.fetch(
      this.upstreamMCP.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.upstreamMCP.apiKey}`
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args
        }),

        // Pag0 메타
        pag0Meta: {
          toolName: toolName,
          sessionId: this.sessionId,
          userContext: "claude-desktop"
        }
      }
    );

    // 비용 정보 로깅
    console.log(`[Pag0] ${toolName} completed:`, {
      cached: response.meta.cached,
      cost: `$${(parseInt(response.meta.cost) / 1000000).toFixed(4)}`,
      latency: `${response.meta.latency}ms`,
      sessionTotal: `$${(this.sessionCost / 1000000).toFixed(4)}`
    });

    // 세션 누적 비용 추적
    this.sessionCost += parseInt(response.meta.cost);

    // 예산 경고
    if (this.sessionCost > 800000) {  // $0.80 (80% of $1 session budget)
      console.warn(`[Pag0] ⚠️ Session budget warning: $${(this.sessionCost / 1000000).toFixed(2)} / $1.00`);
    }

    return await response.json();
  }

  // 세션 종료 시 요약
  async endSession() {
    const summary = await this.pag0.getSessionSummary();

    console.log("[Pag0] Session Summary:", {
      totalCost: `$${(summary.totalCost / 1000000).toFixed(4)}`,
      totalRequests: summary.totalRequests,
      cacheHits: summary.cacheHits,
      cacheSavings: `$${(summary.cacheSavings / 1000000).toFixed(4)}`,
      toolBreakdown: summary.byTool
    });

    return summary;
  }
}

// 3. Claude 사용 예시
/*
User: "최신 AI 뉴스 검색해줘"

Claude:
[Pag0] Calling exa_search via Pag0 proxy...
[Pag0] exa_search completed: {
  cached: false,
  cost: "$0.0200",
  latency: "450ms",
  sessionTotal: "$0.0200"
}

검색 결과를 찾았습니다:
1. OpenAI GPT-5 발표...
2. Google Gemini 2.0...

[내부적으로 Pag0가 비용 추적]

---

User: "첫 번째 기사 내용 크롤링해줘"

Claude:
[Pag0] Calling firecrawl_scrape via Pag0 proxy...
[Pag0] firecrawl_scrape completed: {
  cached: false,
  cost: "$0.0500",
  latency: "1200ms",
  sessionTotal: "$0.0700"
}

기사 내용:
OpenAI가 GPT-5를...

---

User: "비슷한 뉴스 5개 더 찾아줘"

Claude:
[Pag0] Calling exa_search via Pag0 proxy...
[Pag0] exa_search completed: {
  cached: true,  ← 캐시 히트!
  cost: "$0.0000",
  latency: "25ms",
  sessionTotal: "$0.0700"
}

---

[세션 종료]
[Pag0] Session Summary: {
  totalCost: "$0.0700",
  totalRequests: 3,
  cacheHits: 1,
  cacheSavings: "$0.0200",
  toolBreakdown: {
    exa_search: { count: 2, cost: "$0.0200", cached: 1 },
    firecrawl_scrape: { count: 1, cost: "$0.0500", cached: 0 }
  }
}

실제 지불: $0.0700
절감: $0.0200 (22%)
*/
```

---

## MCP Bridge 아키텍처

```
┌─────────────────────┐
│   Claude Desktop    │
│  (사용자 인터페이스)  │
└──────────┬──────────┘
           │ MCP Protocol
           ▼
┌──────────────────────────────────────────────────┐
│        Pag0 MCP Bridge (Middleware)              │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Policy    │  │   Cache    │  │ Analytics  │ │
│  │  Engine    │  │   Layer    │  │  Tracker   │ │
│  │            │  │            │  │            │ │
│  │ Session:$1 │  │ TTL: 10min │  │ Cost/tool  │ │
│  │ Hourly: $2 │  │ Hit: 30%   │  │ Latency    │ │
│  └────────────┘  └────────────┘  └────────────┘ │
└──────────┬───────────────────────────────────────┘
           │
           ├──────────────┬──────────────┬──────────────┐
           ▼              ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐
    │   Exa    │   │Browserbase│ │Firecrawl │  │  Other   │
    │   MCP    │   │   MCP     │ │   MCP    │  │   MCP    │
    └──────────┘   └──────────┘  └──────────┘  └──────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                        │
                        ▼
                x402 Payment (각 MCP 서버 과금)
```

---

## 비용 비교 (월간 세션 100회 기준)

| 항목 | Without Pag0 | With Pag0 Bridge | 절감 |
|------|--------------|------------------|------|
| **도구별 사용** |
| Exa (검색 300회) | $6.00 | $3.60 (40% 캐시) | -$2.40 |
| Firecrawl (크롤링 150회) | $7.50 | $5.25 (30% 캐시) | -$2.25 |
| Browserbase (세션 50회) | $5.00 | $4.00 (20% 캐시) | -$1.00 |
| **총계** | $18.50 | $12.85 | **-$5.65 (31%)** |
| **Pag0 비용** | - | $49 (Pro) + $0.85 (15% share) | - |
| **순 비용** | $18.50 | $62.70 | - |

**주의**: 이 케이스는 사용량이 적어 Pag0 비용이 더 높음. **가치는 예산 통제와 가시성**에 있음.

**실제 가치**:

- 예산 초과 방지: 세션당 $1 한도로 폭주 방지 (월 1회 폭주 시 $20 절감 -> 연 $240)
- 비용 가시성: 도구별 비용 추적으로 최적화 의사결정
- 사용자 신뢰: 투명한 비용 정보로 MCP 채택률 증가

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - MCP Bridge 미들웨어 아키텍처, 세션 스코프 캐시 구현 상세
- [04-API-SPEC](04-API-SPEC.md) - `Pag0MCPBridge`, `getSessionSummary()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - `@pag0/mcp-bridge` 패키지 설치 및 Claude Desktop 설정 가이드
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - MCP 생태계 통합 전략

---

← [UC3: DeFi 트레이딩 에이전트](09-03-UC-DEFI-TRADING.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC5 →](09-05-UC-API-CURATION.md)
