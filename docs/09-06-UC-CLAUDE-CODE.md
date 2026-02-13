# UC6: Claude Code Multi-Agent Sessions

← [UC5: Automated API Curation Optimization](09-05-UC-API-CURATION.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md)

---

> **TL;DR**: When multiple sub-agents (executor, debugger, researcher, reviewer) in Claude Code CLI's Autopilot/Ralph/Ultrawork loops make parallel paid x402 API calls, Pag0's session budget ($5), per-agent isolated budgets, and cross-agent shared cache (40% hit rate) prevent runaway spending and reduce duplicate costs by 37%.

---

## Scenario

**Background**:

- Developer performs complex coding tasks with Claude Code CLI
- Agents run autonomously via Autopilot/Ralph loops
- Multiple sub-agents spawned in parallel during session (executor, debugger, researcher, reviewer, etc.)
- Each agent calls paid x402 APIs (LLM assistance, search, translation, code analysis, etc.)
- Single session can generate 50-500+ paid API calls

**Problems (Without Pag0)**:

```yaml
Runaway Risk:
  - Autopilot loop infinitely calls paid APIs
  - Ralph loop (self-referential iteration) has no cost limits
  - 5 parallel sub-agents → 5x cost multiplication possible
  - Single session $50+ incidents (code review + repeated searches)

Visibility Gap:
  - Total cost unknown until session ends
  - Cannot track which agent is spending the most
  - No separation of costs by tool/agent

Duplicate Waste:
  - Executor re-fetches docs already retrieved by Researcher
  - Debugger and Reviewer duplicate searches for same API docs
  - No cache sharing between parallel agents

Control Gap:
  - Cannot set per-agent budgets
  - Cannot enforce policies like "expensive APIs require approval"
  - No alerts when cost limit reached mid-session
```

**Solution (With Pag0)**:

