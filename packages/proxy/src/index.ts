import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Middleware
app.use('/*', cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3001'] }));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// TODO: Add routes
// app.post('/proxy', proxyHandler)
// app.route('/api/policies', policyRoutes)
// app.route('/api/analytics', analyticsRoutes)
// app.route('/api/curation', curationRoutes)
// app.route('/api/auth', authRoutes)

const port = Number(process.env.PORT ?? 3000);

console.log(`Pag0 Proxy running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
