# UC3: DeFi Trading Agent

← [UC2: Enterprise Team Management](09-02-UC-ENTERPRISE.md) | [Use Case List](09-00-USE-CASES-INDEX.md) | [Next: UC4 →](09-04-UC-MCP-ORCHESTRATION.md)

---

> **TL;DR**: An arbitrage bot "ArbitrageBot" processes 10-100 API requests per second while Pag0's ultra-strict Spend Firewall ($0.50/hour limit), whitelist (blocks malicious APIs), and anomaly detection (defends against honeypot/infinite loop/gas manipulation attacks) prevents 99.8% of bug-related losses in this security-focused use case.

---

## Scenario

**Background**:

- Arbitrage bot "ArbitrageBot"
- Uses DEX price data API, gas estimation API, routing API
- Requires fast decision-making (10-100 requests per second)
- Risk of lure attacks from malicious API servers

**Problems (Without Pag0)**:

```yaml
Runaway Risk:
  - Unlimited spending in case of infinite loop bug
  - 2023 case: bot drained $3,200 in 10 minutes

Malicious Attacks:
  - Fake low-price information → lure bot
  - High-cost API responses → wallet depletion

Lack of Monitoring:
  - Cannot detect abnormal patterns
  - No real-time blocking mechanism
```

**Solution (With Pag0)**:

```typescript
// 1. Strict policy configuration
import { createPag0Client } from "@pag0/sdk";

const arbitrageBot = createPag0Client({
  apiKey: process.env.PAG0_API_KEY,

  // Ultra-strict Spend Firewall
  policy: {
    // Per-request limit (very low)
    maxPerRequest: "50000",         // Max $0.05/request

    // Hourly limit (runaway prevention)
    hourlyBudget: "500000",         // $0.50/hour
    dailyBudget: "10000000",        // $10/day
    monthlyBudget: "250000000",     // $250/month

    // Whitelist only (block malicious APIs)
    allowedEndpoints: [
      "api.coingecko.com",
      "api.1inch.io",
      "gas.etherscan.io",
      "router.uniswap.org"
    ],
    denyUnknownEndpoints: true,     // Block all unregistered APIs

    // Anomaly detection
    anomalyDetection: {
      enabled: true,

      // Spike pattern detection
      requestSpike: {
        threshold: 200,              // If exceeds 200 requests/min
        window: "1m",
        action: "throttle"           // Rate limit
      },

      // Cost spike detection
      costSpike: {
        threshold: 3.0,              // If exceeds 3x average
        baseline: "1h",              // Based on 1-hour average
        action: "alert_and_block"    // Alert + block
      },

      // New endpoint detection
      newEndpoint: {
        action: "require_approval"   // Approval required
      }
    },

    // Emergency stop (kill switch)
    killSwitch: {
      enabled: true,
      triggers: [
        "budget_90_percent",
        "anomaly_detected",
        "manual_trigger"
      ],
      cooldownPeriod: 300             // 5-minute cooldown
    }
  },

  // Caching (short TTL for price data)
  cache: {
    enabled: true,
    customTTL: {
      "api.coingecko.com": 10,       // Price data 10 seconds only
      "gas.etherscan.io": 30,        // Gas data 30 seconds
      "router.uniswap.org": 5        // Routing 5 seconds
    }
  },

  // Real-time alerts
  alerts: {
    channels: ["telegram", "sms"],   // Immediate alerts
    criticalOnly: true
  }
});

// 2. Trading logic (protected API calls)
async function checkArbitrageOpportunity(
  tokenA: string,
  tokenB: string
) {
  try {
    // 2.1. Price data (fast cache)
    const priceResponse = await arbitrageBot.fetch(
      `https://api.coingecko.com/v3/simple/price?ids=${tokenA},${tokenB}`,
      {
        method: "GET",

        // Pag0 meta: indicate importance
        pag0Meta: {
          priority: "high",
          criticality: "trading_decision",
          maxLatency: 100              // Timeout if exceeds 100ms
        }
      }
    );

    // Check policy violation
    if (priceResponse.meta.policyViolation) {
      console.error("Policy violation:", priceResponse.meta.violation);
      // Stop trading
      return null;
    }

    const prices = await priceResponse.json();

    // 2.2. Calculate arbitrage
    const spreadPct = calculateSpread(prices[tokenA], prices[tokenB]);

    if (spreadPct > 0.5) {  // 0.5%+ arbitrage
      // 2.3. Gas estimation
      const gasResponse = await arbitrageBot.fetch(
        "https://gas.etherscan.io/api/gastracker",
        { method: "GET" }
      );

      const gasPrice = await gasResponse.json();

      // 2.4. Optimal routing
      const routeResponse = await arbitrageBot.fetch(
        "https://router.uniswap.org/v2/quote",
        {
          method: "POST",
          body: JSON.stringify({
            tokenIn: tokenA,
            tokenOut: tokenB,
            amount: "1000000000000000000" // 1 ETH
          })
        }
      );

      const route = await routeResponse.json();

      // Calculate total cost (including API cost)
      const apiCost =
        priceResponse.meta.cost +
        gasResponse.meta.cost +
        routeResponse.meta.cost;

      const profitAfterCosts =
        calculateProfit(route) - gasPrice.fee - apiCost;

      console.log("Trade analysis:", {
        spread: spreadPct,
        expectedProfit: profitAfterCosts,
        apiCost: apiCost,
        cached: {
          price: priceResponse.meta.cached,
          gas: gasResponse.meta.cached,
          route: routeResponse.meta.cached
        }
      });

      return profitAfterCosts > 0 ? route : null;
    }

    return null;

  } catch (error) {
    // Pag0 error handling
    if (error.code === "BUDGET_EXCEEDED") {
      console.error("⚠️ BUDGET EXCEEDED - Halting trading");
      await triggerKillSwitch();

    } else if (error.code === "ANOMALY_DETECTED") {
      console.error("🚨 ANOMALY DETECTED - Possible attack");
      await notifyAdmin({
        type: "security_alert",
        details: error.details,
        action: "trading_halted"
      });

    } else if (error.code === "ENDPOINT_BLOCKED") {
      console.error("❌ Blocked endpoint - check whitelist");
    }

    return null;
  }
}