```typescript
// 1. Session initialization: Overall session + per-agent budget setup
import { createPag0Client } from "@pag0/sdk";

// Session-level client (overall budget management)
const sessionPag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // Session-wide Spend Firewall
  policy: {
    sessionBudget: "5000000",       // $5 limit per session
    dailyBudget: "20000000",        // $20 daily limit
    maxPerRequest: "500000",        // Max $0.50 per request
    allowedEndpoints: [
      "api.openai.com/*",
      "api.anthropic.com/*",
      "api.deepl.com/*",
      "api.tavily.com/*",
      "api.exa.ai/*"
    ],
    alertOnThreshold: 0.7           // Alert at 70% usage
  },

  // Cross-agent shared cache
  cache: {
    enabled: true,
    scope: "session",               // All agents in session share cache
    defaultTTL: 1800,               // 30min (valid within session)
    ttlRules: [
      { pattern: ".*docs.*", ttl: 3600 },      // Doc lookups: 1 hour
      { pattern: ".*search.*", ttl: 600 },      // Searches: 10 min
      { pattern: ".*completions.*", ttl: 1800 } // LLM: 30 min
    ]
  },

  // Session analytics
  analytics: {
    enabled: true,
    groupBy: ["agent", "tool", "endpoint"],
    realtime: true                  // Real-time cost tracking
  }
});

// 2. Create isolated per-agent clients
function createAgentClient(
  agentName: string,
  agentBudget: string,
  allowedAPIs: string[]
) {
  return sessionPag0.createChildClient({
    agentId: agentName,

    // Per-agent budget isolation
    policy: {
      agentBudget: agentBudget,     // Per-agent limit
      allowedEndpoints: allowedAPIs, // Per-agent API restrictions
      inheritParentPolicy: true      // Inherit session policy
    },

    // Share parent cache (read/write)
    cache: {
      inheritParentCache: true       // Leverage other agents' cache
    },

    // Per-agent tags
    tags: {
      agent: agentName,
      session: sessionPag0.sessionId,
      role: agentName.split("-")[0]  // executor, debugger, etc.
    }
  });
}

// Per-agent clients
const executorPag0 = createAgentClient(
  "executor-1",
  "2000000",                        // Executor: $2 limit
  ["api.openai.com/*", "api.anthropic.com/*"]
);

const researcherPag0 = createAgentClient(
  "researcher-1",
  "1500000",                        // Researcher: $1.50 limit
  ["api.tavily.com/*", "api.exa.ai/*", "api.deepl.com/*"]
);

const debuggerPag0 = createAgentClient(
  "debugger-1",
  "1000000",                        // Debugger: $1 limit
  ["api.openai.com/*"]
);

const reviewerPag0 = createAgentClient(
  "reviewer-1",
  "500000",                         // Reviewer: $0.50 limit
  ["api.openai.com/*"]
);

// 3. Use in Autopilot loop
async function autopilotLoop(task: string) {
  let iteration = 0;
  const maxIterations = 20;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`[Autopilot] Iteration ${iteration}/${maxIterations}`);

    // 3.1 Research phase (paid search API)
    const searchResult = await researcherPag0.fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        body: JSON.stringify({ query: task, max_results: 5 })
      }
    );

    console.log("[Researcher] Search:", {
      cached: searchResult.meta.cached,   // Can hit cache from previous iteration
      cost: searchResult.meta.cost,
      agentBudgetRemaining: searchResult.meta.budgetRemaining
    });

    // 3.2 Execute phase (paid LLM API)
    const codeResult = await executorPag0.fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a code generator." },
            { role: "user", content: `Task: ${task}\nContext: ${await searchResult.json()}` }
          ]
        })
      }
    );

    // 3.3 Review phase
    const reviewResult = await reviewerPag0.fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a code reviewer." },
            { role: "user", content: `Review this code: ${await codeResult.json()}` }
          ]
        })
      }
    );

    const review = await reviewResult.json();

    // 3.4 Completion check
    if (review.approved) {
      console.log("[Autopilot] Task completed!");
      break;
    }

    // 3.5 Session budget check (automatic)
    const sessionStatus = await sessionPag0.getBudgetStatus("session");
    if (sessionStatus.utilizationRate > 0.9) {
      console.warn("[Pag0] ⚠️ 90% session budget used - stopping autopilot");
      break;
    }
  }

  // 4. Session end report
  return await sessionPag0.getSessionReport();
}

// 4. Ralph loop (self-referential iteration) protection
async function ralphLoop(goal: string) {
  const ralphPag0 = createAgentClient(
    "ralph-loop",
    "3000000",                      // Ralph-dedicated $3 limit
    ["api.openai.com/*", "api.tavily.com/*"]
  );

  let attempt = 0;

  while (true) {
    attempt++;

    try {
      // Ralph repeats until goal achieved
      const result = await ralphPag0.fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: goal }]
          })
        }
      );

      if (isGoalMet(await result.json())) {
        console.log(`[Ralph] Goal met after ${attempt} attempts`);
        break;
      }

    } catch (error) {
      if (error.code === "AGENT_BUDGET_EXCEEDED") {
        // Ralph budget exhausted → force terminate loop
        console.warn("[Pag0] Ralph budget exceeded - loop terminated");
        console.warn(`[Pag0] Spent: $${error.details.spent}, Limit: $3.00`);

        // Session can continue (other agent budgets remain)
        return { status: "budget_exceeded", attempts: attempt };
      }
      throw error;
    }
  }
}

// 5. Parallel agent execution (Ultrawork mode)
async function ultraworkMode(tasks: string[]) {
  // Launch 5 agents in parallel
  const agents = tasks.map((task, i) =>
    createAgentClient(
      `ultrawork-${i}`,
      "1000000",                    // Each agent $1 limit
      ["api.openai.com/*", "api.tavily.com/*"]
    )
  );

  console.log(`[Ultrawork] Launching ${agents.length} parallel agents`);

  // Parallel execution (cache is shared!)
  const results = await Promise.all(
    tasks.map(async (task, i) => {
      const agent = agents[i];

      // Agent B can hit cache for results fetched by Agent A
      const research = await agent.fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          body: JSON.stringify({ query: task })
        }
      );

      console.log(`[Agent-${i}] Research: cached=${research.meta.cached}`);

      const implementation = await agent.fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: task }]
          })
        }
      );

      return {
        task,
        result: await implementation.json(),
        cost: research.meta.cost + implementation.meta.cost,
        cached: research.meta.cached
      };
    })
  );

  // 6. Session report
  const report = await sessionPag0.getSessionReport();

  console.log("[Ultrawork] Session Report:", {
    totalCost: `$${(report.totalCost / 1e6).toFixed(2)}`,
    totalRequests: report.totalRequests,
    cacheHitRate: `${(report.cacheHitRate * 100).toFixed(0)}%`,
    cacheSavings: `$${(report.cacheSavings / 1e6).toFixed(2)}`,

    byAgent: report.byAgent.map(a => ({
      agent: a.agentId,
      cost: `$${(a.cost / 1e6).toFixed(2)}`,
      requests: a.requests,
      budgetUsed: `${(a.budgetUtilization * 100).toFixed(0)}%`
    }))
  });

  // Output:
  // {
  //   totalCost: "$3.20",
  //   totalRequests: 15,
  //   cacheHitRate: "40%",
  //   cacheSavings: "$1.80",
  //   byAgent: [
  //     { agent: "ultrawork-0", cost: "$0.70", requests: 3, budgetUsed: "70%" },
  //     { agent: "ultrawork-1", cost: "$0.55", requests: 3, budgetUsed: "55%" },
  //     { agent: "ultrawork-2", cost: "$0.20", requests: 3, budgetUsed: "20%" },  ← cache hit
  //     { agent: "ultrawork-3", cost: "$0.95", requests: 3, budgetUsed: "95%" },
  //     { agent: "ultrawork-4", cost: "$0.80", requests: 3, budgetUsed: "80%" }
  //   ]
  // }

  return results;
}
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│              Claude Code CLI Session                      │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Autopilot  │  │   Ralph     │  │   Ultrawork     │  │
│  │   Loop      │  │   Loop      │  │   (5 parallel)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────────┘  │
│         │                │                │              │
│  ┌──────┴──────────────┬─┴────────────┬───┴──────────┐  │
│  │ executor ─ $2 limit │ debugger ─ $1│ reviewer $0.5│  │
│  │ researcher ─ $1.5   │ ralph ─ $3   │ ultrawork ×5 │  │
│  └──────┬──────────────┴──┬───────────┴───┬──────────┘  │
│         │                 │               │              │
│         └─────────────────┴───────────────┘              │
└─────────────────────────┬────────────────────────────────┘
                          │ All agent requests converge
                          ▼
┌──────────────────────────────────────────────────────────┐
│            Pag0 Smart Proxy (Session Scope)               │
│                                                           │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Policy Engine   │  │ Shared Cache │  │  Analytics  │ │
│  │                  │  │              │  │             │ │
│  │ Session: $5 max  │  │ Cross-agent  │  │ Per-agent   │ │
│  │ Per-agent limits │  │ 40% hit rate │  │ cost track  │ │
│  │ Per-req: $0.50   │  │ TTL: 30min   │  │ Real-time   │ │
│  │ Kill switch      │  │ Session scope│  │ Session RPT │ │
│  └──────────────────┘  └──────────────┘  └────────────┘ │
│                                                           │
│  Agent budget isolation:                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │exec $2 │ │res $1.5│ │dbg  $1 │ │rev $0.5│ │ralph $3││
│  │██████░░│ │████░░░░│ │████████│ │██░░░░░░│ │██████░░││
│  │ 75%    │ │ 50%    │ │ 100%!  │ │ 25%    │ │ 80%   ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAI   │ │ Tavily   │ │  DeepL   │
        │   API    │ │ Search   │ │   API    │
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              └────────────┴────────────┘
                           │
                    x402 Payment
```

