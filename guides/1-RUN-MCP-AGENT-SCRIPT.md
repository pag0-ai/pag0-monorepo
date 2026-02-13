# MCP Agent Demo Script 실행 가이드

`scripts/demo-mcp-agent.sh`는 Claude Code CLI를 통해 Pag0 MCP 도구 10개를 자동으로 실행하는 E2E 데모 스크립트입니다.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 설치 및 인증 완료
- Node.js >= 20
- pnpm >= 9

## 1. API Key 발급

Pag0 Dashboard에서 API Key를 발급받아야 합니다.

1. [Pag0 Dashboard](https://pag0-dashboard.vercel.app)에 접속
2. 회원가입 또는 로그인
3. Dashboard에서 API Key를 복사 (`pag0_live_...` 형식)

## 2. Wallet 설정

두 가지 월렛 모드 중 하나를 선택합니다.

### Option A: CDP Wallet (권장)

Coinbase Developer Platform Server Wallet을 사용합니다. 자동 faucet이 포함되어 별도 USDC 충전이 필요 없습니다.

[CDP Portal](https://portal.cdp.coinbase.com/)에서 API Key를 생성하세요:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`

### Option B: Local Wallet

ethers.Wallet을 사용합니다. 스크립트가 자동으로 임시 키를 생성하지만, Base Sepolia 테스트넷 USDC가 필요합니다.

- USDC 컨트랙트: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)에서 ETH 수령 후 USDC swap

## 3. `.env` 파일 생성

```bash
cp packages/mcp/.env.example packages/mcp/.env
```

`packages/mcp/.env`를 열어 값을 채웁니다:

```env
# Pag0 Proxy API
PAG0_API_URL=https://pag0-monorepo.fly.dev
PAG0_API_KEY=pag0_live_your_api_key_here       # Step 1에서 발급받은 키

# x402 payment network
NETWORK=base-sepolia

# Wallet mode: "local" (ethers.Wallet) or "cdp" (Coinbase Server Wallet)
WALLET_MODE=cdp

# CDP Wallet (WALLET_MODE=cdp인 경우)
CDP_API_KEY_ID=your_cdp_key_id
CDP_API_KEY_SECRET=your_cdp_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret

# Local Wallet (WALLET_MODE=local인 경우, 스크립트가 자동 생성하므로 선택사항)
# WALLET_PRIVATE_KEY=0x...
```

> 스크립트는 `packages/mcp/.env` -> `.env` -> `.env.local` 순서로 환경변수를 탐색합니다.

## 4. MCP 패키지 빌드

```bash
pnpm install && pnpm -F @pag0/mcp build
```

> 빌드가 안 되어 있으면 스크립트가 자동으로 빌드를 시도합니다.

## 5. 데모 실행

```bash
bash scripts/demo-mcp-agent.sh
```

### 녹화 모드 (스텝별 일시정지)

```bash
DEMO_PAUSE=1 bash scripts/demo-mcp-agent.sh
```

각 스텝 실행 전 Enter 키 입력을 기다립니다. 데모 영상 녹화 시 유용합니다.

## 데모 스텝 (10개)

| Step | 기능 | MCP Tool |
|------|------|----------|
| 4.1 | Wallet 상태 확인 | `pag0_wallet_status` |
| 4.2 | 예산/정책 확인 | `pag0_check_budget`, `pag0_list_policies` |
| 4.3 | API 추천 | `pag0_recommend` |
| 4.4 | 엔드포인트 비교 | `pag0_compare` |
| 4.5 | x402 결제 (Math API) | `pag0_score`, `pag0_request` |
| 4.6 | x402 결제 (Motivate API) | `pag0_score`, `pag0_request` |
| 4.7 | 지출/캐시 통계 | `pag0_spending`, `pag0_cache_stats` |
| 4.8 | 엔드포인트 상세 점수 | `pag0_score` |
| 4.9 | 트랜잭션 이력 | `pag0_tx_history` |
| 4.10 | 온체인 감사 추적 | `pag0_audit_trail` |

## Troubleshooting

### `Proxy not running at ...`

Proxy 서버가 응답하지 않습니다. `PAG0_API_URL`이 올바른지 확인하세요.

- 로컬: `pnpm dev:proxy` 실행 후 재시도
- Production: `https://pag0-monorepo.fly.dev/health`에 접속하여 확인

### `claude CLI not found`

Claude Code CLI가 설치되지 않았습니다:

```bash
npm install -g @anthropic-ai/claude-code
```

### CDP credentials incomplete

CDP 키 3개(`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`)가 모두 설정되지 않으면 자동으로 local 모드로 fallback됩니다. CDP를 사용하려면 3개 모두 `.env`에 설정하세요.

### x402 결제 실패

- USDC 잔액 확인: Step 4.1에서 balance가 0이면 충전 필요
- CDP 모드: `cdp.evm.requestFaucet()`이 자동 실행되지만, 이미 수령한 경우 실패할 수 있음
- Local 모드: Base Sepolia USDC를 직접 충전해야 함
