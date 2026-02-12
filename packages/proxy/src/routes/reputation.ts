import { Hono } from 'hono';
import { subgraphClient } from '../subgraph/client';

const app = new Hono();

/**
 * GET /agent?id={endpoint}
 * On-chain reputation profile for an agent/endpoint.
 * agentId is a full URL, so it's passed as a query parameter.
 */
app.get('/agent', async (c) => {
  try {
    const agentId = c.req.query('id');

    if (!agentId) {
      return c.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message: 'id query parameter is required',
          },
        },
        400,
      );
    }

    const profile = await subgraphClient.getAgentProfile(agentId);

    if (!profile) {
      return c.json({ data: null });
    }

    // Compute avg score from recent feedbacks
    const avgScore =
      profile.recentFeedbacks.length > 0
        ? Math.round(
            profile.recentFeedbacks.reduce((sum, f) => sum + f.value, 0) /
              profile.recentFeedbacks.length,
          )
        : 0;

    return c.json({
      data: {
        agentId: profile.agentId,
        avgScore,
        feedbackCount: profile.eventCount,
        firstSeen: new Date(profile.firstSeen * 1000).toISOString(),
        lastSeen: new Date(profile.lastSeen * 1000).toISOString(),
      },
    });
  } catch (err) {
    console.error('Error in /reputation/agent:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get agent reputation',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /feedbacks?agentId={endpoint}&first=20&skip=0
 * Paginated on-chain feedback history for an agent.
 */
app.get('/feedbacks', async (c) => {
  try {
    const agentId = c.req.query('agentId');

    if (!agentId) {
      return c.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message: 'agentId query parameter is required',
          },
        },
        400,
      );
    }

    const first = Math.min(parseInt(c.req.query('first') || '20', 10), 100);
    const skip = parseInt(c.req.query('skip') || '0', 10);

    const feedbacks = await subgraphClient.getFeedbackHistory(agentId, first, skip);

    return c.json({
      data: {
        feedbacks: feedbacks.map((f) => ({
          id: f.id,
          agentId: f.agentId,
          qualityScore: f.value,
          tag1: f.tag1,
          tag2: f.tag2,
          feedbackURI: f.feedbackURI,
          timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
          txHash: f.txHash,
        })),
        pagination: { first, skip },
      },
    });
  } catch (err) {
    console.error('Error in /reputation/feedbacks:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get feedback history',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

/**
 * GET /leaderboard?first=20
 * Top agents ranked by on-chain event count.
 */
app.get('/leaderboard', async (c) => {
  try {
    const first = Math.min(parseInt(c.req.query('first') || '20', 10), 100);

    const agents = await subgraphClient.getLeaderboard(first);

    return c.json({
      data: { agents },
    });
  } catch (err) {
    console.error('Error in /reputation/leaderboard:', err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get leaderboard',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

export default app;
