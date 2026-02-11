import { Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import sql from '../db/postgres';
import { UnauthorizedError } from '../types/index';

const app = new Hono();

// === Utility Functions ===

function generateApiKey(): string {
  const random = randomBytes(16).toString('hex'); // 32 hex chars
  return `pag0_live_${random}`;
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 12,
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

// === POST /register ===

app.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, projectName } = body;

    // Validation
    if (!email || !password) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        },
        400,
      );
    }

    // Check email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        },
        400,
      );
    }

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;
    if (existingUser.length > 0) {
      return c.json(
        {
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists',
          },
        },
        409,
      );
    }

    // Generate API key and hashes
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const passwordHash = await hashPassword(password);

    // Begin transaction: create user + project + policy + budget
    const [user] = await sql`
      INSERT INTO users (email, password_hash, api_key_hash, subscription_tier)
      VALUES (${email}, ${passwordHash}, ${apiKeyHash}, 'free')
      RETURNING id, email, created_at, subscription_tier
    `;

    const defaultProjectName = projectName || 'Default Project';
    const [project] = await sql`
      INSERT INTO projects (user_id, name, is_active)
      VALUES (${user.id}, ${defaultProjectName}, true)
      RETURNING id, name
    `;

    // Create default policy for the project
    await sql`
      INSERT INTO policies (
        project_id,
        name,
        is_active,
        max_per_request,
        daily_budget,
        monthly_budget,
        allowed_endpoints,
        blocked_endpoints
      )
      VALUES (
        ${project.id},
        'Default Policy',
        true,
        1000000,
        10000000,
        100000000,
        '[]'::jsonb,
        '[]'::jsonb
      )
    `;

    // Create budget record
    await sql`
      INSERT INTO budgets (project_id, daily_spent, monthly_spent)
      VALUES (${project.id}, 0, 0)
    `;

    return c.json(
      {
        user: {
          id: user.id,
          email: user.email,
          tier: user.subscription_tier,
          createdAt: user.created_at,
        },
        project: {
          id: project.id,
          name: project.name,
        },
        apiKey, // Return raw API key ONLY on registration
      },
      201,
    );
  } catch (error) {
    console.error('Registration error:', error);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user',
        },
      },
      500,
    );
  }
});

// === POST /login ===

app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        },
        400,
      );
    }

    // Find user by email
    const [user] = await sql`
      SELECT id, email, password_hash, subscription_tier, created_at
      FROM users
      WHERE email = ${email}
    `;

    if (!user) {
      return c.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        401,
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        401,
      );
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        tier: user.subscription_tier,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to login',
        },
      },
      500,
    );
  }
});

// === GET /me ===

app.get('/me', async (c) => {
  try {
    // Get API key from header
    const apiKey = c.req.header('X-Pag0-API-Key');
    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    // Hash the API key and look up user
    const apiKeyHash = hashApiKey(apiKey);
    const [user] = await sql`
      SELECT id, email, subscription_tier, created_at
      FROM users
      WHERE api_key_hash = ${apiKeyHash}
    `;

    if (!user) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Get user's projects
    const projects = await sql`
      SELECT id, name, is_active, created_at
      FROM projects
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `;

    // Create API key preview (first 10 + "..." + last 4)
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);

    // Tier limits
    const tierLimits = {
      free: { requestsPerDay: 1000, projectsMax: 3 },
      pro: { requestsPerDay: -1, projectsMax: 10 }, // -1 = unlimited
      enterprise: { requestsPerDay: -1, projectsMax: -1 },
    };

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        tier: user.subscription_tier,
        createdAt: user.created_at,
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.is_active,
        apiKeyPreview,
      })),
      subscription: {
        tier: user.subscription_tier,
        limits: tierLimits[user.subscription_tier as keyof typeof tierLimits],
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: error.message,
          },
        },
        401,
      );
    }

    console.error('/me error:', error);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user info',
        },
      },
      500,
    );
  }
});

export default app;
