# TASK-46: Demo Scenario P1 Feature Integration

> **Priority**: MEDIUM
> **Package**: scripts/
> **Status**: Pending

## Objective

Reflect P1 added features in `scripts/demo-scenarios.sh` demonstration.

## Changes

### 1. Scenario 1 (Spend Firewall) Enhancement
- Add 1.0: Demonstrate JWT token return on Login
  ```bash
  # Login and show JWT token
  curl -s -X POST $BASE_URL/api/auth/login -H "Content-Type: application/json" \
    -d '{"email":"...","password":"..."}' | python3 -m json.tool
  ```

### 2. Scenario 3 (API Curation) Enhancement
- 3.3 Compare: Highlight output of `differences` field
  ```bash
  # Show differences (score spread)
  curl -s '.../compare?endpoints=...' | python3 -c "
  import sys,json
  d = json.load(sys.stdin)['data']['differences']
  for k,v in d.items():
    print(f'  {k}: {v[\"min\"]:.1f} - {v[\"max\"]:.1f} (delta: {v[\"delta\"]:.1f})')
  "
  ```
- 3.1 Rankings: Mention presence of `weights` and `evidence`
- 3.5 (New): Individual endpoint score lookup (`/api/curation/score/:endpoint`)

### 3. Scoring Description Fix (line 109)
```
Current (incorrect): cost (40%) + latency (30%) + reliability (30%)
Corrected:           cost (30%) + latency (25%) + reliability (25%) + reputation (20%)
```

## Dependencies

- Independent from TASK-45 (E2E) — can work in parallel
