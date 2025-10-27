/**
 * Types for Fan-Out Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Options for fan-out pattern
 */
export interface FanOutOptions<TInput, TOutput> {
  /**
   * Array of items to process
   */
  items: TInput[];

  /**
   * Transformation function to apply to each item
   */
  execute: AsyncFunction<TOutput, [TInput]>;

  /**
   * Maximum concurrency level
   * @default Infinity (no limit)
   */
  concurrency?: number;

  /**
   * Continue processing even if some items fail
   * @default false
   */
  continueOnError?: boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Progress callback
   */
  onProgress?: (completed: number, total: number, item: TInput) => void;

  /**
   * Error callback
   */
  onError?: (error: Error, item: TInput, index: number) => void;
}

/**
 * Result of fan-out operation
 */
export interface FanOutResult<TOutput> {
  /**
   * Successful results
   */
  results: TOutput[];

  /**
   * Errors by index
   */
  errors: Map<number, Error>;

  /**
   * Total number of items processed
   */
  total: number;

  /**
   * Number of successes
   */
  successCount: number;

  /**
   * Number of failures
   */
  errorCount: number;

  /**
   * Total duration in ms
   */
  duration: number;
}
