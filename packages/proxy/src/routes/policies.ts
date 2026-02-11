import { Hono } from 'hono';
import sql from '../db/postgres.js';
import { Policy } from '../types/index.js';

type Variables = {
  user: {
    id: string;
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
  };
  projectId: string;
};

const policyRoutes = new Hono<{ Variables: Variables }>();

/**
 * GET /api/policies
 * List all policies for the authenticated project
 */
policyRoutes.get('/', async (c) => {
  const projectId = c.get('projectId') as string;

  const rows = await sql<Array<{
    id: string;
    project_id: string;
    name: string;
    max_per_request: string;
    daily_budget: string;
    monthly_budget: string;
    allowed_endpoints: string[];
    blocked_endpoints: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>>`
    SELECT
      id,
      project_id,
      name,
      max_per_request,
      daily_budget,
      monthly_budget,
      allowed_endpoints,
      blocked_endpoints,
      is_active,
      created_at,
      updated_at
    FROM policies
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;

  const policies: Policy[] = rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    maxPerRequest: row.max_per_request,
    dailyLimit: row.daily_budget,
    monthlyLimit: row.monthly_budget,
    allowedEndpoints: row.allowed_endpoints,
    blockedEndpoints: row.blocked_endpoints,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return c.json({ policies, total: policies.length });
});

/**
 * POST /api/policies
 * Create a new policy
 */
policyRoutes.post('/', async (c) => {
  const projectId = c.get('projectId') as string;
  const body = await c.req.json();

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name is required and must be a string',
        },
      },
      400,
    );
  }

  // Validate amounts
  const maxPerRequest = body.maxPerRequest || '1000000';
  const dailyBudget = body.dailyBudget || '10000000';
  const monthlyBudget = body.monthlyBudget || '100000000';

  try {
    const maxPerRequestBigInt = BigInt(maxPerRequest);
    const dailyBudgetBigInt = BigInt(dailyBudget);
    const monthlyBudgetBigInt = BigInt(monthlyBudget);

    if (
      maxPerRequestBigInt <= 0n ||
      dailyBudgetBigInt <= 0n ||
      monthlyBudgetBigInt <= 0n
    ) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'All budget amounts must be positive',
          },
        },
        400,
      );
    }

    if (
      maxPerRequestBigInt > dailyBudgetBigInt ||
      dailyBudgetBigInt > monthlyBudgetBigInt
    ) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'maxPerRequest must be <= dailyBudget must be <= monthlyBudget',
          },
        },
        400,
      );
    }
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid budget amount format (must be BIGINT string)',
          details: err instanceof Error ? err.message : String(err),
        },
      },
      400,
    );
  }

  const allowedEndpoints = body.allowedEndpoints || [];
  const blockedEndpoints = body.blockedEndpoints || [];

  // If creating an active policy, deactivate existing active policies
  await sql`
    UPDATE policies
    SET is_active = false, updated_at = NOW()
    WHERE project_id = ${projectId} AND is_active = true
  `;

  // Create new policy
  const rows = await sql<Array<{
    id: string;
    project_id: string;
    name: string;
    max_per_request: string;
    daily_budget: string;
    monthly_budget: string;
    allowed_endpoints: string[];
    blocked_endpoints: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>>`
    INSERT INTO policies (
      project_id,
      name,
      max_per_request,
      daily_budget,
      monthly_budget,
      allowed_endpoints,
      blocked_endpoints,
      is_active
    ) VALUES (
      ${projectId},
      ${body.name},
      ${maxPerRequest},
      ${dailyBudget},
      ${monthlyBudget},
      ${sql.array(allowedEndpoints)},
      ${sql.array(blockedEndpoints)},
      true
    )
    RETURNING
      id,
      project_id,
      name,
      max_per_request,
      daily_budget,
      monthly_budget,
      allowed_endpoints,
      blocked_endpoints,
      is_active,
      created_at,
      updated_at
  `;

  const row = rows[0];
  const policy: Policy = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    maxPerRequest: row.max_per_request,
    dailyLimit: row.daily_budget,
    monthlyLimit: row.monthly_budget,
    allowedEndpoints: row.allowed_endpoints,
    blockedEndpoints: row.blocked_endpoints,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return c.json({ policy }, 201);
});

/**
 * GET /api/policies/:id
 * Get a single policy by ID
 */
policyRoutes.get('/:id', async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');

  const rows = await sql<Array<{
    id: string;
    project_id: string;
    name: string;
    max_per_request: string;
    daily_budget: string;
    monthly_budget: string;
    allowed_endpoints: string[];
    blocked_endpoints: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>>`
    SELECT
      id,
      project_id,
      name,
      max_per_request,
      daily_budget,
      monthly_budget,
      allowed_endpoints,
      blocked_endpoints,
      is_active,
      created_at,
      updated_at
    FROM policies
    WHERE id = ${id} AND project_id = ${projectId}
  `;

  if (rows.length === 0) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Policy not found',
        },
      },
      404,
    );
  }

  const row = rows[0];
  const policy: Policy = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    maxPerRequest: row.max_per_request,
    dailyLimit: row.daily_budget,
    monthlyLimit: row.monthly_budget,
    allowedEndpoints: row.allowed_endpoints,
    blockedEndpoints: row.blocked_endpoints,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return c.json({ policy });
});

/**
 * PUT /api/policies/:id
 * Partial update of a policy
 */
policyRoutes.put('/:id', async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  // Check policy exists and belongs to project
  const existing = await sql<Array<{
    id: string;
    max_per_request: string;
    daily_budget: string;
    monthly_budget: string;
  }>>`
    SELECT id, max_per_request, daily_budget, monthly_budget
    FROM policies
    WHERE id = ${id} AND project_id = ${projectId}
  `;

  if (existing.length === 0) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Policy not found',
        },
      },
      404,
    );
  }

  // Build update fields dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    updates.push(`name = $${updates.length + 1}`);
    values.push(body.name);
  }

  if (body.maxPerRequest !== undefined) {
    try {
      const amount = BigInt(body.maxPerRequest);
      if (amount <= 0n) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'maxPerRequest must be positive',
            },
          },
          400,
        );
      }
      updates.push(`max_per_request = $${updates.length + 1}`);
      values.push(body.maxPerRequest);
    } catch (err) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid maxPerRequest format',
          },
        },
        400,
      );
    }
  }

  if (body.dailyBudget !== undefined) {
    try {
      const amount = BigInt(body.dailyBudget);
      if (amount <= 0n) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'dailyBudget must be positive',
            },
          },
          400,
        );
      }
      updates.push(`daily_budget = $${updates.length + 1}`);
      values.push(body.dailyBudget);
    } catch (err) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid dailyBudget format',
          },
        },
        400,
      );
    }
  }

  if (body.monthlyBudget !== undefined) {
    try {
      const amount = BigInt(body.monthlyBudget);
      if (amount <= 0n) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'monthlyBudget must be positive',
            },
          },
          400,
        );
      }
      updates.push(`monthly_budget = $${updates.length + 1}`);
      values.push(body.monthlyBudget);
    } catch (err) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid monthlyBudget format',
          },
        },
        400,
      );
    }
  }

  if (body.allowedEndpoints !== undefined) {
    updates.push(`allowed_endpoints = $${updates.length + 1}`);
    values.push(sql.array(body.allowedEndpoints || []));
  }

  if (body.blockedEndpoints !== undefined) {
    updates.push(`blocked_endpoints = $${updates.length + 1}`);
    values.push(sql.array(body.blockedEndpoints || []));
  }

  if (body.isActive !== undefined) {
    updates.push(`is_active = $${updates.length + 1}`);
    values.push(body.isActive);

    // If activating this policy, deactivate others
    if (body.isActive === true) {
      await sql`
        UPDATE policies
        SET is_active = false, updated_at = NOW()
        WHERE project_id = ${projectId} AND id != ${id} AND is_active = true
      `;
    }
  }

  if (updates.length === 0) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
        },
      },
      400,
    );
  }

  // Always update updated_at
  updates.push(`updated_at = NOW()`);

  // Execute update using template literal (postgres library doesn't support dynamic SET clauses well)
  // We'll use a different approach: update each field conditionally
  const rows = await sql<Array<{
    id: string;
    project_id: string;
    name: string;
    max_per_request: string;
    daily_budget: string;
    monthly_budget: string;
    allowed_endpoints: string[];
    blocked_endpoints: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>>`
    UPDATE policies
    SET
      name = COALESCE(${body.name || null}, name),
      max_per_request = COALESCE(${body.maxPerRequest || null}, max_per_request),
      daily_budget = COALESCE(${body.dailyBudget || null}, daily_budget),
      monthly_budget = COALESCE(${body.monthlyBudget || null}, monthly_budget),
      allowed_endpoints = COALESCE(${body.allowedEndpoints ? sql.array(body.allowedEndpoints) : null}, allowed_endpoints),
      blocked_endpoints = COALESCE(${body.blockedEndpoints ? sql.array(body.blockedEndpoints) : null}, blocked_endpoints),
      is_active = COALESCE(${body.isActive !== undefined ? body.isActive : null}, is_active),
      updated_at = NOW()
    WHERE id = ${id} AND project_id = ${projectId}
    RETURNING
      id,
      project_id,
      name,
      max_per_request,
      daily_budget,
      monthly_budget,
      allowed_endpoints,
      blocked_endpoints,
      is_active,
      created_at,
      updated_at
  `;

  const row = rows[0];
  const policy: Policy = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    maxPerRequest: row.max_per_request,
    dailyLimit: row.daily_budget,
    monthlyLimit: row.monthly_budget,
    allowedEndpoints: row.allowed_endpoints,
    blockedEndpoints: row.blocked_endpoints,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return c.json({ policy });
});

/**
 * DELETE /api/policies/:id
 * Soft delete (set is_active = false)
 */
policyRoutes.delete('/:id', async (c) => {
  const projectId = c.get('projectId') as string;
  const id = c.req.param('id');

  const result = await sql`
    UPDATE policies
    SET is_active = false, updated_at = NOW()
    WHERE id = ${id} AND project_id = ${projectId}
  `;

  if (result.count === 0) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Policy not found',
        },
      },
      404,
    );
  }

  return c.body(null, 204);
});

export default policyRoutes;
