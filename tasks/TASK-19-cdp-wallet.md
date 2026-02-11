# TASK-19: CDP Wallet Integration (Coinbase Server Wallet)

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/mcp` (주), `packages/proxy` (타입/인터페이스) |
| **예상 시간** | 2~3시간 |
| **의존성** | [TASK-16](./TASK-16-mcp-integration.md) (MCP 서버 완성) |
| **차단 대상** | TASK-20 (ERC-8004에서 wallet 주소 사용), TASK-21 (MCP tool 확장) |
| **참조 문서** | `docs/03-TECH-SPEC.md` §3.2, `docs/12-SDK-GUIDE.md` §1.6 |

## 목표

현재 `ethers.Wallet` 기반 로컬 키 관리를 **Coinbase CDP Server Wallet**으로 교체하여, AI Agent에 키 노출 없이 Coinbase 인프라에서 안전하게 결제 서명을 수행한다.

## 현재 상태

- `packages/mcp/src/wallet.ts` — `ethers.Wallet` 래퍼 (로컬 private key 직접 보유)
- 402 수신 → `wallet.signPayment()` → 서명된 결제 전달
- 동작하지만 키를 환경변수로 직접 관리 (보안 우려)

## 구현 항목

### 1. CDPWalletManager 클래스 생성

`packages/mcp/src/cdp-wallet.ts` 생성:

```typescript
import { CoinbaseSDK } from '@coinbase/sdk';

class CDPWalletManager {
  // 프로젝트별 Server Wallet 생성/로드
  async getOrCreateWallet(projectId: string): Promise<Wallet>;

  // x402 Payment Request에 대한 서명 생성
  async signPayment(projectId: string, paymentRequest: X402PaymentRequest): Promise<SignedPayment>;

  // 지갑 잔고 조회
  async getBalance(projectId: string): Promise<WalletBalance>;

  // 테스트넷 펀딩 (Base Sepolia 전용)
  async fundTestnet(projectId: string): Promise<FaucetTransaction>;
}
```

### 2. 기존 wallet.ts를 CDPWalletManager로 교체

- `wallet.ts`의 `Pag0Wallet` 인터페이스 유지 (하위 호환)
- 내부 구현을 `ethers.Wallet` → `CDPWalletManager` 교체
- 환경변수: `CDP_API_KEY_NAME`, `CDP_API_KEY_SECRET`, `CDP_NETWORK` 추가

### 3. MCP Tool 업데이트

- `pag0_wallet_status` — CDP Wallet 주소, 네트워크, 잔고 표시
- `pag0_wallet_fund` (신규) — Base Sepolia 테스트넷 USDC 충전

### 4. 환경변수

```env
# CDP Wallet (Coinbase Developer Platform)
CDP_API_KEY_NAME=organizations/{org_id}/apiKeys/{key_id}
CDP_API_KEY_SECRET=-----BEGIN EC PRIVATE KEY-----...
CDP_NETWORK=base-sepolia  # base | base-sepolia
```

## 보안 고려사항

| 항목 | 설계 |
|------|------|
| 키 관리 | Coinbase Server Wallet — 키는 Coinbase 인프라에서 관리, Pag0는 API Key만 보유 |
| 서명 권한 | pag0-mcp만 서명 요청 가능, AI Agent 자체에 키 노출 없음 |
| 지출 한도 | Policy Engine의 예산 검증을 통과한 요청만 서명 진행 |
| 감사 추적 | 모든 서명/결제를 Analytics Collector에 기록 |

## 폴백 전략

- CDP SDK 연동 실패 시: 기존 `ethers.Wallet` 유지 (환경변수 `WALLET_MODE=local|cdp`로 전환)
- CDP API 장애 시: 에러 메시지 + 수동 결제 안내

## 완료 기준

- [ ] CDPWalletManager 클래스 구현 (`cdp-wallet.ts`)
- [ ] `@coinbase/sdk` 패키지 설치 및 타입 정의
- [ ] 기존 wallet.ts에서 CDP 모드 전환 지원
- [ ] `pag0_wallet_status` tool이 CDP Wallet 정보 반환
- [ ] `pag0_wallet_fund` tool 구현 (테스트넷)
- [ ] 402 → CDP 서명 → 재요청 플로우 E2E 동작
- [ ] 환경변수 `.env.example` 업데이트
