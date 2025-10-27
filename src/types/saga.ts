/**
 * Types for Saga Pattern
 */

import { MaybePromise, Logger } from "./common";

/**
 * Saga step definition
 */
export interface SagaStep<TContext = any, TResult = any> {
  /**
   * Step name (for logging)
   */
  name: string;

  /**
   * Execution function
   */
  execute: (context: TContext) => MaybePromise<TResult>;

  /**
   * Compensation function (rollback)
   * Called if a subsequent step fails
   */
  compensate?: (context: TContext, result?: TResult) => MaybePromise<void>;

  /**
   * Condition to execute this step
   * @default () => true
   */
  condition?: (context: TContext) => MaybePromise<boolean>;

  /**
   * Timeout for this step in ms
   */
  timeout?: number;
}

/**
 * Options for saga execution
 */
export interface SagaOptions<TContext = any> {
  /**
   * Initial context
   */
  context: TContext;

  /**
   * Array of steps to execute
   */
  steps: SagaStep<TContext>[];

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback before each step
   */
  onStepStart?: (stepName: string, index: number) => void;

  /**
   * Callback after successful step
   */
  onStepComplete?: (stepName: string, result: unknown) => void;

  /**
   * Callback on step failure
   */
  onStepFailed?: (stepName: string, error: Error) => void;

  /**
   * Callback during compensation
   */
  onCompensate?: (stepName: string) => void;

  /**
   * Callback when saga completes
   */
  onComplete?: (context: TContext) => void;

  /**
   * Callback when saga fails
   */
  onFailure?: (error: Error, context: TContext) => void;
}

/**
 * Result of saga execution
 */
export interface SagaResult<TContext> {
  /**
   * Success or failure
   */
  success: boolean;

  /**
   * Final context
   */
  context: TContext;

  /**
   * Results of each step
   */
  stepResults: unknown[];

  /**
   * Completed steps count
   */
  completedSteps: number;

  /**
   * Compensated steps count
   */
  compensatedSteps: number;

  /**
   * Error (if failure)
   */
  error?: Error;

  /**
   * Total duration in ms
   */
  duration: number;
}
