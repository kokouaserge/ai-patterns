/**
 * Types for Reflection Loop Pattern
 */

import type { Logger } from "./common";

/**
 * Result of a reflection/critique on a response
 */
export interface ReflectionResult {
  /** Quality score (typically 0-10, but can be any range) */
  score: number;
  /** Detailed feedback for improvement */
  feedback: string;
  /** Whether to continue the reflection loop */
  shouldContinue: boolean;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metrics for a single iteration
 */
export interface ReflectionMetrics {
  /** Execution time in milliseconds */
  executionTime: number;
  /** Reflection time in milliseconds */
  reflectionTime: number;
  /** Total iteration time in milliseconds */
  totalTime: number;
  /** Total tokens used (if response includes tokens) */
  tokens?: number;
  /** Estimated cost (if costPerToken is configured) */
  cost?: number;
}

/**
 * A single iteration in the reflection loop
 */
export interface ReflectionIteration<TResponse> {
  /** Iteration number (1-indexed) */
  iteration: number;
  /** Generated response */
  response: TResponse;
  /** Critique of this response */
  critique: ReflectionResult;
  /** Metrics for this iteration */
  metrics: ReflectionMetrics;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics about the reflection loop
 */
export interface ReflectionStats {
  /** Total number of iterations */
  totalIterations: number;
  /** Total time spent in milliseconds */
  totalTime: number;
  /** Total cost (if tracked) */
  totalCost?: number;
  /** Total tokens used (if tracked) */
  totalTokens?: number;
  /** Average score across all iterations */
  averageScore: number;
  /** Score improvement (best - first) */
  scoreImprovement: number;
  /** Best score achieved */
  bestScore: number;
  /** Worst score achieved */
  worstScore: number;
}

/**
 * Complete history of the reflection loop
 */
export interface ReflectionHistory<TResponse> {
  /** All iterations */
  iterations: ReflectionIteration<TResponse>[];
  /** Statistics */
  stats: ReflectionStats;
  /** Best iteration */
  best: ReflectionIteration<TResponse>;
  /** Last iteration */
  last: ReflectionIteration<TResponse>;
  /** Get a specific iteration */
  getIteration(n: number): ReflectionIteration<TResponse> | undefined;
  /** Get score progression array */
  getScoreProgression(): number[];
  /** Check if scores were improving */
  wasImproving(): boolean;
}

/**
 * Context provided to execute and reflect functions
 */
export interface ReflectionContext<TResponse> {
  /** Current iteration number */
  iteration: number;
  /** Response from previous iteration (undefined on first iteration) */
  previousResponse?: TResponse;
  /** Critique from previous iteration (undefined on first iteration) */
  previousCritique?: ReflectionResult;
  /** History of iterations (if includeHistoryInContext is enabled) */
  history: Array<{
    response: TResponse;
    critique: ReflectionResult;
  }>;
  /** Optional custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Storage interface for persisting reflection history
 */
export interface ReflectionHistoryStorage<TResponse> {
  /** Save an iteration */
  save(
    sessionId: string,
    iteration: ReflectionIteration<TResponse>
  ): Promise<void> | void;
  /** Load history for a session */
  load(
    sessionId: string
  ): Promise<ReflectionIteration<TResponse>[]> | ReflectionIteration<TResponse>[];
  /** Delete history for a session */
  delete(sessionId: string): Promise<void> | void;
  /** List all session IDs (optional) */
  listSessions?(): Promise<string[]> | string[];
}

/**
 * Configuration for reflection loop
 */
export interface ReflectionLoopConfig<TResponse> {
  /**
   * Function that generates a response
   * Receives context with feedback from previous iterations
   */
  execute: (
    context: ReflectionContext<TResponse>
  ) => Promise<TResponse> | TResponse;

  /**
   * Function that critiques a response
   * The AI reflects on its own output and provides feedback
   */
  reflect: (
    response: TResponse,
    context: ReflectionContext<TResponse>
  ) => Promise<ReflectionResult> | ReflectionResult;

  /** Maximum number of iterations. Default: 5 */
  maxIterations?: number;

