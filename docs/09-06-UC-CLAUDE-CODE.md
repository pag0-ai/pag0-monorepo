# UC6: Claude Code 멀티에이전트 세션

← [UC5: API 큐레이션 자동 최적화](09-05-UC-API-CURATION.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md)

---

> **TL;DR**: Claude Code CLI의 Autopilot/Ralph/Ultrawork 루프에서 다수의 서브에이전트(executor, debugger, researcher, reviewer)가 병렬로 유료 x402 API를 호출할 때, Pag0의 세션 예산($5), 에이전트별 격리 예산, 크로스-에이전트 공유 캐시(40% 히트)로 폭주를 방지하고 중복 비용을 37% 절감하는 사례입니다.

---

## 시나리오

**배경**:

- 개발자가 Claude Code CLI로 복잡한 코딩 작업 수행
- Autopilot/Ralph 루프로 에이전트가 자율 실행
- 세션 중 다수의 서브에이전트 병렬 생성 (executor, debugger, researcher, reviewer 등)
- 각 에이전트가 유료 x402 API 호출 (LLM 보조, 검색, 번역, 코드 분석 등)
- 한 세션에 50~500회 이상의 유료 API 호출 발생 가능

**문제점 (Without Pag0)**:

```yaml
폭주 위험:
  - Autopilot 루프가 유료 API 무한 호출
  - Ralph 루프 (자기참조 반복)에서 비용 제한 없음
  - 서브에이전트 5개 병렬 실행 → 비용 5배 증가 가능
  - 한 세션에서 $50+ 발생 사례 (코드 리뷰 + 검색 반복)

가시성 부재:
  - 세션 종료 전까지 총 비용 모름
  - 어느 에이전트가 비용을 많이 쓰는지 추적 불가
  - 도구별/에이전트별 비용 분리 불가

중복 낭비:
  - Researcher가 조회한 문서를 Executor가 다시 조회
  - 같은 API 문서를 Debugger와 Reviewer가 중복 검색
  - 병렬 에이전트 간 캐시 공유 안 됨

통제 부재:
  - 에이전트별 예산 설정 불가
  - "비싼 API는 승인 후 사용" 같은 정책 불가
  - 세션 중간에 비용 한도 도달해도 알림 없음
```

**솔루션 (With Pag0)**:

