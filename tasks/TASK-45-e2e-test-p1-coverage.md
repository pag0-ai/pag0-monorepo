# TASK-45: E2E Test P1 Feature Coverage Expansion

> **Priority**: HIGH
> **Package**: scripts/
> **Status**: Pending

## Goal

Add response field-level validation for features added in P1/R2 to `scripts/e2e-test.sh`.
Expand from current 22 tests to 30 tests.

## Current Issue

Existing E2E tests only validate HTTP status codes (200/401/404/429).
**Response body** fields added in P1 such as JWT tokens, new analytics fields, curation differences/weights/evidence
are not validated at all.

## Tests to Add (8 tests)

### Auth Section (+2)
1. **Login JWT token**: register → login → verify `token` field exists in response
2. **Login → /me flow**: Verify /me endpoint can be called with JWT received from login (for future JWT auth)

### Policy Section (+1)
3. **Policy field names**: Verify Create response contains `dailyBudget` field (not `dailyLimit`)

### Analytics Section (+2)
4. **Endpoints new fields**: Verify /endpoints response contains `cacheHitRate`, `successRate` fields
5. **Summary budgetRemaining**: Verify `remaining` value in budgetUsage of /summary response is not negative

### Curation Section (+3)
6. **Compare differences**: Verify /compare response contains `differences` object
7. **Rankings weights/evidence**: Verify first item in /rankings response has `weights`, `evidence`
8. **Score endpoint**: Test individual score lookup `/api/curation/score/{endpoint}` (currently untested)

## Implementation Notes

- Use `jq` or `python3 -c` to validate JSON field existence
- Add `assert_field` helper in addition to existing `assert_status`
- Keep existing 22 tests unchanged

## Dependencies

- P1 commit `a684cc3` completed (JWT, analytics fields, curation weights/differences)
- R2 commit `520de2d` completed (budgetRemaining fix)
