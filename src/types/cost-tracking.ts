/**
 * Types for Cost Tracking pattern
 */

import type { Logger } from "./common";

/**
 * Predefined costs per 1M tokens for popular AI models
 * Prices are in dollars per million tokens
 */
export enum ModelCost {
  // OpenAI GPT-4 models
  GPT4_TURBO = 0.00001, // $10 per 1M tokens (input)
  GPT4 = 0.00003, // $30 per 1M tokens (input)
  GPT4_32K = 0.00006, // $60 per 1M tokens (input)

  // OpenAI GPT-3.5 models
  GPT35_TURBO = 0.0000005, // $0.50 per 1M tokens (input)
  GPT35_TURBO_16K = 0.000001, // $1.00 per 1M tokens (input)

  // Anthropic Claude models
  CLAUDE_3_5_SONNET = 0.000003, // $3 per 1M tokens (input)
  CLAUDE_3_OPUS = 0.000015, // $15 per 1M tokens (input)
  CLAUDE_3_SONNET = 0.000003, // $3 per 1M tokens (input)
  CLAUDE_3_HAIKU = 0.00000025, // $0.25 per 1M tokens (input)

  // Google Gemini models
  GEMINI_1_5_PRO = 0.00000125, // $1.25 per 1M tokens (input)
  GEMINI_1_5_FLASH = 0.000000075, // $0.075 per 1M tokens (input)
}

/**
 * Cost calculation result
 */
export interface CostResult<TResult = any> {
  /** The result from the operation */
  value: TResult;
  /** Cost of the operation */
  cost: number;
  /** Number of tokens used */
  tokens?: number;
  /** Remaining budget for the period */
  remainingBudget?: number;
  /** Tags associated with this operation */
  tags?: Record<string, string>;
  /** Timestamp of the operation */
  timestamp: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Monthly budget limit in dollars */
  monthly?: number;
  /** Daily budget limit in dollars */
  daily?: number;
  /** Hourly budget limit in dollars */
  hourly?: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Threshold as a percentage (0.0 to 1.0) */
  threshold: number;
  /** Action to take when threshold is reached */
  action: (spent: number, limit: number) => void | Promise<void>;
}

/**
 * Callback when cost is calculated
 */
export type OnCostCalculated = (
  cost: number,
  tags?: Record<string, string>
) => void | Promise<void>;

/**
 * Callback when budget warning is triggered
 */
export type OnBudgetWarning = (spent: number, limit: number) => void | Promise<void>;

/**
 * Callback when budget is exceeded
 */
export type OnBudgetExceeded = (spent: number, limit: number) => void | Promise<void>;

/**
 * Callback when an expensive operation is detected
 */
export type OnExpensiveOperation = (
  cost: number,
  tags?: Record<string, string>
) => void | Promise<void>;

/**
 * Cost tracking configuration
 */
export interface CostTrackingConfig<TResult = any> {
  /** Function to execute */
  execute: () => Promise<{ value: TResult; tokens?: number }>;

  /** Cost per token in dollars */
  costPerToken: number;

  /** Monthly budget limit in dollars */
  monthlyBudget?: number;

  /** Daily budget limit in dollars */
  dailyLimit?: number;

  /** Hourly budget limit in dollars */
  hourlyLimit?: number;

  /** Budget configuration (alternative to individual limits) */
  budget?: BudgetConfig;

  /** Multiple alert configurations */
  alerts?: AlertConfig[];

  /** Tags for categorizing costs */
  tags?: Record<string, string>;

  /** Callback when cost is calculated */
  onCostCalculated?: OnCostCalculated;

  /** Callback when budget warning is triggered (80% by default) */
  onBudgetWarning?: OnBudgetWarning;

  /** Callback when budget is exceeded */
  onBudgetExceeded?: OnBudgetExceeded;

  /** Cost threshold for expensive operation warning (in dollars) */
  costThresholdWarning?: number;

  /** Callback when an expensive operation is detected */
  onExpensiveOperation?: OnExpensiveOperation;

  /** Logger instance */
  logger?: Logger;

  /** Storage for tracking spent amounts */
  storage?: CostStorage;
}

/**
 * Cost storage interface for tracking spent amounts
 */
export interface CostStorage {
  /** Get total spent for a period */
  getSpent(period: "monthly" | "daily" | "hourly"): Promise<number>;

  /** Add spent amount for a period */
  addSpent(period: "monthly" | "daily" | "hourly", amount: number): Promise<void>;

  /** Reset spent amount for a period */
  resetSpent(period: "monthly" | "daily" | "hourly"): Promise<void>;
}

/**
 * Spent tracking by period
 */
export interface SpentTracking {
  /** Amount spent in current period */
  spent: number;
  /** Timestamp of period start */
  periodStart: number;
  /** Period duration in milliseconds */
  periodDuration: number;
}

/**
 * Cost analytics data
 */
export interface CostAnalytics {
  /** Total cost */
  totalCost: number;
  /** Cost by feature */
  byFeature?: Record<string, number>;
  /** Cost by user */
  byUser?: Record<string, number>;
  /** Cost by time period */
  byPeriod?: Record<string, number>;
  /** Average cost per operation */
  averageCost?: number;
  /** Most expensive operations */
  topExpensive?: Array<{ cost: number; tags: Record<string, string>; timestamp: number }>;
}