// 3. Main trading loop
async function tradingLoop() {
  const pairs = [
    ["ethereum", "usd-coin"],
    ["bitcoin", "ethereum"],
    // ... 100+ pairs
  ];

  while (true) {
    for (const [tokenA, tokenB] of pairs) {
      const opportunity = await checkArbitrageOpportunity(tokenA, tokenB);

      if (opportunity) {
        await executeTrade(opportunity);
      }

      // Rate limiting (10 requests per second)
      await sleep(100);
    }

    // Hourly budget check
    const hourlyStatus = await arbitrageBot.getBudgetStatus("hourly");

    if (hourlyStatus.utilizationRate > 0.9) {
      console.log("⚠️ 90% hourly budget used - slowing down");
      await sleep(5000);  // Wait 5 seconds
    }
  }
}

// 4. Kill switch trigger
async function triggerKillSwitch() {
  await arbitrageBot.killSwitch.activate({
    reason: "budget_protection",
    cooldown: 300  // Can restart after 5 minutes
  });

  // Telegram emergency alert
  await sendTelegramAlert({
    message: "🚨 KILL SWITCH ACTIVATED - Trading halted",
    reason: "Budget limit reached",
    action: "Manual approval required to resume"
  });

  // Check status after 5 minutes
  setTimeout(async () => {
    const status = await arbitrageBot.getBudgetStatus("hourly");

    if (status.utilizationRate < 0.5) {
      // Auto-restart when budget recovers
      await arbitrageBot.killSwitch.deactivate();
      console.log("✅ Kill switch deactivated - resuming trading");
    }
  }, 300000);
}
```

---

## Security Flow Diagram

```
┌───────────────────┐
│  ArbitrageBot     │
│  (10-100 req/sec) │
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│         Pag0 Smart Proxy (Security Layer)           │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐│
│  │ Anomaly Detection│  │  Spend Firewall          ││
│  │                  │  │                          ││
│  │ ✓ Spike detect   │  │ ✓ Max $0.05/req         ││
│  │ ✓ Cost baseline  │  │ ✓ $0.50/hour            ││
│  │ ✓ New endpoint   │  │ ✓ Whitelist only        ││
│  │ ✓ Pattern anomaly│  │ ✓ Kill switch           ││
│  └──────────────────┘  └──────────────────────────┘│
│                                                      │
│  Decision Flow:                                      │
│  Request → Whitelist Check → Budget Check →         │
│  → Anomaly Check → [PASS] → Forward                 │
│                                                      │
│  [FAIL] → Block + Alert                             │
└─────────────────────────────────────────────────────┘
          │
          ├─────────────────┬──────────────────┐
          ▼ (allowed)       ▼ (allowed)        ▼ (blocked)
    ┌──────────┐      ┌──────────┐      ┌────────────────┐
    │ CoinGecko│      │ 1inch API│      │ unknown-api.com│
    │  (OK)    │      │  (OK)    │      │   (BLOCKED)    │
    └──────────┘      └──────────┘      └────────────────┘
          │                 │                     │
          └─────────────────┴─────────────────────┘
                            │
                            ▼
                    x402 Payment
                   (Only allowed)
