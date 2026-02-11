# TASK-12: Dashboard Layout + Navigation

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/dashboard` |
| **예상 시간** | 1시간 |
| **의존성** | 없음 (독립 시작 가능) |
| **차단 대상** | [TASK-13](./TASK-13-dashboard-metrics.md), [TASK-14](./TASK-14-policy-ui.md), [TASK-15](./TASK-15-ranking-board.md) |

## 목표

Next.js Dashboard의 레이아웃, 네비게이션, API 클라이언트, React Query Provider를 구성한다.

## 현재 상태

- `app/layout.tsx` — 최소 레이아웃 (dark 테마)
- `app/page.tsx` — "Pag0 Dashboard" 텍스트만
- `lib/api.ts` — 기본 fetchApi 헬퍼 (16줄)
- 컴포넌트 없음, 라우트 없음

## 구현 내용

### 1. React Query Provider — `app/providers.tsx`

```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function Providers({ children }) { ... }
```

`layout.tsx`에서 `<Providers>` 래핑.

### 2. API 클라이언트 확장 — `lib/api.ts`

기존 `fetchApi` 에 API Key 헤더 추가:
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Pag0-API-Key': getApiKey(),  // localStorage 또는 env
  ...options?.headers,
}
```

편의 함수 추가:
- `fetchAnalyticsSummary(period)`
- `fetchAnalyticsEndpoints(params)`
- `fetchAnalyticsCosts(params)`
- `fetchAnalyticsCache(period)`
- `fetchPolicies()`
- `fetchRankings(params)`
- `fetchCategories()`

### 3. 사이드바 네비게이션 — `components/sidebar.tsx`

```
Pag0 Dashboard
├── Dashboard    (/dashboard)     — BarChart3 아이콘
├── Policies     (/policies)      — Shield 아이콘
├── Rankings     (/rankings)      — Trophy 아이콘
└── Settings     (/settings)      — Settings 아이콘 (optional)
```

아이콘: `lucide-react` (이미 설치됨)
스타일: Tailwind dark 테마 (`bg-gray-900`, `text-gray-100`)

### 4. 페이지 라우트 생성

```
app/
├── layout.tsx          — Providers + Sidebar 래핑
├── page.tsx            — / → /dashboard redirect
├── dashboard/
│   └── page.tsx        — 메트릭 대시보드 (TASK-13)
├── policies/
│   └── page.tsx        — 정책 관리 (TASK-14)
└── rankings/
    └── page.tsx        — API 랭킹 (TASK-15)
```

각 페이지는 빈 스켈레톤으로 생성 (TASK-13~15에서 채움).

### 5. 공통 컴포넌트

- `components/metric-card.tsx` — 숫자 카드 (아이콘 + 제목 + 값)
- `components/loading.tsx` — Skeleton loader

## 환경변수

`packages/dashboard/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 테스트 방법

```bash
pnpm dev:dashboard
# → http://localhost:3001 접속
# → 사이드바 네비게이션 확인
# → 각 라우트 이동 확인
```

## 완료 기준

- [x] React Query Provider 설정
- [x] API 클라이언트 함수 추가 (API Key 헤더 포함)
- [x] 사이드바 네비게이션 구현 (3개 메뉴)
- [x] 3개 페이지 라우트 생성 (스켈레톤)
- [x] MetricCard 공통 컴포넌트
- [x] 로컬에서 Dashboard 접속 + 네비게이션 동작 확인
