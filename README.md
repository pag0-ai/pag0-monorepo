# Pag0 - Smart Proxy Layer for x402

> AI 에이전트의 유료 API 사용을 제어하는 스마트 프록시 플랫폼

**3-in-1 Middleware**: Spend Firewall + API Curation + Smart Cache

## Quick Start

```bash
# Install dependencies
pnpm install

# Start backend (port 3000)
pnpm dev:proxy

# Start dashboard (port 3001)
pnpm dev:dashboard

# Start both
pnpm dev
```

## Structure

```
packages/
  proxy/       # Hono + Bun backend (x402 proxy, policy engine, curation, cache)
  dashboard/   # Next.js + Tailwind frontend (metrics, policies, rankings)
docs/          # Product & technical documentation
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Backend | Hono |
| Database | PostgreSQL (Supabase) |
| Cache | Redis (Upstash, ioredis TCP) |
| Blockchain | SKALE (Zero Gas) |
| Frontend | Next.js + Tailwind + Recharts |
| x402 | @x402/fetch SDK |

## License

MIT
