import redis from '../cache/redis';
import sql from '../db/postgres';
import type { UsdcAmount } from '../types';

export interface BudgetStatus {
  dailySpent: UsdcAmount;
  dailyLimit: UsdcAmount;
  monthlySpent: UsdcAmount;
  monthlyLimit: UsdcAmount;
}

export class BudgetTracker {
  /**
   * Check current budget status for a project
   * Returns spent amounts and limits from Redis (with DB fallback)
   */
  async checkBudget(projectId: string): Promise<BudgetStatus> {
    const dailyKey = `budget:${projectId}:daily`;
    const monthlyKey = `budget:${projectId}:monthly`;

    // Get current spent from Redis
    const [dailySpent, monthlySpent] = await Promise.all([
      redis.get(dailyKey),
      redis.get(monthlyKey),
    ]);

    // Get spent from DB + limits from active policy
    const [budgetRecord] = await sql`
      SELECT
        b.daily_spent as "dailySpent",
        b.monthly_spent as "monthlySpent",
        p.daily_budget as "dailyLimit",
        p.monthly_budget as "monthlyLimit"
      FROM budgets b
      LEFT JOIN policies p ON p.project_id = b.project_id AND p.is_active = true
      WHERE b.project_id = ${projectId}
      LIMIT 1
    `;

    // If no budget record exists, return zeros
    if (!budgetRecord) {
      return {
        dailySpent: dailySpent || '0',
        dailyLimit: '999999999999999', // unlimited if not configured
        monthlySpent: monthlySpent || '0',
        monthlyLimit: '999999999999999',
      };
    }

    return {
      dailySpent: dailySpent || budgetRecord.dailySpent || '0',
      dailyLimit: budgetRecord.dailyLimit || '999999999999999',
      monthlySpent: monthlySpent || budgetRecord.monthlySpent || '0',
      monthlyLimit: budgetRecord.monthlyLimit || '999999999999999',
    };
  }

  /**
   * Record spending after successful payment
   * Updates both Redis (cache) and PostgreSQL (source of truth)
   *
   * CRITICAL: All amounts are string BIGINT (1 USDC = "1000000")
   */
  async recordSpend(projectId: string, amount: UsdcAmount): Promise<void> {
    const amountBigInt = BigInt(amount);
    const amountNumber = Number(amountBigInt); // Safe for Redis INCRBY (up to 2^53-1)

    const dailyKey = `budget:${projectId}:daily`;
    const monthlyKey = `budget:${projectId}:monthly`;

    // Atomic Redis increment
    const [dailyResult, monthlyResult] = await Promise.all([
      redis.incrby(dailyKey, amountNumber),
      redis.incrby(monthlyKey, amountNumber),
    ]);

    // Set TTL if keys are new (TTL = -1 means no expiration set)
    await this.ensureTTL(dailyKey, 'daily');
    await this.ensureTTL(monthlyKey, 'monthly');

    // Update PostgreSQL (source of truth)
    // Use atomic UPDATE ... RETURNING to ensure data consistency
    await sql`
      INSERT INTO budgets (project_id, daily_spent, monthly_spent)
      VALUES (
        ${projectId},
        ${amount},
        ${amount}
      )
      ON CONFLICT (project_id)
      DO UPDATE SET
        daily_spent = budgets.daily_spent + EXCLUDED.daily_spent,
        monthly_spent = budgets.monthly_spent + EXCLUDED.monthly_spent,
        updated_at = NOW()
      RETURNING *
    `;
  }

  /**
   * Ensure TTL is set on Redis keys
   * - Daily: expires at midnight UTC
   * - Monthly: expires at end of month UTC
   */
  private async ensureTTL(key: string, period: 'daily' | 'monthly'): Promise<void> {
    const ttl = await redis.ttl(key);

    // TTL = -1 means key exists but no expiration set
    // TTL = -2 means key doesn't exist (shouldn't happen after INCRBY)
    if (ttl === -1) {
      const now = new Date();
      let expiresAt: Date;

      if (period === 'daily') {
        // Expire at next midnight UTC
        expiresAt = new Date(now);
        expiresAt.setUTCHours(24, 0, 0, 0);
      } else {
        // Expire at end of current month UTC
        expiresAt = new Date(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          1, // First day of next month
          0, 0, 0, 0
        );
      }

      const secondsUntilExpiry = Math.floor(
        (expiresAt.getTime() - now.getTime()) / 1000
      );

      // Set expiration (minimum 1 second)
      await redis.expire(key, Math.max(1, secondsUntilExpiry));
    }
  }

  /**
   * Get daily spent amount from Redis
   */
  async getDailySpent(projectId: string): Promise<UsdcAmount> {
    const dailyKey = `budget:${projectId}:daily`;
    const spent = await redis.get(dailyKey);
    return spent || '0';
  }

  /**
   * Get monthly spent amount from Redis
   */
  async getMonthlySpent(projectId: string): Promise<UsdcAmount> {
    const monthlyKey = `budget:${projectId}:monthly`;
    const spent = await redis.get(monthlyKey);
    return spent || '0';
  }

  /**
   * Reset daily budget (for testing or manual reset)
   */
  async resetDaily(projectId: string): Promise<void> {
    const dailyKey = `budget:${projectId}:daily`;
    await redis.del(dailyKey);
  }

  /**
   * Reset monthly budget (for testing or manual reset)
   */
  async resetMonthly(projectId: string): Promise<void> {
    const monthlyKey = `budget:${projectId}:monthly`;
    await redis.del(monthlyKey);
  }
}

// Export singleton instance
export const budgetTracker = new BudgetTracker();
export default budgetTracker;
