/**
 * Cost Tracking Pattern
 *
 * Monitors and controls AI spending in real-time, preventing budget overruns
 * and optimizing costs across your application.
 *
 * @example
 * ```typescript
 * const result = await costTracking({
 *   execute: async () => {
 *     const { text, usage } = await generateText({
 *       model: openai('gpt-4-turbo'),
 *       prompt: longPrompt
 *     });
 *     return { value: text, tokens: usage.totalTokens };
 *   },
 *   costPerToken: ModelCost.GPT4_TURBO,
 *   monthlyBudget: 500,
 *   dailyLimit: 50,
 *   onBudgetWarning: (spent, limit) => {
 *     console.warn(`Budget at 80%: $${spent}/$${limit}`);
 *   },
 *   tags: { feature: 'chatbot', userId: 'user-123' }
 * });
 * ```
 */

import type {
  CostTrackingConfig,
  CostResult,
  CostStorage,
  SpentTracking,
} from "../types/cost-tracking";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";

/**
 * In-memory cost storage implementation
 */
class InMemoryCostStorage implements CostStorage {
  private tracking: Record<string, SpentTracking> = {
    monthly: { spent: 0, periodStart: Date.now(), periodDuration: 30 * 24 * 60 * 60 * 1000 },
    daily: { spent: 0, periodStart: Date.now(), periodDuration: 24 * 60 * 60 * 1000 },
    hourly: { spent: 0, periodStart: Date.now(), periodDuration: 60 * 60 * 1000 },
  };

  async getSpent(period: "monthly" | "daily" | "hourly"): Promise<number> {
    const track = this.tracking[period];
    const now = Date.now();

    // Reset if period has elapsed
    if (now - track.periodStart > track.periodDuration) {
      track.spent = 0;
      track.periodStart = now;
    }

    return track.spent;
  }

  async addSpent(period: "monthly" | "daily" | "hourly", amount: number): Promise<void> {
    const track = this.tracking[period];
    const now = Date.now();

    // Reset if period has elapsed
    if (now - track.periodStart > track.periodDuration) {
      track.spent = 0;
      track.periodStart = now;
    }

    track.spent += amount;
  }

  async resetSpent(period: "monthly" | "daily" | "hourly"): Promise<void> {
    const track = this.tracking[period];
    track.spent = 0;
    track.periodStart = Date.now();
  }
}

/**
 * Default storage instance
 */
const defaultStorage = new InMemoryCostStorage();

/**
 * Check if budget would be exceeded
 */
async function checkBudgetLimits(
  cost: number,
  config: CostTrackingConfig,
  storage: CostStorage
): Promise<void> {
  const { monthlyBudget, dailyLimit, hourlyLimit, budget, logger = defaultLogger } = config;

  // Check monthly budget
  const monthlyMax = budget?.monthly ?? monthlyBudget;
  if (monthlyMax !== undefined) {
    const monthlySpent = await storage.getSpent("monthly");
    const newMonthlyTotal = monthlySpent + cost;

    if (newMonthlyTotal > monthlyMax) {
      logger.error(`Monthly budget exceeded: $${newMonthlyTotal.toFixed(2)} > $${monthlyMax.toFixed(2)}`);

      if (config.onBudgetExceeded) {
        await config.onBudgetExceeded(newMonthlyTotal, monthlyMax);
      }

      throw new PatternError(
        `Monthly budget exceeded: $${newMonthlyTotal.toFixed(2)} > $${monthlyMax.toFixed(2)}`,
        ErrorCode.BUDGET_EXCEEDED,
        undefined,
        { period: "monthly", spent: newMonthlyTotal, limit: monthlyMax }
      );
    }
  }

  // Check daily limit
  const dailyMax = budget?.daily ?? dailyLimit;
  if (dailyMax !== undefined) {
    const dailySpent = await storage.getSpent("daily");
    const newDailyTotal = dailySpent + cost;

    if (newDailyTotal > dailyMax) {
      logger.error(`Daily budget exceeded: $${newDailyTotal.toFixed(2)} > $${dailyMax.toFixed(2)}`);

      if (config.onBudgetExceeded) {
        await config.onBudgetExceeded(newDailyTotal, dailyMax);
      }

      throw new PatternError(
        `Daily budget exceeded: $${newDailyTotal.toFixed(2)} > $${dailyMax.toFixed(2)}`,
        ErrorCode.BUDGET_EXCEEDED,
        undefined,
        { period: "daily", spent: newDailyTotal, limit: dailyMax }
      );
    }
  }

  // Check hourly limit
  const hourlyMax = budget?.hourly ?? hourlyLimit;
  if (hourlyMax !== undefined) {
    const hourlySpent = await storage.getSpent("hourly");
    const newHourlyTotal = hourlySpent + cost;

    if (newHourlyTotal > hourlyMax) {
      logger.error(`Hourly budget exceeded: $${newHourlyTotal.toFixed(2)} > $${hourlyMax.toFixed(2)}`);

      if (config.onBudgetExceeded) {
        await config.onBudgetExceeded(newHourlyTotal, hourlyMax);
      }

      throw new PatternError(
        `Hourly budget exceeded: $${newHourlyTotal.toFixed(2)} > $${hourlyMax.toFixed(2)}`,
        ErrorCode.BUDGET_EXCEEDED,
        undefined,
        { period: "hourly", spent: newHourlyTotal, limit: hourlyMax }
      );
    }
  }
}

