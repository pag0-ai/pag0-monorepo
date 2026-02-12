# TASK-20: ERC-8004 Audit Trail Integration

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` (주) |
| **예상 시간** | 3~4시간 |
| **의존성** | [TASK-05](./TASK-05-proxy-core.md) (ProxyCore Post-Processing), [TASK-19](./TASK-19-cdp-wallet.md) (CDP Wallet 주소) |
| **차단 대상** | TASK-21 (MCP audit tools), TASK-23 (The Graph subgraph) |
| **참조 문서** | `docs/03-TECH-SPEC.md` §3.4, `docs/01-PRODUCT-BRIEF.md` 핵심 기능 표 |

## 목표

x402 결제 완료 후 ERC-8004 ReputationRegistry에 **온체인 감사 기록**을 자동으로 작성한다. IPFS에 메타데이터(proofOfPayment + serviceMetrics)를 업로드하고, `giveFeedback()` 호출로 Trustless 감사 추적을 제공한다.

## 현재 상태

- ProxyCore의 Post-Processing Pipeline: Cache Store + Analytics Log + Budget Update (3단계)
- ERC-8004 연동 없음
- SKALE Integration (`proxy/src/skale/`) 존재 (온체인 메트릭 기록 패턴 참고 가능)

## 구현 항목

### 1. ERC8004AuditTrail 클래스 생성

`packages/proxy/src/audit/erc8004.ts` 생성:

```typescript
class ERC8004AuditTrail {
  // x402 결제 완료 후 ReputationRegistry에 피드백 기록
  async recordPaymentFeedback(params: {
    agentId: string;        // x402 서버의 ERC-8004 ID
    endpoint: string;
    cost: string;           // USDC BIGINT string
    latencyMs: number;
    statusCode: number;
    txHash: string;         // x402 결제 트랜잭션 해시
    sender: string;         // CDP Wallet 주소
    receiver: string;       // x402 서버 주소
  }): Promise<string>;      // 온체인 tx hash

  // 고액 결제 시 ValidationRegistry 사전 검증 요청
  async requestValidation(params: {
    agentId: string;
    endpoint: string;
    estimatedCost: string;
    taskDescription: string;
  }): Promise<string>;
}
```

### 2. IPFS 메타데이터 업로드

feedbackURI JSON 구조:
```json
{
  "version": "1.0",
  "type": "x402-payment-audit",
  "proofOfPayment": {
    "txHash": "0x...",
    "sender": "0x...",
    "receiver": "0x...",
    "amount": "50000",
    "network": "base"
  },
  "serviceMetrics": {
    "endpoint": "api.openai.com",
    "latencyMs": 234,
    "statusCode": 200,
    "timestamp": 1234567890
  }
}
```

### 3. ProxyCore Post-Processing 확장

`packages/proxy/src/proxy/core.ts` 수정:

```typescript
// 기존: Cache Store + Analytics Log + Budget Update
// 추가: ERC-8004 giveFeedback (비동기, 실패해도 응답 블로킹 안함)
await Promise.all([
  cacheStore(req, response),
  analyticsLog(req, response),
  budgetUpdate(req, response),
  erc8004Audit.recordPaymentFeedback({...}).catch(err =>
    console.warn('ERC-8004 feedback failed:', err)
  ),
]);
```

### 4. Quality Score 계산 로직

| 조건 | 점수 |
|------|------|
| 2xx + latency < 200ms | 100 |
| 2xx + latency < 500ms | 85 |
| 2xx + latency < 1000ms | 70 |
| 2xx + latency < 3000ms | 50 |
| 2xx + latency >= 3000ms | 30 |
| 비-2xx 응답 | 10 |

### 5. ERC-8004 컨트랙트 ABI

`packages/proxy/src/audit/abi/` 디렉토리에 ABI JSON:
- `ReputationRegistry.json` — `giveFeedback(agentId, value, valueDecimals, tag1, tag2, feedbackURI, feedbackHash)`
  - **FeedbackGiven 이벤트**: `(indexed string agentId, string agentIdRaw, uint256 value, bytes32 tag1, bytes32 tag2, string feedbackURI, bytes32 feedbackHash)`
  - `agentIdRaw`: 비-인덱싱된 원본 agentId 문자열 (EVM이 indexed string을 keccak256 해시로 변환하므로 원문 보존용)
- `ValidationRegistry.json` — `validationRequest(agentId, data)`

### 6. 환경변수

```env
# ERC-8004 (SKALE bite-v2-sandbox, v1.1.0 배포)
ERC8004_REPUTATION_REGISTRY=0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131
ERC8004_VALIDATION_REGISTRY=0x05bf80675DcFD3fdD1F7889685CB925C9c56c308
ERC8004_SIGNER_KEY=...              # 피드백 기록용 서명 키
IPFS_API_URL=https://ipfs.infura.io:5001
```

## 온체인 데이터 구조 (giveFeedback 파라미터)

| 필드 | 값 | 설명 |
|------|------|------|
| `agentId` | x402 서버의 ERC-8004 ID | Identity Registry에 등록된 서비스 식별자 (indexed → keccak256 해시) |
| `agentIdRaw` | agentId 원본 문자열 | 비-인덱싱, 사람이 읽을 수 있는 hostname (예: `api.openai.com`) |
| `value` | 0-100 | latency + statusCode 기반 서비스 품질 점수 |
| `valueDecimals` | 2 | 소수점 자릿수 |
| `tag1` | `x402-payment` | 피드백 유형 태그 |
| `tag2` | `api-call` | 서비스 카테고리 태그 |
| `feedbackURI` | `ipfs://Qm...` | proofOfPayment + serviceMetrics JSON |
| `feedbackHash` | `0x...` | feedbackURI 콘텐츠의 keccak256 해시 |

## 폴백 전략

- IPFS 업로드 실패: feedbackURI를 빈 문자열로 설정, 피드백은 계속 기록
- SKALE RPC 장애: 로컬 큐에 저장 → 재시도 (fire-and-forget, 응답 미차단)
- 컨트랙트 미배포: 비활성화 (환경변수 `ERC8004_ENABLED=false`)

## 완료 기준

- [x] ERC8004AuditTrail 클래스 구현
- [x] IPFS 메타데이터 업로드 기능
- [x] ProxyCore Post-Processing에 비동기 연동
- [x] Quality Score 계산 로직
- [x] 컨트랙트 ABI 정의
- [x] 환경변수 `.env.example` 업데이트
- [x] 비활성화 모드 지원 (`ERC8004_ENABLED`)
- [x] 실패 시 응답 블로킹 없음 확인
