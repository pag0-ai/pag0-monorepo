# TASK-28: Empty Dashboard UX — First Visit CTA and Empty Chart Handling

**Priority**: MEDIUM
**Status**: ✅ Completed
**Phase**: 2 (Empty Dashboard)

## Problem

1. First-time users seeing all-zero metrics don't know what to do next
2. Empty cost chart shows only axes without "no data" message
3. Active policy information not displayed on dashboard

## Fix

### 1. Welcome CTA (when totalRequests === 0)
```
┌─────────────────────────────────────────────┐
│ 🚀 Welcome to Pag0!                         │
│                                              │
│ Your proxy is ready. Make your first         │
│ request to start seeing analytics.           │
│                                              │
│ [View Quick Start Guide] [Go to Policies]   │
└─────────────────────────────────────────────┘
```

### 2. Empty Chart → "No data yet" placeholder

### 3. Active Policy Badge (optional)
- "Active: Default Policy — $10/day, $100/month"

## Files to Modify

- `packages/dashboard/app/dashboard/page.tsx`
