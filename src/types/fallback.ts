/**
 * Types for Fallback Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Options for fallback pattern
 */
export interface FallbackOptions<TResult = any> {
  /**
   * Primary function to execute
   */
  execute: AsyncFunction<TResult>;

  /**
   * Fallback function(s) to try if primary fails
   * Can be a single function or array of functions (tried in order)
   */
  fallback: AsyncFunction<TResult> | AsyncFunction<TResult>[];

  /**
   * Function to determine if error should trigger fallback
   * @default () => true (all errors trigger fallback)
   */
  shouldFallback?: (error: Error) => boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback when primary execution fails
   */
  onPrimaryFailure?: (error: Error) => void;

  /**
   * Callback when fallback is used
   */
  onFallbackUsed?: (fallbackIndex: number, error: Error) => void;

  /**
   * Callback when all fallbacks fail
   */
  onAllFailed?: (errors: Error[]) => void;
}

/**
 * Result of a fallback operation
 */
export interface FallbackResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Which execution succeeded (0 = primary, 1+ = fallback index)
   */
  succeededAt: number;

  /**
   * Total attempts made
   */
  attempts: number;

  /**
   * Errors from failed attempts
   */
  errors: Error[];
}
