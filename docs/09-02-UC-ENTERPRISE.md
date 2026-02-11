# UC2: 엔터프라이즈 팀 관리

← [UC1: AI 리서치 에이전트](09-01-UC-AI-RESEARCH.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC3 →](09-03-UC-DEFI-TRADING.md)

---

> **TL;DR**: 글로벌 IT 기업의 10개 사업부가 독립적으로 AI 에이전트를 운영할 때, Pag0 Enterprise를 통해 팀별 예산 할당, 승인 워크플로우, 실시간 모니터링, 컴플라이언스 리포트를 자동화하여 월 $50K 이상 절감하고 ROI 8.8배를 달성하는 사례입니다.

---

## 시나리오

**배경**:

- 글로벌 IT 기업의 10개 사업부
- 각 팀이 독립적으로 AI 에이전트 운영
- 중앙 IT/재무팀이 전사 지출 관리 필요
- 팀별 예산 할당 및 승인 워크플로우 요구

**문제점 (Without Pag0)**:

```yaml
가시성 부재:
  - 전사 AI 지출 총액 모름
  - 팀별 비용 분리 불가
  - 실시간 모니터링 불가

통제 부재:
  - 팀별 예산 설정 불가
  - 고액 요청 승인 프로세스 없음
  - 정책 위반 감지 지연

감사 어려움:
  - 지출 내역 추적 불가
  - 컴플라이언스 리포트 생성 어려움
  - 이상 거래 탐지 불가
```

**솔루션 (With Pag0 Enterprise)**:

```typescript
// 1. 중앙 IT 팀: 조직 전체 설정
import { createPag0Organization } from "@pag0/sdk";

const org = createPag0Organization({
  apiKey: process.env.PAG0_ORG_API_KEY,
  orgId: "acme-corp",

  // 전사 기본 정책
  globalPolicy: {
    monthlyBudget: "100000000",    // 전사 월 $100 한도
    requireApprovalAbove: "500000", // $0.50 초과 시 승인 필요
    allowedCategories: [
      "translation",
      "llm",
      "search",
      "data-analysis"
    ],
    blockedEndpoints: [
      "suspicious-api.com",
      "untrusted-provider.xyz"
    ],
    complianceMode: "EU_AI_ACT",    // 컴플라이언스 규정 준수
    auditLog: {
      enabled: true,
      retention: 90                 // 90일 보관
    }
  },

  // 알림 설정
  alerts: {
    channels: ["email", "slack"],
    recipients: ["cfo@acme.com", "it-security@acme.com"],
    triggers: {
      budgetThreshold: 0.8,
      anomalyDetection: true,
      policyViolation: true,
      highCostRequest: "$1.00"
    }
  }
});

// 2. 팀별 프로젝트 생성 및 예산 할당
const teams = [
  { name: "Sales AI", budget: "15000000" },      // $15/월
  { name: "Marketing AI", budget: "20000000" },  // $20/월
  { name: "Support AI", budget: "25000000" },    // $25/월
  { name: "R&D AI", budget: "30000000" },        // $30/월
  // ... 총 10개 팀
];

for (const team of teams) {
  await org.createProject({
    name: team.name,
    policy: {
      monthlyBudget: team.budget,
      maxPerRequest: "200000",       // 팀당 최대 $0.20/요청
      dailyBudget: String(parseInt(team.budget) / 30),

      // 팀별 승인 워크플로우
      approvalWorkflow: {
        enabled: true,
        approvers: [`${team.name.toLowerCase()}-lead@acme.com`],
        autoApproveBelow: "100000",  // $0.10 이하는 자동 승인
        requireApprovalAbove: "100000"
      }
    },

    // 팀별 캐싱 정책
    cache: {
      enabled: true,
      sharedCache: true,             // 팀 간 캐시 공유
      defaultTTL: 1800
    }
  });
}

// 3. 개별 팀: 에이전트 코드
// (예: Sales AI 팀)
import { createPag0Client } from "@pag0/sdk";

const salesAgent = createPag0Client({
  apiKey: process.env.PAG0_SALES_API_KEY,
  projectId: "sales-ai",

  // 팀 정책 상속 + 추가 제약
  policy: {
    // 조직 정책 자동 상속
    additionalRestrictions: {
      allowedEndpoints: [
        "api.openai.com",            // Sales 팀은 OpenAI만 사용
        "api.salesforce.com"
      ],
      workingHours: {
        timezone: "America/New_York",
        start: "09:00",
        end: "18:00"                 // 업무 시간에만 작동
      }
    }
  },

  // 팀별 태그 (비용 추적용)
  tags: {
    department: "Sales",
    costCenter: "CC-1001",
    environment: "production"
  }
});

// 4. 고액 요청 승인 플로우
async function processHighValueRequest(leadId: string) {
  try {
    // 비용이 높은 요청 (예: 대량 GPT-4 호출)
    const response = await salesAgent.fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model: "gpt-4",
          messages: [/* ... */],
          max_tokens: 2000              // 예상 비용 ~$0.12
        }),

        // 승인 필요한 요청임을 명시
        pag0Meta: {
          requiresApproval: true,
          businessJustification: `Lead ${leadId} qualification - high value enterprise deal`,
          requestedBy: "john.doe@acme.com"
        }
      }
    );

    if (response.status === 202) {
      // 승인 대기 중
      console.log("Request pending approval:", response.meta.approvalId);

      // 승인 대기 (폴링 또는 웹훅)
      const approved = await waitForApproval(response.meta.approvalId);

      if (approved) {
        // 승인 후 실제 요청
        return await salesAgent.executeApprovedRequest(response.meta.approvalId);
      } else {
        console.log("Request denied by manager");
        return null;
      }
    }

    return response;

  } catch (error) {
    if (error.code === "BUDGET_EXCEEDED") {
      console.error("Team budget exceeded for this month");
      // Slack 알림 발송
      notifyTeamLead("Budget exceeded - request blocked");
    }
    throw error;
  }
}

// 5. 중앙 IT: 대시보드에서 전사 모니터링
async function generateMonthlyReport() {
  const report = await org.getAnalytics({
    period: "month",
    groupBy: ["project", "costCenter", "endpoint"],
    metrics: [
      "totalCost",
      "totalRequests",
      "cacheHitRate",
      "avgLatency",
      "budgetUtilization"
    ]
  });

  console.log("Enterprise Dashboard:", report);

  // Output 예시:
  // {
  //   totalCost: "$87,432",
  //   totalBudget: "$100,000",
  //   utilizationRate: "87.4%",
  //
  //   byTeam: [
  //     {
  //       team: "Sales AI",
  //       spent: "$14,250",
  //       budget: "$15,000",
  //       utilizationRate: "95%",
  //       topEndpoints: ["api.openai.com", "api.salesforce.com"],
  //       cacheHitRate: "42%",
  //       savings: "$10,800"
  //     },
  //     {
  //       team: "Support AI",
  //       spent: "$18,900",
  //       budget: "$25,000",
  //       utilizationRate: "75.6%",
  //       violations: 2,              // 정책 위반 2건
  //       anomalies: 1                // 이상 거래 1건
  //     },
  //     // ... 기타 팀
  //   ],
  //
  //   complianceStatus: "COMPLIANT",
  //   auditTrail: "90 days retained",
  //   recommendations: [
  //     "Support AI 팀 예산 10% 증액 권장",
  //     "R&D AI 팀 캐시 활용률 낮음 (22%) - 최적화 필요"
  //   ]
  // }

  // PDF 리포트 생성 (컴플라이언스용)
  await org.exportReport({
    format: "pdf",
    template: "EU_AI_ACT_COMPLIANCE",
    recipient: "auditor@acme.com"
  });
}
```

