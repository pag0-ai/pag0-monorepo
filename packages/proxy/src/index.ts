import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import curationRoutes from './routes/curation';

const app = new Hono();

// Middleware
app.use('/*', cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3001'] }));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/curation', curationRoutes);

// TODO: Add remaining routes
// app.post('/proxy', proxyHandler)
// app.route('/api/policies', policyRoutes)
// app.route('/api/analytics', analyticsRoutes)

const port = Number(process.env.PORT ?? 3000);

console.log(`Pag0 Proxy running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
