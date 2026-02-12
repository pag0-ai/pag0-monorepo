# TASK-46: Demo 시나리오 P1 기능 반영

> **우선순위**: MEDIUM
> **패키지**: scripts/
> **상태**: 대기

## 목표

`scripts/demo-scenarios.sh`에 P1에서 추가된 기능을 시연에 반영.

## 변경사항

### 1. Scenario 1 (Spend Firewall) 보강
- 1.0 추가: Login 시 JWT 토큰 반환 시연
  ```bash
  # Login and show JWT token
  curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" \
    -d '{"email":"...","password":"..."}' | python3 -m json.tool
  ```

### 2. Scenario 3 (API Curation) 보강
- 3.3 Compare: `differences` 필드 하이라이트 출력
  ```bash
  # Show differences (score spread)
  curl -s '.../compare?endpoints=...' | python3 -c "
  import sys,json
  d = json.load(sys.stdin)['data']['differences']
  for k,v in d.items():
    print(f'  {k}: {v[\"min\"]:.1f} - {v[\"max\"]:.1f} (delta: {v[\"delta\"]:.1f})')
  "
  ```
- 3.1 Rankings: `weights`와 `evidence` 존재 언급
- 3.5 (신규): 개별 엔드포인트 점수 조회 (`/api/curation/score/:endpoint`)

### 3. 스코어링 설명 수정 (line 109)
```
현재 (잘못됨): cost (40%) + latency (30%) + reliability (30%)
수정:          cost (30%) + latency (25%) + reliability (25%) + reputation (20%)
```

## 의존성

- TASK-45 (E2E) 와 독립 — 병렬 작업 가능
