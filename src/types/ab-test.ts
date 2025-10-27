/**
 * Types for A/B Testing pattern
 */

import type { Logger } from "./common";

/**
 * A/B test variant configuration
 */
export interface ABTestVariant<TResult = any> {
  /** Unique name for this variant */
  name: string;
  /** Weight for random selection (should sum to 1.0 across all variants) */
  weight: number;
  /** Function to execute for this variant */
  execute: () => Promise<TResult>;
}

/**
 * Metrics tracking configuration
 */
export interface MetricsConfig {
  /** Track user engagement */
  trackEngagement?: boolean;
  /** Track user satisfaction */
  trackSatisfaction?: boolean;
  /** Track conversion rate */
  trackConversion?: boolean;
  /** Custom metrics */
  custom?: Record<string, boolean>;
}

/**
 * User feedback data
 */
export interface UserFeedback {
  /** User satisfaction rating (0-5) */
  rating?: number;
  /** Whether the user converted */
  converted?: boolean;
  /** Whether the user engaged with the result */
  engaged?: boolean;
  /** Custom feedback data */
  custom?: Record<string, any>;
}

/**
 * Result of an A/B test execution
 */
export interface ABTestResult<TResult = any> {
  /** The selected variant */
  variant: ABTestVariant<TResult>;
  /** The result of the variant execution */
  value: TResult;
  /** Timestamp of execution */
  timestamp: number;
  /** User ID associated with this test */
  userId?: string;
  /** Experiment ID */
  experimentId?: string;
}

/**
 * Callback when a variant is selected
 */
export type OnVariantSelected<TResult = any> = (
  variant: ABTestVariant<TResult>,
  result: TResult
) => void | Promise<void>;

/**
 * Callback when a test succeeds
 */
export type OnSuccess<TResult = any> = (
  variant: ABTestVariant<TResult>,
  result: TResult,
  userFeedback?: UserFeedback
) => void | Promise<void>;

/**
 * Callback when a test fails
 */
export type OnError<TResult = any> = (
  variant: ABTestVariant<TResult>,
  error: Error
) => void | Promise<void>;

/**
 * A/B test configuration options
 */
export interface ABTestConfig<TResult = any> {
  /** List of variants to test */
  variants: ABTestVariant<TResult>[];

  /** User ID for consistent variant assignment */
  userId?: string;

  /** Experiment ID for tracking */
  experimentId?: string;

  /** Assignment strategy (default: weighted) */
  strategy?: VariantAssignmentStrategy;

  /** Storage for sticky assignments */
  storage?: AssignmentStorage;

  /** Metrics to track */
  metrics?: MetricsConfig;

  /** Enable conversion tracking */
  conversionTracking?: boolean;

  /** Callback when variant is selected */
  onVariantSelected?: OnVariantSelected<TResult>;

  /** Callback when test succeeds */
  onSuccess?: OnSuccess<TResult>;

  /** Callback when test fails */
  onError?: OnError<TResult>;

  /** Logger instance */
  logger?: Logger;
}

/**
 * Variant assignment strategy
 */
export enum VariantAssignmentStrategy {
  /** Random selection without user consistency */
  RANDOM = "random",
  /** Weighted selection with user consistency */
  WEIGHTED = "weighted",
  /** Sticky assignments - same user always gets same variant */
  STICKY = "sticky",
}

/**
 * Sticky assignment storage interface
 */
export interface AssignmentStorage {
  /** Get assigned variant for a user */
  get(userId: string, experimentId: string): Promise<string | null>;

  /** Set assigned variant for a user */
  set(userId: string, experimentId: string, variantName: string): Promise<void>;
}
