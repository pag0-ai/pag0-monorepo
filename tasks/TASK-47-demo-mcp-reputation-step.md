# TASK-47: MCP Agent 데모에 Reputation + 추가 도구 스텝

> **우선순위**: LOW
> **패키지**: scripts/
> **상태**: 대기

## 목표

`scripts/demo-mcp-agent.sh`에 미사용 MCP 도구 시연 추가.

## 추가 스텝

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

### Step 4.10: Reputation Profile (pag0_reputation_profile) — 선택적
```
"Use pag0_reputation_profile for api.openai.com.
Show on-chain feedback count and average rating."
```
> 주의: Subgraph (Goldsky) 연결 필요. 로컬에서는 fallback score 50 반환될 수 있음.

## 변경 규모

- Summary 출력의 total을 7 → 9~10으로 업데이트
- 기존 7개 스텝은 변경 없음

## 의존성

- TASK-45, 46과 독립
- Subgraph가 Goldsky에 배포되어 있어야 Step 4.10이 의미 있음
