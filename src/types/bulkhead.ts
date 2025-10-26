/**
 * Types for Bulkhead Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Options for bulkhead pattern
 */
export interface BulkheadOptions<TResult = any> {
  /**
   * Function to execute with bulkhead protection
   */
  execute: AsyncFunction<TResult>;

  /**
   * Maximum concurrent executions
   * @default 10
   */
  maxConcurrent?: number;

  /**
   * Maximum queue size (pending requests)
   * @default 100
   */
  maxQueue?: number;

  /**
   * Timeout for queued requests in ms
   * @default undefined (no timeout)
   */
  queueTimeout?: number;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback when request is queued
   */
  onQueued?: (queueSize: number) => void;

  /**
   * Callback when queue is full
   */
  onQueueFull?: () => void;

  /**
   * Callback when request starts executing
   */
  onExecute?: () => void;
}

/**
 * Result of a bulkhead operation
 */
export interface BulkheadResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Time spent waiting in queue (ms)
   */
  queueTime: number;

  /**
   * Execution time (ms)
   */
  executionTime: number;
}

/**
 * Bulkhead statistics
 */
export interface BulkheadStats {
  /**
   * Current concurrent executions
   */
  concurrent: number;

  /**
   * Current queue size
   */
  queueSize: number;

  /**
   * Total completed
   */
  completed: number;

  /**
   * Total rejected (queue full)
   */
  rejected: number;
}
