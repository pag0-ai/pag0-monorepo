# TASK-44: Policy Route JSON parsing error handling (R2)

**Priority**: P1 (stability)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: proxy

## Problem

In Policy CRUD routes' POST and PUT endpoints, when invalid JSON body is passed to `c.req.json()` call, unhandled exception occurs returning 500 error. Proper 400 VALIDATION_ERROR response is needed.

## Changes

### packages/proxy/src/routes/policies.ts

#### POST / (create policy)
- Wrap `c.req.json()` with `try/catch`
- Return `400 { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON in request body' } }` on parsing failure

#### PUT /:id (update policy)
- Apply same `try/catch` pattern
- Same error response on parsing failure

## Completion criteria

- [x] JSON parsing error handling in POST /api/policies
- [x] JSON parsing error handling in PUT /api/policies/:id
- [x] Error response complies with standard format `{ error: { code, message } }`