---

## 조직 구조 다이어그램

```
                    ┌─────────────────────────────────┐
                    │   Pag0 Organization Console     │
                    │   (Central IT/Finance Team)     │
                    │                                  │
                    │  • 전사 정책 설정                 │
                    │  • 팀별 예산 할당                 │
                    │  • 실시간 모니터링                │
                    │  • 컴플라이언스 리포트            │
                    └────────────┬────────────────────┘
                                 │
                    Global Policy + Budget: $100/mo
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  Sales AI    │        │ Support AI   │   ...  │   R&D AI     │
│  Team ($15)  │        │  Team ($25)  │        │  Team ($30)  │
└──────┬───────┘        └──────┬───────┘        └──────┬───────┘
       │                       │                       │
       │ OpenAI + Salesforce   │ OpenAI + Zendesk      │ All APIs
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Pag0 Smart Proxy Layer                     │
│                                                              │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Policy Enforce   │  │ Shared Cache │  │  Analytics    │ │
│  │ • Team budgets   │  │ • Cross-team │  │ • Cost track  │ │
│  │ • Approval flow  │  │ • 45% hit    │  │ • Anomaly det │ │
│  │ • Whitelist      │  │ • TTL 30min  │  │ • Audit log   │ │
│  └──────────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 비용 절감 및 효율화 효과

**전사 레벨 (10개 팀)**:

| 항목 | Without Pag0 | With Pag0 Enterprise | 절감/효과 |
|------|--------------|---------------------|-----------|
| **월별 비용** |
| API 총 지출 | $147,000 | $87,432 | -$59,568 (40%) |
| Pag0 구독료 | $0 | $299 | - |
| Pag0 Savings Share (15%) | $0 | $8,935 | - |
| 순 지출 | $147,000 | $96,666 | **-$50,334 (34%)** |
| **운영 효율** |
| 예산 초과 사전 차단 | 0건 (사후 발견) | 월 평균 12건 사전 차단 | 예상 손실 $18,000 방지 |
| 정책 위반 탐지 | 사후 분석 (주 1회) | 실시간 알림 | 대응 시간 95% 단축 |
| 컴플라이언스 리포트 | 수동 생성 (40시간/월) | 자동 생성 (1클릭) | 인건비 $4,000/월 절감 |
| **거버넌스** |
| 승인 프로세스 | 이메일 (평균 2시간) | 자동화 (평균 10분) | 의사결정 속도 12배 |
| 이상 거래 탐지 | 없음 | ML 기반 자동 탐지 | 보안 강화 |
| 감사 추적 | 부분적 (30일) | 완전한 감사 로그 (90일) | 컴플라이언스 충족 |

---

## ROI 계산

```yaml
월별 투자:
  Pag0 Enterprise: $299
  Savings Share: $8,935
  총 투자: $9,234

월별 가치:
  API 비용 절감: $59,568
  예산 초과 방지: $18,000 (추정)
  컴플라이언스 자동화: $4,000
  총 가치: $81,568

ROI: 8.8배
연간 순이익: ($81,568 - $9,234) × 12 = $868,008
```

---

## 관련 문서

- [03-TECH-SPEC](03-TECH-SPEC.md) - 조직/프로젝트 계층 구조, 정책 상속 메커니즘 상세
- [04-API-SPEC](04-API-SPEC.md) - `createPag0Organization()`, `org.createProject()`, `org.getAnalytics()` API 레퍼런스
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - Enterprise SDK 설정 및 팀별 클라이언트 생성 가이드
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Enterprise 플랜 및 가격 정책

---

← [UC1: AI 리서치 에이전트](09-01-UC-AI-RESEARCH.md) | [유스케이스 목록](09-00-USE-CASES-INDEX.md) | [다음: UC3 →](09-03-UC-DEFI-TRADING.md)