---

## Defense by Key Scenario

### Scenario 1: Autopilot Infinite Loop

```yaml
Situation:
  - Autopilot fails to achieve "refactoring complete"
  - Each iteration: search + LLM call = $0.25
  - Without limits: 50 iterations → $12.50 cost

Pag0 Defense:
  - Session budget $5: auto-stop after 20 iterations
  - 70% alert: warning at iteration 14
  - Per-agent limits: When Researcher exhausts $1.50, only search stops, Executor continues

Result: Max $5 spend (60% savings)
```

### Scenario 2: Parallel Agent Duplicate Calls

```yaml
Situation:
  - Ultrawork launches 5 agents simultaneously
  - Same framework docs searched by all 5 agents
  - Duplicate cost: $0.10 × 5 = $0.50

Pag0 Defense:
  - Shared cache: First agent fetches → remaining 4 hit cache
  - Actual cost: $0.10 (80% savings)
  - Response speed: <50ms on cache hit (vs 500ms+ original)

Result: 80% elimination of parallel agent duplicate costs
```

### Scenario 3: Ralph Loop Runaway Costs

```yaml
Situation:
  - Ralph loop continues repeating on goal failure
  - Each attempt: GPT-4 call = $0.15
  - 30 repetitions = $4.50

Pag0 Defense:
  - Ralph-dedicated budget $3: force terminate at 20th attempt
  - Overall session budget protected (other agents unaffected)
  - Report provides termination reason and attempt count

Result: Ralph runaway doesn't interfere with other agents
```

