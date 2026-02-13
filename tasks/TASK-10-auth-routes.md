# TASK-10: Auth Routes (register/login/me)

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md) |

## Objective

Implement user registration, login, and current user information retrieval APIs.

## Implementation Files

### `packages/proxy/src/routes/auth.ts`

| Method | Path | Auth | Description |
|--------|------|------|------|
| POST | `/register` | Not required | User registration + API Key issuance |
| POST | `/login` | Not required | Login (for Dashboard) |
| GET | `/me` | Required | Current user information |

### POST `/register`

**Request**:
```typescript
{ email: string; password: string; projectName?: string }
```

**Processing Flow**:
1. Check email duplication
2. Password hashing: Simple hashing (Bun's `Bun.password.hash()` or crypto)
   > For MVP, `createHash('sha256')` + salt is also acceptable instead of bcrypt
3. API Key generation: `pag0_live_` + 32 char random hex
4. API Key hash: SHA-256 → `users.api_key_hash`
5. User INSERT + Project INSERT + Default policy INSERT + Budget record INSERT
6. Return raw API Key (only once!)

**Response** (201):
```typescript
{
  user: { id, email, createdAt };
  project: { id, name };
  apiKey: "pag0_live_xxx";  // Display only once
}
```

### POST `/login`

**Request**:
```typescript
{ email: string; password: string }
```

**Processing**:
1. Look up user by email
2. Verify password
3. Issue simple token (MVP: based on API Key hash, or session without JWT)
   > Since this is for Dashboard, MVP can use API Key as session substitute

**Response** (200):
```typescript
{ token: string; user: { id, email } }
```

### GET `/me`

**Auth required** (X-Pag0-API-Key header)

**Response** (200):
```typescript
{
  user: { id, email, createdAt };
  projects: [{ id, name, apiKeyPreview: "pag0_live_a1b2...o5p6" }];
  subscription: { tier, limits: { requestsPerDay, projectsMax } };
}
```

## API Key Generation Pattern

`prepare-hackathon/test-business-logic-day1.ts` — **Test 7**:
```typescript
function generateApiKey(): string {
  const random = createHash('sha256')
    .update(crypto.randomUUID())
    .digest('hex')
    .substring(0, 32);
  return `pag0_live_${random}`;
}
```

## Important Notes

- Raw API Key is only returned in register response, only hash is stored in DB
- Password: bcrypt(12) recommended, but MVP allows Bun.password or SHA-256+salt
- `/register`, `/login` are excluded from Auth middleware
- `apiKeyPreview`: first 10 chars + "..." + last 4 chars

## Testing Method

```bash
pnpm dev:proxy

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","projectName":"My Project"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'

# Current user
curl -H "X-Pag0-API-Key: {issued key}" http://localhost:3000/api/auth/me
```

## Completion Criteria

- [x] register endpoint (user + project + policy + budget creation)
- [x] login endpoint (password verification)
- [x] me endpoint (authenticated user information)
- [x] API Key generation + hash storage
- [x] Test register → login → lookup flow locally
