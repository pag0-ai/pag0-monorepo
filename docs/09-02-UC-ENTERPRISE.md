# UC2: Enterprise Team Management

← [UC1: AI Research Agent](09-01-UC-AI-RESEARCH.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC3 →](09-03-UC-DEFI-TRADING.md)

---

> **TL;DR**: When 10 business units of a global IT company operate AI agents independently, Pag0 Enterprise automates team-level budget allocation, approval workflows, real-time monitoring, and compliance reporting to save over $50K per month and achieve 8.8x ROI.

---

## Scenario

**Background**:

- 10 business units of a global IT company
- Each team operates AI agents independently
- Central IT/Finance team needs company-wide spending management
- Team-level budget allocation and approval workflow required

**Problems (Without Pag0)**:

```yaml
Lack of Visibility:
  - Unknown total company-wide AI spending
  - Cannot separate costs by team
  - No real-time monitoring

Lack of Control:
  - Cannot set team-level budgets
  - No approval process for high-value requests
  - Delayed policy violation detection

Audit Difficulties:
  - Cannot track spending history
  - Difficult to generate compliance reports
  - Cannot detect anomalous transactions
```

**Solution (With Pag0 Enterprise)**:

```typescript
// 1. Central IT Team: Organization-wide setup
import { createPag0Organization } from "@pag0/sdk";

const org = createPag0Organization({
  apiKey: process.env.PAG0_ORG_API_KEY,
  orgId: "acme-corp",

  // Company-wide default policy
  globalPolicy: {
    monthlyBudget: "100000000",    // Company-wide monthly $100 limit
    requireApprovalAbove: "500000", // Require approval above $0.50
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
    complianceMode: "EU_AI_ACT",    // Compliance regulation adherence
    auditLog: {
      enabled: true,
      retention: 90                 // 90 day retention
    }
  },

  // Alert settings
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

// 2. Create team-level projects and allocate budgets
const teams = [
  { name: "Sales AI", budget: "15000000" },      // $15/month
  { name: "Marketing AI", budget: "20000000" },  // $20/month
  { name: "Support AI", budget: "25000000" },    // $25/month
  { name: "R&D AI", budget: "30000000" },        // $30/month
  // ... total 10 teams
];

for (const team of teams) {
  await org.createProject({
    name: team.name,
    policy: {
      monthlyBudget: team.budget,
      maxPerRequest: "200000",       // Max $0.20/request per team
      dailyBudget: String(parseInt(team.budget) / 30),

      // Team-level approval workflow
      approvalWorkflow: {
        enabled: true,
        approvers: [`${team.name.toLowerCase()}-lead@acme.com`],
        autoApproveBelow: "100000",  // Auto-approve below $0.10
        requireApprovalAbove: "100000"
      }
    },

    // Team-level caching policy
    cache: {
      enabled: true,
      sharedCache: true,             // Share cache across teams
      defaultTTL: 1800
    }
  });
}

// 3. Individual Team: Agent code
// (Example: Sales AI team)
import { createPag0Client } from "@pag0/sdk";

const salesAgent = createPag0Client({
  apiKey: process.env.PAG0_SALES_API_KEY,
  projectId: "sales-ai",

  // Inherit team policy + additional restrictions
  policy: {
    // Automatically inherit organization policy
    additionalRestrictions: {
      allowedEndpoints: [
        "api.openai.com",            // Sales team uses OpenAI only
        "api.salesforce.com"
      ],
      workingHours: {
        timezone: "America/New_York",
        start: "09:00",
        end: "18:00"                 // Operate during business hours only
      }
    }
  },

  // Team-level tags (for cost tracking)
  tags: {
    department: "Sales",
    costCenter: "CC-1001",
    environment: "production"
  }
});

// 4. High-value request approval flow
async function processHighValueRequest(leadId: string) {
  try {
    // High-cost request (e.g., bulk GPT-4 calls)
    const response = await salesAgent.fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model: "gpt-4",
          messages: [/* ... */],
          max_tokens: 2000              // Estimated cost ~$0.12
        }),

        // Specify that approval is required
        pag0Meta: {
          requiresApproval: true,
          businessJustification: `Lead ${leadId} qualification - high value enterprise deal`,
          requestedBy: "john.doe@acme.com"
        }
      }
    );

    if (response.status === 202) {
      // Pending approval
      console.log("Request pending approval:", response.meta.approvalId);

      // Wait for approval (polling or webhook)
      const approved = await waitForApproval(response.meta.approvalId);

      if (approved) {
        // Execute actual request after approval
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
      // Send Slack notification
      notifyTeamLead("Budget exceeded - request blocked");
    }
    throw error;
  }
}

// 5. Central IT: Company-wide monitoring from dashboard
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

  // Output example:
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
  //       violations: 2,              // 2 policy violations
  //       anomalies: 1                // 1 anomalous transaction
  //     },
  //     // ... other teams
  //   ],
  //
  //   complianceStatus: "COMPLIANT",
  //   auditTrail: "90 days retained",
  //   recommendations: [
  //     "Recommend increasing Support AI team budget by 10%",
  //     "R&D AI team cache utilization low (22%) - optimization needed"
  //   ]
  // }

  // Generate PDF report (for compliance)
  await org.exportReport({
    format: "pdf",
    template: "EU_AI_ACT_COMPLIANCE",
    recipient: "auditor@acme.com"
  });
}
```

