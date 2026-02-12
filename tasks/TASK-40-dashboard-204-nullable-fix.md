# TASK-40: Dashboard fetchApi 204 처리 + Category nullable 필드

**Priority**: P1 (런타임 에러 방지)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: dashboard

## 문제

### 1. 204 No Content 미처리
`fetchApi`가 DELETE 응답(204 No Content)에서 `res.json()` 호출 시 JSON 파싱 에러 발생.

### 2. Category 필드 nullable
백엔드 `/api/curation/categories` 응답에서 `description`이 null일 수 있고, `avgScore`도 endpoint_scores가 없는 카테고리에서는 null.

## 수정 내용

1. `fetchApi`: `res.status === 204` 체크 추가, `undefined as T` 반환
2. `Category` 인터페이스: `description: string | null`, `avgScore: number | null`

## 수정 파일

- `packages/dashboard/lib/api.ts`

## 완료 기준

- [x] 204 No Content 응답 시 JSON 파싱 에러 없음
- [x] Category nullable 필드 TypeScript 타입 정확
