import { Hono } from 'hono';
import { curationEngine } from '../curation/engine';
import sql from '../db/postgres';

const app = new Hono();

/**
 * GET /recommend
 * Query params:
 * - category (required): AI, Data, Blockchain, etc.
 * - limit (optional, default 5): number of recommendations
 * - sortBy (optional, default 'overall'): overall | cost | latency | reliability
 */
app.get('/recommend', async (c) => {
  try {
    const category = c.req.query('category');
    const limitStr = c.req.query('limit');
    const sortBy = c.req.query('sortBy') as
      | 'overall'
      | 'cost'
      | 'latency'
      | 'reliability'
      | undefined;

    if (!category) {
      return c.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message: 'category parameter is required',
          },
        },
        400,
      );
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 5;
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETER',
            message: 'limit must be between 1 and 50',
          },
        },
        400,
      );
    }

    const validSortBy = ['overall', 'cost', 'latency', 'reliability'];
    const sort = sortBy || 'overall';
    if (!validSortBy.includes(sort)) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETER',
            message: 'sortBy must be one of: overall, cost, latency, reliability',
          },
        },
        400,
      );
    }

    const recommendations = await curationEngine.getRecommendations(
      category,
      limit,
      sort as 'overall' | 'cost' | 'latency' | 'reliability',
    );

    return c.json({ data: recommendations });
  } catch (err) {
    console.error('Error in /recommend:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get recommendations',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /compare
 * Query params:
 * - endpoints (required): comma-separated list of 2-5 endpoints
 */
app.get('/compare', async (c) => {
  try {
    const endpointsParam = c.req.query('endpoints');

    if (!endpointsParam) {
      return c.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message: 'endpoints parameter is required',
          },
        },
        400,
      );
    }

    const endpoints = endpointsParam.split(',').map((e) => e.trim());

    if (endpoints.length < 2 || endpoints.length > 5) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Must provide between 2 and 5 endpoints to compare',
          },
        },
        400,
      );
    }

    const comparison = await curationEngine.compareEndpoints(endpoints);

    return c.json({ data: comparison });
  } catch (err) {
    console.error('Error in /compare:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compare endpoints',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /rankings
 * Query params:
 * - category (optional): filter by category, returns all if not specified
 * - limit (optional, default 20): number of results
 */
app.get('/rankings', async (c) => {
  try {
    const category = c.req.query('category');
    const limitStr = c.req.query('limit');

    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return c.json(
        {
          error: {
            code: 'INVALID_PARAMETER',
            message: 'limit must be between 1 and 100',
          },
        },
        400,
      );
    }

    const rankings = await curationEngine.getRankings(category, limit);

    return c.json({ data: rankings });
  } catch (err) {
    console.error('Error in /rankings:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get rankings',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /categories
 * Returns all categories with endpoint count and average score
 */
app.get('/categories', async (c) => {
  try {
    const categories = await sql<
      Array<{
        name: string;
        description: string | null;
        endpoint_count: number;
        avg_score: string | null;
      }>
    >`
      SELECT
        c.name,
        c.description,
        c.endpoint_count,
        ROUND(AVG(es.overall_score), 2) as avg_score
      FROM categories c
      LEFT JOIN endpoint_scores es ON es.category = c.name
      GROUP BY c.name, c.description, c.endpoint_count
      ORDER BY c.name
    `;

    const data = categories.map((cat) => ({
      name: cat.name,
      description: cat.description,
      endpointCount: cat.endpoint_count,
      avgScore: cat.avg_score ? Number(cat.avg_score) : null,
    }));

    return c.json({ data });
  } catch (err) {
    console.error('Error in /categories:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get categories',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /score/:endpoint
 * Get score for a specific endpoint (cached in Redis)
 */
app.get('/score/:endpoint', async (c) => {
  try {
    const endpoint = c.req.param('endpoint');

    if (!endpoint) {
      return c.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message: 'endpoint parameter is required',
          },
        },
        400,
      );
    }

    const score = await curationEngine.getScore(endpoint);

    if (!score) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `No score found for endpoint: ${endpoint}`,
          },
        },
        404,
      );
    }

    return c.json({ data: score });
  } catch (err) {
    console.error('Error in /score/:endpoint:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get endpoint score',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

export default app;