/**
 * Trigger alerts based on spending thresholds
 */
async function triggerAlerts(
  cost: number,
  config: CostTrackingConfig,
  storage: CostStorage
): Promise<void> {
  const { monthlyBudget, budget, alerts, logger = defaultLogger } = config;

  // Process custom alerts
  if (alerts && alerts.length > 0) {
    const monthlyMax = budget?.monthly ?? monthlyBudget;
    if (monthlyMax !== undefined) {
      const monthlySpent = await storage.getSpent("monthly");
      const newMonthlyTotal = monthlySpent + cost;
      const percentage = newMonthlyTotal / monthlyMax;

      for (const alert of alerts) {
        if (percentage >= alert.threshold && monthlySpent / monthlyMax < alert.threshold) {
          logger.warn(
            `Budget alert: ${(alert.threshold * 100).toFixed(0)}% threshold reached - $${newMonthlyTotal.toFixed(2)}/$${monthlyMax.toFixed(2)}`
          );
          await alert.action(newMonthlyTotal, monthlyMax);
        }
      }
    }
  }

  // Default warning at 80%
  if (config.onBudgetWarning) {
    const monthlyMax = budget?.monthly ?? monthlyBudget;
    if (monthlyMax !== undefined) {
      const monthlySpent = await storage.getSpent("monthly");
      const newMonthlyTotal = monthlySpent + cost;
      const percentage = newMonthlyTotal / monthlyMax;

      if (percentage >= 0.8 && monthlySpent / monthlyMax < 0.8) {
        logger.warn(`Budget warning: 80% threshold reached - $${newMonthlyTotal.toFixed(2)}/$${monthlyMax.toFixed(2)}`);
        await config.onBudgetWarning(newMonthlyTotal, monthlyMax);
      }
    }
  }
}

/**
 * Update spent amounts in storage
 */
async function updateSpentAmounts(cost: number, storage: CostStorage): Promise<void> {
  await storage.addSpent("monthly", cost);
  await storage.addSpent("daily", cost);
  await storage.addSpent("hourly", cost);
}

/**
 * Calculate remaining budget
 */
async function calculateRemainingBudget(
  config: CostTrackingConfig,
  storage: CostStorage
): Promise<number | undefined> {
  const { monthlyBudget, budget } = config;
  const monthlyMax = budget?.monthly ?? monthlyBudget;

  if (monthlyMax !== undefined) {
    const monthlySpent = await storage.getSpent("monthly");
    return monthlyMax - monthlySpent;
  }

  return undefined;
}

/**
 * Execute an operation with cost tracking
 */
export async function costTracking<TResult = any>(
  config: CostTrackingConfig<TResult>
): Promise<CostResult<TResult>> {
  const {
    execute,
    costPerToken,
    tags,
    costThresholdWarning,
    onCostCalculated,
    onExpensiveOperation,
    logger = defaultLogger,
    storage = defaultStorage,
  } = config;

  const timestamp = Date.now();

  try {
    // Execute the operation
    logger.debug("Executing operation with cost tracking", { tags });
    const result = await execute();

    // Calculate cost
    const tokens = result.tokens ?? 0;
    const cost = tokens * costPerToken;

    logger.info(`Operation completed: ${tokens} tokens, $${cost.toFixed(4)}`, { tags });

    // Check for expensive operation
    if (costThresholdWarning !== undefined && cost > costThresholdWarning) {
      logger.warn(`Expensive operation detected: $${cost.toFixed(4)} (threshold: $${costThresholdWarning})`, { tags });

      if (onExpensiveOperation) {
        await onExpensiveOperation(cost, tags);
      }
    }

    // Check budget limits (will throw if exceeded)
    await checkBudgetLimits(cost, config, storage);

    // Trigger alerts
    await triggerAlerts(cost, config, storage);

    // Update spent amounts
    await updateSpentAmounts(cost, storage);

    // Call onCostCalculated callback
    if (onCostCalculated) {
      await onCostCalculated(cost, tags);
    }

    // Calculate remaining budget
    const remainingBudget = await calculateRemainingBudget(config, storage);

    return {
      value: result.value,
      cost,
      tokens,
      remainingBudget,
      tags,
      timestamp,
    };
  } catch (error) {
    logger.error("Operation failed with cost tracking", {
      error: error instanceof Error ? error.message : String(error),
      tags,
    });
    throw error;
  }
}

/**
 * Create a cost tracking wrapper function
 */
export function createCostTracker<TResult = any>(
  baseConfig: Omit<CostTrackingConfig<TResult>, "execute">
) {
  return (execute: () => Promise<{ value: TResult; tokens?: number }>) => {
    return costTracking({
      ...baseConfig,
      execute,
    });
  };
}

/**
 * Export storage for testing and custom implementations
 */
export { InMemoryCostStorage };
