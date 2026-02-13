# TASK-31: Expand seed endpoint_scores to all categories

**Priority**: P0 (demo quality)
**Status**: ✅ Complete (commit `edc7b84`)
**Phase**: 9 (Demo Polish)

## Problem

8 categories exist (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage), but endpoint_scores only has 5 endpoints distributed across AI(2), Blockchain(1), Finance(1), Storage(1).

Data, IoT, Social, Communication categories are empty.

## Impact

Rankings page shows "No rankings available" when selecting empty categories. Category Overview Cards show 4 categories with `0 endpoints, 0.0 score`, giving an unfinished impression.

## Fix

- Add at least 2-3 endpoint_scores per category to seed.sql
- Total 16-24 diverse score data points
- Realistic API endpoint URLs and score distribution

## Completion Criteria

- [ ] All 8 categories have at least 2 endpoint_scores each
- [ ] Total of 16+ endpoint_scores records
- [ ] categories table's endpoint_count, avg_score automatically updated
- [ ] Rankings page displays data for all category tabs

## Verification Results

- [x] 20 endpoint_scores: AI(3), Data(3), Blockchain(2), IoT(2), Finance(3), Social(2), Communication(2), Storage(3) ✅
- [x] `UPDATE categories SET endpoint_count=..., avg_score=...` query included ✅
- [x] All 8 categories verified with verify-seed in previous session ✅

## Modified Files

- `packages/proxy/src/db/seed.sql`
