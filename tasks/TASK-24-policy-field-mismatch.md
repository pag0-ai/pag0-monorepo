# TASK-24: Policy 필드명 불일치 수정

**Priority**: HIGH
**Status**: TODO
**Phase**: 3 (Policy Management)

## 문제

프론트엔드 `Policy` 인터페이스의 필드명이 백엔드 응답과 다름.

| 프론트엔드 | 백엔드 | 비고 |
|-----------|--------|------|
| `whitelist` | `allowedEndpoints` | 배열 |
| `blacklist` | `blockedEndpoints` | 배열 |
| `enabled` | `isActive` | boolean |
| (없음) | `maxPerRequest` | 생성 시 누락 |

## 영향

- 정책 목록에서 모든 정책이 "Inactive"로 표시 (`policy.enabled` = `undefined`)
- Whitelist/Blacklist가 항상 빈 값으로 표시
- 정책 생성 시 `allowedEndpoints`, `blockedEndpoints`가 전달되지 않음

## 수정 파일

- `packages/dashboard/lib/api.ts` — `Policy`, `CreatePolicyData` 인터페이스 수정
- `packages/dashboard/app/policies/page.tsx` — 필드명 참조 업데이트
