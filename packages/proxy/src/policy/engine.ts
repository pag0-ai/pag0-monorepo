import sql from '../db/postgres';
import type { Policy, PolicyViolationError, ProxyRequest, UsdcAmount } from '../types';
import { BudgetTracker } from './budget';

export interface PolicyEvaluation {
  allowed: boolean;
  policy: Policy;
  reason?: 'ENDPOINT_BLOCKED' | 'ENDPOINT_NOT_WHITELISTED' |
          'PER_REQUEST_LIMIT_EXCEEDED' | 'DAILY_BUDGET_EXCEEDED' |
          'MONTHLY_BUDGET_EXCEEDED';
  details?: string;
}

export class PolicyEngine {
  private budgetTracker: BudgetTracker;

  constructor() {
    this.budgetTracker = new BudgetTracker();
  }

  /**
   * Evaluate a proxy request against active policies
   *
   * Validation steps:
   * 1. Get active policy for project
   * 2. Check endpoint blacklist
   * 3. Check endpoint whitelist (if configured)
   * 4. Check per-request amount limit
   * 5. Check daily budget
   * 6. Check monthly budget
   */
  async evaluate(
    request: ProxyRequest,
    estimatedCost: UsdcAmount,
  ): Promise<PolicyEvaluation> {
    // Step 1: Get active policy for project
    const [policy] = await sql<Policy[]>`
      SELECT
        id,
        project_id as "projectId",
        name,
        max_per_request as "maxPerRequest",
        daily_budget as "dailyBudget",
        monthly_budget as "monthlyBudget",
        allowed_endpoints as "allowedEndpoints",
        blocked_endpoints as "blockedEndpoints",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM policies
      WHERE project_id = ${request.projectId}
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // If no active policy, allow all requests
    if (!policy) {
      // Create a permissive default policy for return value
      const defaultPolicy: Policy = {
        id: 'default',
        projectId: request.projectId,
        name: 'Default (No Restrictions)',
        maxPerRequest: '999999999999999', // effectively unlimited
        dailyBudget: '999999999999999',
        monthlyBudget: '999999999999999',
        allowedEndpoints: [],
        blockedEndpoints: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { allowed: true, policy: defaultPolicy };
    }

    // Extract hostname from target URL for pattern matching
    const hostname = this.extractHostname(request.targetUrl);

    // Step 2: Check blocked endpoints
    if (policy.blockedEndpoints.length > 0) {
      for (const pattern of policy.blockedEndpoints) {
        if (this.matchPattern(hostname, pattern)) {
          return {
            allowed: false,
            policy,
            reason: 'ENDPOINT_BLOCKED',
            details: `Endpoint ${hostname} matches blocked pattern: ${pattern}`,
          };
        }
      }
    }

    // Step 3: Check allowed endpoints (whitelist)
    // Empty allowedEndpoints = allow all (except blocked)
    if (policy.allowedEndpoints.length > 0) {
      let isWhitelisted = false;
      for (const pattern of policy.allowedEndpoints) {
        if (this.matchPattern(hostname, pattern)) {
          isWhitelisted = true;
          break;
        }
      }
      if (!isWhitelisted) {
        return {
          allowed: false,
          policy,
          reason: 'ENDPOINT_NOT_WHITELISTED',
          details: `Endpoint ${hostname} is not in allowed list`,
        };
      }
    }

    // Step 4: Check per-request limit
    const costBigInt = BigInt(estimatedCost);
    const maxPerRequestBigInt = BigInt(policy.maxPerRequest);
    if (costBigInt > maxPerRequestBigInt) {
      return {
        allowed: false,
        policy,
        reason: 'PER_REQUEST_LIMIT_EXCEEDED',
        details: `Request cost ${estimatedCost} exceeds limit ${policy.maxPerRequest}`,
      };
    }

    // Step 5 & 6: Check daily and monthly budgets
    const budgetStatus = await this.budgetTracker.checkBudget(request.projectId);

    const dailySpentBigInt = BigInt(budgetStatus.dailySpent);
    const dailyLimitBigInt = BigInt(policy.dailyBudget);
    if (dailySpentBigInt + costBigInt > dailyLimitBigInt) {
      return {
        allowed: false,
        policy,
        reason: 'DAILY_BUDGET_EXCEEDED',
        details: `Daily budget exceeded: ${budgetStatus.dailySpent}/${policy.dailyBudget} (requesting ${estimatedCost})`,
      };
    }

    const monthlySpentBigInt = BigInt(budgetStatus.monthlySpent);
    const monthlyLimitBigInt = BigInt(policy.monthlyBudget);
    if (monthlySpentBigInt + costBigInt > monthlyLimitBigInt) {
      return {
        allowed: false,
        policy,
        reason: 'MONTHLY_BUDGET_EXCEEDED',
        details: `Monthly budget exceeded: ${budgetStatus.monthlySpent}/${policy.monthlyBudget} (requesting ${estimatedCost})`,
      };
    }

    return { allowed: true, policy };
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      // If URL parsing fails, return the original string
      return url;
    }
  }

  /**
   * Match hostname against pattern with wildcard support
   *
   * Examples:
   * - "api.openai.com" matches "api.openai.com"
   * - "api.openai.com" matches "*.openai.com"
   * - "api.openai.com" matches "*.com"
   */
  private matchPattern(hostname: string, pattern: string): boolean {
    // Exact match
    if (hostname === pattern) return true;

    // Wildcard pattern: convert to regex
    // Escape special regex chars except *, then replace * with .*
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${escapedPattern}$`, 'i'); // case-insensitive
    return regex.test(hostname);
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
export default policyEngine;