---

## Organization Structure Diagram

```
                    ┌─────────────────────────────────┐
                    │   Pag0 Organization Console     │
                    │   (Central IT/Finance Team)     │
                    │                                  │
                    │  • Company-wide policy setup     │
                    │  • Team-level budget allocation  │
                    │  • Real-time monitoring          │
                    │  • Compliance reports            │
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

## Cost Savings and Efficiency Gains

**Company-wide Level (10 teams)**:

| Item | Without Pag0 | With Pag0 Enterprise | Savings/Impact |
|------|--------------|---------------------|-----------|
| **Monthly Costs** |
| Total API spending | $147,000 | $87,432 | -$59,568 (40%) |
| Pag0 subscription | $0 | $299 | - |
| Pag0 Savings Share (15%) | $0 | $8,935 | - |
| Net spending | $147,000 | $96,666 | **-$50,334 (34%)** |
| **Operational Efficiency** |
| Proactive budget overrun prevention | 0 cases (detected after) | Avg 12 cases prevented/month | Prevented $18,000 loss |
| Policy violation detection | Post-analysis (weekly) | Real-time alerts | 95% faster response time |
| Compliance reports | Manual generation (40 hours/month) | Auto-generation (1 click) | $4,000/month labor cost saved |
| **Governance** |
| Approval process | Email (avg 2 hours) | Automated (avg 10 minutes) | 12x faster decision making |
| Anomaly detection | None | ML-based auto detection | Enhanced security |
| Audit trail | Partial (30 days) | Complete audit log (90 days) | Compliance fulfilled |

---

## ROI Calculation

```yaml
Monthly Investment:
  Pag0 Enterprise: $299
  Savings Share: $8,935
  Total Investment: $9,234

Monthly Value:
  API cost savings: $59,568
  Budget overrun prevention: $18,000 (estimated)
  Compliance automation: $4,000
  Total Value: $81,568

ROI: 8.8x
Annual Net Profit: ($81,568 - $9,234) × 12 = $868,008
```

---

## Related Documents

- [03-TECH-SPEC](03-TECH-SPEC.md) - Organization/project hierarchy structure, policy inheritance mechanism details
- [04-API-SPEC](04-API-SPEC.md) - `createPag0Organization()`, `org.createProject()`, `org.getAnalytics()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - Enterprise SDK setup and team-level client creation guide
- [01-PRODUCT-BRIEF](01-PRODUCT-BRIEF.md) - Enterprise plan and pricing policy

---

← [UC1: AI Research Agent](09-01-UC-AI-RESEARCH.md) | [Use Cases Index](09-00-USE-CASES-INDEX.md) | [Next: UC3 →](09-03-UC-DEFI-TRADING.md)
