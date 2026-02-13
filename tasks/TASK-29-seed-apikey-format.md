# TASK-29: Seed API Key Does Not Match Auth Middleware Regex

**Priority**: P0 (Blocks Demo)
**Status**: ✅ Completed (commit `edc7b84`)
**Phase**: 9 (Demo Polish)

## Problem

Demo API key `pag0_test_local_dev_key_here` in seed.sql does not match auth middleware regex `/^pag0_(live|test)_[a-zA-Z0-9]{32}$/`.

- Postfix `local_dev_key_here` = 18 chars (needs 32)
- Contains underscore (`_`) which does not match `[a-zA-Z0-9]`

## Impact

Demo user created from seed data cannot pass API authentication. All API calls return 401 Unauthorized.

## Fix

- Change API key in `seed.sql` to regex-compliant format
- Example: `pag0_test_aaaabbbbccccddddeeeeffffgggghhhh` (32 alphanumeric chars)
- Recalculate corresponding api_key_hash with SHA-256

## Completion Criteria

- [ ] Seed API key matches `/^pag0_(live|test)_[a-zA-Z0-9]{32}$/` regex
- [ ] api_key_hash matches SHA-256 value of the key
- [ ] After `pnpm db:seed`, API calls with seed user return successful responses without 401

## Verification Results

- [x] API key: `pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (32 alphanumeric chars) — regex match ✅
- [x] hash: `encode(digest('pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', 'sha256'), 'hex')` — calculated with DB function ✅
- [x] Previous session confirmed 7/7 demo-mcp-agent.sh passes after seeding ✅

## Files to Modify

- `packages/proxy/src/db/seed.sql`
