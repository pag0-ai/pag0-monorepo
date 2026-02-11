# TASK-19: CDP Wallet Integration (Coinbase Server Wallet)

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/mcp` |
| **예상 시간** | 2~3시간 |
| **상태** | ✅ **완료** |
| **의존성** | [TASK-16](./TASK-16-mcp-integration.md) (MCP 서버 완성) |
| **차단 대상** | TASK-20 (ERC-8004에서 wallet 주소 사용), TASK-21 (MCP tool 확장) |
| **참조 문서** | `docs/03-TECH-SPEC.md` §3.2, `docs/12-SDK-GUIDE.md` §1.6 |

## 목표

현재 `ethers.Wallet` 기반 로컬 키 관리를 **Coinbase CDP Server Wallet**으로 교체하여, AI Agent에 키 노출 없이 Coinbase 인프라에서 안전하게 결제 서명을 수행한다.

## 구현 결과

### 아키텍처: Dual Wallet Mode (`WALLET_MODE=local|cdp`)

기존 `ethers.Wallet` 모드와 새로운 CDP Server Wallet 모드를 `IWallet` 인터페이스로 통합하여 하위 호환 유지.

```
WALLET_MODE=local (기본값)     WALLET_MODE=cdp
  ┌──────────────┐              ┌──────────────┐
  │  Pag0Wallet  │              │  CdpWallet   │
  │ (ethers.Wallet)│            │ (@coinbase/  │
  │              │              │  cdp-sdk)    │
  └──────┬───────┘              └──────┬───────┘
         │                             │
         └──────────┬──────────────────┘
                    │
             ┌──────┴──────┐
             │  IWallet    │
             │  interface  │
             └─────────────┘
```

### 변경 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/cdp-wallet.ts` | **신규** | `CdpWallet` 클래스 — `@coinbase/cdp-sdk` CdpClient 래퍼. `getStatus()`, `signPayment()`, `requestFaucet()` |
| `src/wallet.ts` | **수정** | `IWallet` 인터페이스 추가, `Pag0Wallet`에 `walletMode` 속성 추가 |
| `src/index.ts` | **수정** | `WALLET_MODE` 환경변수 기반 지갑 선택 로직, `CdpWallet` import + `init()` |
| `src/tools/wallet.ts` | **수정** | `IWallet` 타입 사용, `walletMode` 응답에 포함 |
| `src/tools/wallet-fund.ts` | **신규** | `pag0_wallet_fund` MCP 도구 (CDP 모드 전용 테스트넷 faucet) |
| `src/tools/proxy.ts` | **수정** | wallet 파라미터 `Pag0Wallet` → `IWallet` |
| `src/tools/smart.ts` | **수정** | wallet 파라미터 `Pag0Wallet` → `IWallet` |
| `.env.example` | **수정** | `WALLET_MODE`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` 추가 |
| `package.json` | **수정** | `@coinbase/cdp-sdk ^1.44.0` 의존성 추가 |

### MCP 도구 (12개 → 기존 11 + 신규 1)

- `pag0_wallet_status` — 지갑 주소, USDC 잔고, 네트워크 + **walletMode** 표시
- `pag0_wallet_fund` **(신규)** — Base Sepolia 테스트넷 USDC faucet 요청 (CDP 모드 전용)

### 환경변수

```env
# Wallet mode: "local" (ethers.Wallet) or "cdp" (Coinbase Server Wallet)
WALLET_MODE=local

# CDP Wallet (required if WALLET_MODE=cdp)
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
```

## 보안 고려사항

| 항목 | 설계 |
|------|------|
| 키 관리 | Coinbase Server Wallet — 키는 Coinbase 인프라에서 관리, Pag0는 API Key만 보유 |
| 서명 권한 | pag0-mcp만 서명 요청 가능, AI Agent 자체에 키 노출 없음 |
| 지출 한도 | Policy Engine의 예산 검증을 통과한 요청만 서명 진행 |
| 감사 추적 | 모든 서명/결제를 Analytics Collector에 기록 |

## 폴백 전략

- CDP SDK 연동 실패 시: `WALLET_MODE=local` (기본값)로 기존 `ethers.Wallet` 유지
- CDP API 장애 시: 에러 메시지 반환

## 완료 기준

- [x] `CdpWallet` 클래스 구현 (`cdp-wallet.ts`) — `IWallet` 인터페이스 준수
- [x] `@coinbase/cdp-sdk ^1.44.0` 패키지 설치 및 TypeScript strict 빌드 통과
- [x] `WALLET_MODE=local|cdp` 전환 지원 (기본값 `local`, 하위 호환)
- [x] `pag0_wallet_status` tool이 `walletMode` 포함하여 반환
- [x] `pag0_wallet_fund` tool 구현 (CDP 모드, Base Sepolia 전용)
- [x] 402 → CDP `signPayment()` → 재요청 플로우 (IWallet 인터페이스 통해 동작)
- [x] `.env.example` 업데이트
