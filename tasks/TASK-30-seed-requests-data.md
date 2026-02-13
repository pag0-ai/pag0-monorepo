# TASK-30: Add Synthetic Requests Data to Seed

**Priority**: P0 (Demo Quality)
**Status**: ✅ Completed (commit `edc7b84`)
**Phase**: 9 (Demo Polish)

## Problem

No `requests` table data in seed.sql. All 4 dashboard analytics APIs (summary, endpoints, costs, cache) query the requests table, so dashboard shows `totalRequests: 0`, empty charts, and empty tables immediately after seeding.

## Impact

Hackathon demo only shows "Empty State CTA" and cannot demonstrate dashboard with real data.

## Fix

- Add 50~100 synthetic request records to seed.sql
- Diverse endpoints, costs, latencies, cache hit distribution
- Distribute across last 7 days so charts display meaningfully

## Completion Criteria

- [ ] requests table contains 50+ synthetic records
- [ ] Distributed across last 7 days (meaningful time series display in charts)
- [ ] Diverse endpoints, costs (0~500000), latencies, cache hits/misses
- [ ] Include error responses (500, 429, 502, etc.)
- [ ] All 4 dashboard analytics APIs return data without empty results

## Verification Results

- [x] 66 request records inserted (`INSERT INTO requests ... VALUES` 66 rows) ✅
- [x] 7-day distribution using `NOW() - INTERVAL '1~7 day'` ✅
- [x] 12 diverse endpoint URLs, costs 0~500000, latencies 45~1200ms ✅
- [x] Includes status_code 500, 429, 502 (errors have cost=0, cached=false) ✅
- [x] Previous session verified 66 requests with verify-seed script ✅

## Files to Modify

- `packages/proxy/src/db/seed.sql`