  /** Target score to reach (stops when achieved). Default: 10 */
  targetScore?: number;

  /**
   * Strategy when max iterations is reached
   * - 'return-best': Return iteration with best score (default)
   * - 'return-last': Return last iteration
   * - 'throw': Throw an error
   */
  onMaxIterationsReached?: "return-best" | "return-last" | "throw";

  /** Callback at the start of the reflection loop */
  onStart?: (config: ReflectionLoopConfig<TResponse>) => void | Promise<void>;

  /** Callback before each execution */
  onBeforeExecute?: (context: ReflectionContext<TResponse>) => void | Promise<void>;

  /** Callback after each execution, before reflection */
  onAfterExecute?: (
    response: TResponse,
    context: ReflectionContext<TResponse>,
    executionTime: number
  ) => void | Promise<void>;

  /** Callback before each reflection */
  onBeforeReflect?: (
    response: TResponse,
    context: ReflectionContext<TResponse>
  ) => void | Promise<void>;

  /** Callback after each reflection */
  onAfterReflect?: (
    critique: ReflectionResult,
    context: ReflectionContext<TResponse>,
    reflectionTime: number
  ) => void | Promise<void>;

  /** Callback at the end of each complete iteration */
  onIterationComplete?: (
    iteration: ReflectionIteration<TResponse>
  ) => void | Promise<void>;

  /** Callback when score improves */
  onImprovement?: (
    currentIteration: ReflectionIteration<TResponse>,
    previousBest: ReflectionIteration<TResponse>
  ) => void | Promise<void>;

  /** Callback when score stagnates or regresses */
  onStagnation?: (
    currentScore: number,
    previousScore: number,
    iteration: number
  ) => void | Promise<void>;

  /** Callback when target score is reached */
  onTargetReached?: (
    iteration: ReflectionIteration<TResponse>,
    history: ReflectionHistory<TResponse>
  ) => void | Promise<void>;

  /** Callback when max iterations is reached */
  onMaxIterations?: (history: ReflectionHistory<TResponse>) => void | Promise<void>;

  /** Callback on error */
  onError?: (
    error: Error,
    context: ReflectionContext<TResponse>,
    iteration: number
  ) => void | Promise<void>;

  /** Callback at the end (success or failure) */
  onComplete?: (
    result: ReflectionLoopResult<TResponse>,
    history: ReflectionHistory<TResponse>
  ) => void | Promise<void>;

  /** Enable history tracking. Default: true */
  enableHistory?: boolean;

  /** Storage for persisting history (optional) */
  historyStorage?: ReflectionHistoryStorage<TResponse>;

  /** Session ID for storage (auto-generated if not provided) */
  sessionId?: string;

  /**
   * Cost per token in dollars (optional)
   * If provided and response includes tokens, cost will be calculated automatically
   * Example: 0.00002 for $0.02 per 1K tokens
   */
  costPerToken?: number;

  /**
   * Include iteration history in context.
   * Can be expensive in terms of tokens. Default: false
   */
  includeHistoryInContext?: boolean;

  /** Maximum number of iterations to include in context. Default: 3 */
  maxHistoryInContext?: number;

  /** Logger instance */
  logger?: Logger;
}

/**
 * Global metrics for the entire reflection loop
 */
export interface ReflectionLoopMetrics {
  /** Total time spent in milliseconds */
  totalTime: number;
  /** Total cost (if tracked) */
  totalCost?: number;
  /** Total tokens used (if tracked) */
  totalTokens?: number;
  /** Average time per iteration in milliseconds */
  averageIterationTime: number;
  /** Score progression array */
  scoreProgression: number[];
}

/**
 * Result from reflection loop execution
 */
export interface ReflectionLoopResult<TResponse> {
  /** The best or final response */
  value: TResponse;
  /** Final score achieved */
  finalScore: number;
  /** Number of iterations performed */
  iterations: number;
  /** Whether target score was reached */
  targetReached: boolean;
  /** Complete history of the loop */
  history: ReflectionHistory<TResponse>;
  /** Timestamp of completion */
  timestamp: number;
  /** Overall metrics */
  metrics: ReflectionLoopMetrics;
}