```typescript
// 1. 세션 초기화: 전체 세션 + 에이전트별 예산 설정
import { createPag0Client } from "@pag0/sdk";

// 세션 레벨 클라이언트 (전체 예산 관리)
const sessionPag0 = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // 세션 전체 Spend Firewall
  policy: {
    sessionBudget: "5000000",       // 세션당 $5 한도
    dailyBudget: "20000000",        // 일일 $20 한도
    maxPerRequest: "500000",        // 요청당 최대 $0.50
    allowedEndpoints: [
      "api.openai.com/*",
      "api.anthropic.com/*",
      "api.deepl.com/*",
      "api.tavily.com/*",
      "api.exa.ai/*"
    ],
    alertOnThreshold: 0.7           // 70% 사용 시 알림
  },

  // 에이전트 간 공유 캐시
  cache: {
    enabled: true,
    scope: "session",               // 세션 내 전 에이전트가 캐시 공유
    defaultTTL: 1800,               // 30분 (세션 내 유효)
    ttlRules: [
      { pattern: ".*docs.*", ttl: 3600 },      // 문서 조회: 1시간
      { pattern: ".*search.*", ttl: 600 },      // 검색: 10분
      { pattern: ".*completions.*", ttl: 1800 } // LLM: 30분
    ]
  },

  // 세션 분석
  analytics: {
    enabled: true,
    groupBy: ["agent", "tool", "endpoint"],
    realtime: true                  // 실시간 비용 추적
  }
});

// 2. 에이전트별 격리된 클라이언트 생성
function createAgentClient(
  agentName: string,
  agentBudget: string,
  allowedAPIs: string[]
) {
  return sessionPag0.createChildClient({
    agentId: agentName,

    // 에이전트별 예산 격리
    policy: {
      agentBudget: agentBudget,     // 에이전트별 한도
      allowedEndpoints: allowedAPIs, // 에이전트별 API 제한
      inheritParentPolicy: true      // 세션 정책 상속
    },

    // 부모 캐시 공유 (읽기/쓰기 모두)
    cache: {
      inheritParentCache: true       // 다른 에이전트의 캐시 활용
    },

    // 에이전트별 태그
    tags: {
      agent: agentName,
      session: sessionPag0.sessionId,
      role: agentName.split("-")[0]  // executor, debugger 등
    }
  });
}

// 에이전트별 클라이언트
const executorPag0 = createAgentClient(
  "executor-1",
  "2000000",                        // Executor: $2 한도
  ["api.openai.com/*", "api.anthropic.com/*"]
);

const researcherPag0 = createAgentClient(
  "researcher-1",
  "1500000",                        // Researcher: $1.50 한도
  ["api.tavily.com/*", "api.exa.ai/*", "api.deepl.com/*"]
);

const debuggerPag0 = createAgentClient(
  "debugger-1",
  "1000000",                        // Debugger: $1 한도
  ["api.openai.com/*"]
);

const reviewerPag0 = createAgentClient(
  "reviewer-1",
  "500000",                         // Reviewer: $0.50 한도
  ["api.openai.com/*"]
);

// 3. Autopilot 루프에서 사용
async function autopilotLoop(task: string) {
  let iteration = 0;
  const maxIterations = 20;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`[Autopilot] Iteration ${iteration}/${maxIterations}`);

    // 3.1 Research 단계 (유료 검색 API)
    const searchResult = await researcherPag0.fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        body: JSON.stringify({ query: task, max_results: 5 })
      }
    );

    console.log("[Researcher] Search:", {
      cached: searchResult.meta.cached,   // 이전 iteration 캐시 히트 가능
      cost: searchResult.meta.cost,
      agentBudgetRemaining: searchResult.meta.budgetRemaining
    });

    // 3.2 Execute 단계 (유료 LLM API)
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

    // 3.3 Review 단계
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

    // 3.4 완료 판단
    if (review.approved) {
      console.log("[Autopilot] Task completed!");
      break;
    }

    // 3.5 세션 예산 체크 (자동)
    const sessionStatus = await sessionPag0.getBudgetStatus("session");
    if (sessionStatus.utilizationRate > 0.9) {
      console.warn("[Pag0] ⚠️ 90% session budget used - stopping autopilot");
      break;
    }
  }

  // 4. 세션 종료 리포트
  return await sessionPag0.getSessionReport();
}

// 4. Ralph 루프 (자기참조 반복) 보호
async function ralphLoop(goal: string) {
  const ralphPag0 = createAgentClient(
    "ralph-loop",
    "3000000",                      // Ralph 전용 $3 한도
    ["api.openai.com/*", "api.tavily.com/*"]
  );

  let attempt = 0;

  while (true) {
    attempt++;

    try {
      // Ralph는 goal 달성까지 반복
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
        // Ralph 예산 소진 → 루프 강제 종료
        console.warn("[Pag0] Ralph budget exceeded - loop terminated");
        console.warn(`[Pag0] Spent: $${error.details.spent}, Limit: $3.00`);

        // 세션은 계속 가능 (다른 에이전트 예산은 남아있음)
        return { status: "budget_exceeded", attempts: attempt };
      }
      throw error;
    }
  }
}

// 5. 병렬 에이전트 실행 (Ultrawork 모드)
async function ultraworkMode(tasks: string[]) {
  // 5개 에이전트 병렬 실행
  const agents = tasks.map((task, i) =>
    createAgentClient(
      `ultrawork-${i}`,
      "1000000",                    // 각 에이전트 $1 한도
      ["api.openai.com/*", "api.tavily.com/*"]
    )
  );

  console.log(`[Ultrawork] Launching ${agents.length} parallel agents`);

  // 병렬 실행 (캐시는 공유됨!)
  const results = await Promise.all(
    tasks.map(async (task, i) => {
      const agent = agents[i];

      // 에이전트 A가 조회한 결과를 에이전트 B가 캐시 히트
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

  // 6. 세션 리포트
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
  //     { agent: "ultrawork-2", cost: "$0.20", requests: 3, budgetUsed: "20%" },  ← 캐시 히트
  //     { agent: "ultrawork-3", cost: "$0.95", requests: 3, budgetUsed: "95%" },
  //     { agent: "ultrawork-4", cost: "$0.80", requests: 3, budgetUsed: "80%" }
  //   ]
  // }

  return results;
}
```

---

## 아키텍처 다이어그램

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
                          │ 모든 에이전트 요청 집중
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
│  에이전트 예산 격리:                                        │
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

## 핵심 시나리오별 방어

### 시나리오 1: Autopilot 무한 루프

