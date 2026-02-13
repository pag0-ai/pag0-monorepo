# TASK-47: Add Reputation + Additional Tool Steps to MCP Agent Demo

> **Priority**: LOW
> **Package**: scripts/
> **Status**: Pending

## Goal

Add demonstrations of unused MCP tools to `scripts/demo-mcp-agent.sh`.

## Additional Steps

### Step 4.8: Individual Score (pag0_score)
```
"Use pag0_score to get the detailed score for api.openai.com.
Show the overall score, individual dimensions, weights, and evidence."
```

### Step 4.9: Transaction History (pag0_tx_history)
```
"Use pag0_tx_history with period '24h' to show recent transactions.
Show endpoint, cost, latency, and cache status for each."
```

### Step 4.10: Reputation Profile (pag0_reputation_profile) — Optional
```
"Use pag0_reputation_profile for api.openai.com.
Show on-chain feedback count and average rating."
```
> Note: Requires Subgraph (Goldsky) connection. In local environment, may return fallback score of 50.

## Change Scope

- Update summary output total from 7 → 9~10
- No changes to existing 7 steps

## Dependencies

- Independent of TASK-45, 46
- Step 4.10 is only meaningful if Subgraph is deployed to Goldsky
