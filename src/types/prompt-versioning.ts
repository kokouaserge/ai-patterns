/**
 * Types for Prompt Versioning & Experimentation Pattern
 */

import type { Logger } from "./common";

/**
 * Performance metrics for a prompt version
 */
export interface PromptVersionMetrics {
  /** User satisfaction score (0-1) */
  satisfaction?: number;
  /** Average number of tokens used */
  avgTokens?: number;
  /** Error rate (0-1) */
  errorRate?: number;
  /** Average response time in milliseconds */
  avgResponseTime?: number;
  /** Number of times this version has been used */
  usageCount?: number;
  /** Custom metrics */
  [key: string]: number | undefined;
}

/**
 * Configuration for a single prompt version
 */
export interface PromptVersion {
  /** The actual prompt text */
  prompt: string;
  /** Whether this version is active for selection */
  active: boolean;
  /** Performance metrics for this version */
  performance?: PromptVersionMetrics;
  /** Percentage of traffic to receive (0-100). Only used for gradual rollout */
  rolloutPercentage?: number;
  /** Version metadata */
  metadata?: Record<string, any>;
}

/**
 * Rollback condition configuration
 */
export interface RollbackCondition {
  /** Metric to monitor (e.g., 'satisfaction', 'errorRate') */
  metric: keyof PromptVersionMetrics;
  /** Threshold value that triggers rollback */
  threshold: number;
  /** Time window to evaluate (e.g., '1h', '30m', '24h') */
  window: string;
  /** Comparison operator */
  operator?: "lt" | "gt" | "lte" | "gte";
}

/**
 * Auto-rollback configuration
 */
export interface AutoRollbackConfig {
  /** Enable automatic rollback */
  enabled: boolean;
  /** Conditions that trigger rollback */
  conditions: RollbackCondition[];
  /** Target version to rollback to (defaults to previous stable version) */
  targetVersion?: string;
}

/**
 * Result of executing a prompt version
 */
export interface PromptVersionExecutionResult<TResult> {
  /** The result from the execution */
  value: TResult;
  /** Version that was used */
  version: string;
  /** Timestamp of execution */
  timestamp: number;
  /** Token usage if available */
  tokens?: number;
  /** Response time in milliseconds */
  responseTime?: number;
  /** User feedback if available */
  userFeedback?: {
    rating?: number;
    [key: string]: any;
  };
  /** Custom metrics */
  metrics?: Record<string, number>;
}

/**
 * Configuration for prompt versioning
 */
export interface PromptVersioningConfig<TResult> {
  /** Unique identifier for this prompt experiment */
  promptId: string;
  /** Map of version names to version configurations */
  versions: Record<string, PromptVersion>;
  /** Function to execute a prompt and return results */
  execute: (
    prompt: string,
    version: string
  ) => Promise<TResult> | TResult;
  /** Callback when a version is used */
  onVersionUsed?: (
    version: string,
    result: PromptVersionExecutionResult<TResult>
  ) => void | Promise<void>;
  /** Callback on successful execution */
  onSuccess?: (
    version: string,
    result: PromptVersionExecutionResult<TResult>
  ) => void | Promise<void>;
  /** Callback on execution error */
  onError?: (version: string, error: Error) => void | Promise<void>;
  /** Auto-rollback configuration */
  autoRollback?: AutoRollbackConfig;
  /** Logger instance */
  logger?: Logger;
  /** Storage for version metrics and state */
  storage?: PromptVersionStorage;
}

/**
 * Interface for storing prompt version metrics and state
 */
export interface PromptVersionStorage {
  /** Get metrics for a specific version */
  getMetrics(
    promptId: string,
    version: string
  ): Promise<PromptVersionMetrics | null>;
  /** Update metrics for a specific version */
  updateMetrics(
    promptId: string,
    version: string,
    metrics: Partial<PromptVersionMetrics>
  ): Promise<void>;
  /** Get the active version for a prompt */
  getActiveVersion(promptId: string): Promise<string | null>;
  /** Set the active version for a prompt */
  setActiveVersion(promptId: string, version: string): Promise<void>;
  /** Get version history */
  getVersionHistory(promptId: string): Promise<string[]>;
}

/**
 * Result from version management operations
 */
export interface VersionManagementResult {
  /** Success status */
  success: boolean;
  /** Message describing the result */
  message: string;
  /** Previous version if rollback occurred */
  previousVersion?: string;
  /** New version after operation */
  currentVersion?: string;
}