```yaml
상황:
  - Autopilot이 "리팩토링 완료"를 달성하지 못함
  - 매 iteration마다 검색 + LLM 호출 = $0.25
  - 제한 없으면 50 iteration → $12.50 발생

Pag0 방어:
  - 세션 예산 $5: 20 iteration 후 자동 중단
  - 70% 알림: 14 iteration에서 경고
  - 에이전트별 한도: Researcher $1.50 소진 시 검색만 중단, Executor는 계속

결과: 최대 $5 지출 (60% 절감)
```

### 시나리오 2: 병렬 에이전트 중복 호출

```yaml
상황:
  - Ultrawork 5개 에이전트 동시 실행
  - 동일 프레임워크 문서를 5개 에이전트가 각각 검색
  - 중복 비용: $0.10 × 5 = $0.50

Pag0 방어:
  - 공유 캐시: 첫 에이전트 조회 → 나머지 4개 캐시 히트
  - 실제 비용: $0.10 (80% 절감)
  - 응답 속도: 캐시 히트 시 <50ms (원본 500ms+)

결과: 병렬 에이전트 중복 비용 80% 제거
```

### 시나리오 3: Ralph 루프 비용 폭주

```yaml
상황:
  - Ralph 루프가 goal 미달성으로 계속 반복
  - 매 시도마다 GPT-4 호출 = $0.15
  - 30번 반복 시 $4.50

Pag0 방어:
  - Ralph 전용 예산 $3: 20번째에서 강제 종료
  - 세션 전체 예산은 보호 (다른 에이전트 영향 없음)
  - 종료 사유와 시도 횟수를 리포트로 제공

결과: Ralph 폭주가 다른 에이전트를 방해하지 않음
```

---

## 비용 비교표

**일반적 코딩 세션 (2시간, 복잡한 기능 구현)**:

| 항목 | Without Pag0 | With Pag0 | 절감 |
|------|--------------|-----------|------|
| **API 호출** |
| 검색 API (Tavily/Exa, 30회) | $0.60 | $0.30 (50% 캐시) | -$0.30 |
| LLM API (GPT-4, 25회) | $3.75 | $2.50 (33% 캐시) | -$1.25 |
| 번역 API (5회) | $0.25 | $0.10 (60% 캐시) | -$0.15 |
| 합계 | $4.60 | $2.90 | **-$1.70** |
| **리스크 방지** |
| Autopilot 폭주 (월 2회) | $25.00 | $10.00 | -$15.00 |
| Ralph 폭주 (월 1회) | $4.50 | $3.00 | -$1.50 |
| **월간 비용 (30 세션)** |
| API 비용 | $138.00 | $87.00 | -$51.00 |
| 폭주 방지 | $29.50 | $13.00 | -$16.50 |
| Pag0 비용 (Pro) | $0 | $49.00 | - |
| Pag0 Savings Share (15%) | $0 | $7.65 | - |
| **순 비용** | **$167.50** | **$156.65** | **-$10.85** |

**주의**: 비용 절감보다 **리스크 통제 + 가시성**이 핵심 가치

---

## 정량적 효과

```yaml
비용 절감:
  캐시 절감: 세션당 $1.70 (37%)
  폭주 방지: 월 $16.50
  연간 절감: $130+

운영 가시성:
  세션별 비용 리포트: 자동 생성
  에이전트별 비용 분석: 어떤 에이전트가 비싼지 즉시 파악
  도구별 비용 추적: 검색 vs LLM vs 번역 비중 확인

리스크 관리:
  세션 예산 한도: 자율 에이전트 폭주 방지
  에이전트별 격리: 하나의 폭주가 전체 세션에 영향 없음
  Kill switch: 예산 90% 시 자동 중단 + 알림

개발자 경험:
  비용 투명성: "이 리팩토링에 API 비용 $3.20 사용"
  예측 가능성: 세션 시작 전 예산 설정으로 안심하고 자율 실행
  최적화 인사이트: "Researcher 에이전트 캐시 히트율 60% — 효율적"
```

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - 세션 스코프 캐시, 에이전트별 예산 격리, Child Client 구현 상세
- [04-API-SPEC](04-API-SPEC.md) - `createChildClient()`, `getBudgetStatus()`, `getSessionReport()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - 멀티에이전트 세션 설정 및 예산 관리 가이드
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Claude Code / MCP 통합 제품 비전

---

← [UC5: API 큐레이션 자동 최적화](09-05-UC-API-CURATION.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md)
