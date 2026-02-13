# UC4: MCP Server Orchestration

← [UC3: DeFi Trading Agent](09-03-UC-DEFI-TRADING.md) | [Use Case List](09-00-USE-CASES-INDEX.md) | [Next: UC5 →](09-05-UC-API-CURATION.md)

---

> **TL;DR**: When using paid MCP servers (Exa, Browserbase, Firecrawl) in Claude Desktop, the Pag0 MCP Bridge provides session budget limits of $1, per-tool cost tracking, and cross-tool caching (30% hit rate), enabling cost visibility and control.

---

## Scenario

**Background**:

- Claude Desktop uses paid MCP servers
  - Exa (web search): $0.02/search
  - Browserbase (browser automation): $0.10/session
  - Firecrawl (web crawling): $0.05/page
- Costs accumulate during long sessions
- Users are unaware of costs

**Problems (Without Pag0)**:

```yaml
Cost Opacity:
  - Unknown total cost per session
  - No tracking of individual tool call costs
  - Shocked by bills at month end

No Control:
  - Cannot set budgets
  - No pre-approval for expensive operations
  - No automatic shutdown mechanism

Difficult to Optimize:
  - Don't know which MCP servers are cost-efficient
  - Cannot compare alternatives
```

**Solution (With Pag0 + MCP Bridge)**:

```typescript
// 1. Pag0 MCP Bridge Configuration
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    // Pag0-wrapped MCP servers
    "pag0-exa": {
      "command": "npx",
      "args": ["@pag0/mcp-bridge", "exa"],
      "env": {
        "PAG0_API_KEY": "pag0_xxx...",
        "EXA_API_KEY": "exa_xxx...",

        // Pag0 policies
        "PAG0_POLICY_SESSION_BUDGET": "1000000",  // $1 per session
        "PAG0_POLICY_HOURLY_BUDGET": "2000000",   // $2 per hour
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
        "PAG0_POLICY_MAX_PER_REQUEST": "200000",  // max $0.20/session
        "PAG0_CACHE_ENABLED": "true"
      }
    },

    "pag0-firecrawl": {
      "command": "npx",
      "args": ["@pag0/mcp-bridge", "firecrawl"],
      "env": {
        "PAG0_API_KEY": "pag0_xxx...",
        "FIRECRAWL_API_KEY": "fc_xxx...",
        "PAG0_POLICY_MAX_PER_REQUEST": "100000",  // max $0.10/page
        "PAG0_CACHE_ENABLED": "true",
        "PAG0_CACHE_TTL": "3600"  // cache pages for 1 hour
      }
    }
  }
}

// 2. MCP Bridge Implementation (simplified version)
import { MCPServer } from "@modelcontextprotocol/sdk";
import { createPag0Client } from "@pag0/sdk";

class Pag0MCPBridge {
  private pag0: ReturnType<typeof createPag0Client>;
  private upstreamMCP: MCPServer;

  constructor(upstreamConfig: MCPConfig) {
    // Pag0 client
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

    // Original MCP server
    this.upstreamMCP = new MCPServer(upstreamConfig);
  }

  // Wrap MCP tool calls
  async callTool(toolName: string, args: any) {
    console.log(`[Pag0] Calling ${toolName} via Pag0 proxy...`);

    // Call upstream MCP server through Pag0
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

        // Pag0 metadata
        pag0Meta: {
          toolName: toolName,
          sessionId: this.sessionId,
          userContext: "claude-desktop"
        }
      }
    );

    // Log cost information
    console.log(`[Pag0] ${toolName} completed:`, {
      cached: response.meta.cached,
      cost: `$${(parseInt(response.meta.cost) / 1000000).toFixed(4)}`,
      latency: `${response.meta.latency}ms`,
      sessionTotal: `$${(this.sessionCost / 1000000).toFixed(4)}`
    });

    // Track session cumulative cost
    this.sessionCost += parseInt(response.meta.cost);

    // Budget warning
    if (this.sessionCost > 800000) {  // $0.80 (80% of $1 session budget)
      console.warn(`[Pag0] ⚠️ Session budget warning: $${(this.sessionCost / 1000000).toFixed(2)} / $1.00`);
    }

    return await response.json();
  }

  // Session summary on end
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

// 3. Claude Usage Example
/*
User: "Search for latest AI news"

Claude:
[Pag0] Calling exa_search via Pag0 proxy...
[Pag0] exa_search completed: {
  cached: false,
  cost: "$0.0200",
  latency: "450ms",
  sessionTotal: "$0.0200"
}

Found search results:
1. OpenAI GPT-5 announcement...
2. Google Gemini 2.0...

[Internally Pag0 tracks costs]

---

User: "Crawl the first article content"

Claude:
[Pag0] Calling firecrawl_scrape via Pag0 proxy...
[Pag0] firecrawl_scrape completed: {
  cached: false,
  cost: "$0.0500",
  latency: "1200ms",
  sessionTotal: "$0.0700"
}

Article content:
OpenAI announced GPT-5...

---

User: "Find 5 more similar news"

Claude:
[Pag0] Calling exa_search via Pag0 proxy...
[Pag0] exa_search completed: {
  cached: true,  ← Cache hit!
  cost: "$0.0000",
  latency: "25ms",
  sessionTotal: "$0.0700"
}

---

[Session End]
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

Actual payment: $0.0700
Savings: $0.0200 (22%)
*/
```

---

## MCP Bridge Architecture

```
┌─────────────────────┐
│   Claude Desktop    │
│  (User Interface)   │
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
                x402 Payment (billing per MCP server)
```

---

## Cost Comparison (100 monthly sessions)

| Item | Without Pag0 | With Pag0 Bridge | Savings |
|------|--------------|------------------|---------|
| **Tool Usage** |
| Exa (300 searches) | $6.00 | $3.60 (40% cache) | -$2.40 |
| Firecrawl (150 crawls) | $7.50 | $5.25 (30% cache) | -$2.25 |
| Browserbase (50 sessions) | $5.00 | $4.00 (20% cache) | -$1.00 |
| **Total** | $18.50 | $12.85 | **-$5.65 (31%)** |
| **Pag0 Cost** | - | $49 (Pro) + $0.85 (15% share) | - |
| **Net Cost** | $18.50 | $62.70 | - |

**Note**: In this case with low usage, Pag0 costs more. **The value lies in budget control and visibility**.

**Real Value**:

- Prevents budget overruns: $1 session limit prevents runaway costs (1 runaway/month saves $20 -> $240/year)
- Cost visibility: Per-tool cost tracking enables optimization decisions
- User trust: Transparent cost information increases MCP adoption rate

---

## Related Documentation

- [03-TECH-SPEC](03-TECH-SPEC.md) - MCP Bridge middleware architecture, session-scoped cache implementation details
- [04-API-SPEC](04-API-SPEC.md) - `Pag0MCPBridge`, `getSessionSummary()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - `@pag0/mcp-bridge` package installation and Claude Desktop configuration guide
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - MCP ecosystem integration strategy

---

← [UC3: DeFi Trading Agent](09-03-UC-DEFI-TRADING.md) | [Use Case List](09-00-USE-CASES-INDEX.md) | [Next: UC5 →](09-05-UC-API-CURATION.md)