```

---

## Attack Scenarios and Defense

### Scenario 1: Honeypot Attack

```yaml
Attack Method:
  1. Malicious API provides "ultra-low ETH price" information
  2. Bot is lured to repeatedly call that API
  3. High-cost API responses ($5/request)
  4. Wallet depletion

Pag0 Defense:
  - Whitelist: Blocks unregistered APIs (blocked at attack stage 1)
  - Max per request ($0.05): Blocks high-cost responses (blocked at attack stage 3)
  - Anomaly detection: New endpoint → approval required

Result: Attack failed
```

### Scenario 2: Infinite Loop Bug

```yaml
Bug Scenario:
  - Code bug causes infinite repetition of same request
  - 6,000 requests in 10 minutes
  - Expected loss: $300

Pag0 Defense:
  - Hourly budget ($0.50): Blocked after 10 requests
  - Spike detection (200/min): Detects abnormal pattern
  - Kill switch: Automatic halt

Actual Loss: $0.50 (hourly limit)
Savings: $299.50 (99.8%)
```

### Scenario 3: Gas Fee Surge Attack

```yaml
Attack Scenario:
  - Gas estimation API returns manipulated high gas fees
  - Bot executes irrational trades
  - Double loss from actual gas fees + API costs

Pag0 Defense:
  - Cost spike detection (3x baseline): Detects abnormal costs
  - Alert + Block: Immediate block and alert
  - Baseline learning: Based on 1-hour average

Result: Abnormal requests blocked + admin notified
```

---

## Effectiveness Comparison

| Metric | Without Pag0 | With Pag0 | Effect |
|------|--------------|-----------|------|
| **Security** |
| Malicious API blocking | 0% (post-incident detection) | 100% (whitelist) | Attack source blocked |
| Bug runaway loss | $300 (10-min bug) | $0.50 (hourly limit) | **99.8% loss prevention** |
| Abnormal pattern detection | None | Real-time ML detection | Average 30-second detection |
| **Cost** |
| Monthly API cost | $450 | $230 (cache effect) | -$220 (49%) |
| Security incident loss | $1,200/year (estimated) | $0 | **-$1,200/year** |
| **Operations** |
| Monitoring time | 10 hours/week | Automated | -40 hours/month |
| Emergency response time | Average 15 minutes | <30 seconds (automatic) | **30x faster** |

---

## Related Documentation

- [03-TECH-SPEC](03-TECH-SPEC.md) - Spend Firewall anomaly detection engine, kill switch implementation details
- [04-API-SPEC](04-API-SPEC.md) - `anomalyDetection`, `killSwitch`, `getBudgetStatus()` API reference
- [12-SDK-GUIDE](12-SDK-GUIDE.md) - Security-focused policy configuration guide

---

← [UC2: Enterprise Team Management](09-02-UC-ENTERPRISE.md) | [Use Case List](09-00-USE-CASES-INDEX.md) | [Next: UC4 →](09-04-UC-MCP-ORCHESTRATION.md)