---

## Cost Comparison Table

**Typical Coding Session (2 hours, complex feature implementation)**:

| Item | Without Pag0 | With Pag0 | Savings |
|------|--------------|-----------|---------|
| **API Calls** |
| Search API (Tavily/Exa, 30 calls) | $0.60 | $0.30 (50% cache) | -$0.30 |
| LLM API (GPT-4, 25 calls) | $3.75 | $2.50 (33% cache) | -$1.25 |
| Translation API (5 calls) | $0.25 | $0.10 (60% cache) | -$0.15 |
| Subtotal | $4.60 | $2.90 | **-$1.70** |
| **Risk Prevention** |
| Autopilot runaway (2x/month) | $25.00 | $10.00 | -$15.00 |
| Ralph runaway (1x/month) | $4.50 | $3.00 | -$1.50 |
| **Monthly Cost (30 sessions)** |
| API costs | $138.00 | $87.00 | -$51.00 |
| Runaway prevention | $29.50 | $13.00 | -$16.50 |
| Pag0 fee (Pro) | $0 | $49.00 | - |
| Pag0 Savings Share (15%) | $0 | $7.65 | - |
| **Net Cost** | **$167.50** | **$156.65** | **-$10.85** |

**Note**: Core value is **risk control + visibility** over cost savings

---

## Quantitative Impact

```yaml
Cost Savings:
  Cache savings: $1.70 per session (37%)
  Runaway prevention: $16.50 per month
  Annual savings: $130+

Operational Visibility:
  Per-session cost reports: Auto-generated
  Per-agent cost analysis: Instantly identify expensive agents
  Per-tool cost tracking: See search vs LLM vs translation breakdown

Risk Management:
  Session budget limits: Prevent autonomous agent runaways
  Per-agent isolation: One runaway doesn't impact entire session
  Kill switch: Auto-stop at 90% budget + alert

Developer Experience:
  Cost transparency: "This refactoring used $3.20 in API costs"
  Predictability: Set budget before session start, run autonomously with confidence
  Optimization insights: "Researcher agent 60% cache hit rate — efficient"
```

---

## Related Documentation

- [03-TECH-SPEC](03-TECH-SPEC.md) - Session-scoped cache, per-agent budget isolation, Child Client implementation details
- [04-API-SPEC](04-API-SPEC.md) - `createChildClient()`, `getBudgetStatus()`, `getSessionReport()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - Multi-agent session setup and budget management guide
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Claude Code / MCP integration product vision

---

← [UC5: Automated API Curation Optimization](09-05-UC-API-CURATION.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md)
