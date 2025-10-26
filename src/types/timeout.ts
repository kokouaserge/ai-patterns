/**
 * Types for Timeout Pattern
 */

import { AsyncFunction, Logger } from "./common";
import { PatternError } from "./errors";

/**
 * Options for timeout pattern
 */
export interface TimeoutOptions<TResult = any> {
  /**
   * Function to execute with timeout
   */
  execute: AsyncFunction<TResult>;

  /**
   * Timeout duration in milliseconds
   */
  timeoutMs: number;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Logger for timeout events
   */
  logger?: Logger;

  /**
   * Callback invoked on timeout
   */
  onTimeout?: () => void;

  /**
   * External AbortSignal for cancellation
   */
  signal?: AbortSignal;
}

/**
 * Result of a successful timeout operation
 */
export interface TimeoutResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Duration of operation in milliseconds
   */
  duration: number;

  /**
   * Whether the operation timed out
   */
  timedOut: false;
}

/**
 * Error thrown when timeout occurs
 */
export interface TimeoutError extends PatternError {
  /**
   * Duration before timeout
   */
  duration: number;

  /**
   * Indicates this is a timeout error
   */
  timedOut: true;
}

/**
 * Common timeout durations (in milliseconds)
 */
export const TimeoutDurations = {
  /**
   * Very short timeout - 1 second
   */
  VERY_SHORT: 1000,

  /**
   * Short timeout - 5 seconds
   */
  SHORT: 5000,

  /**
   * Medium timeout - 10 seconds
   */
  MEDIUM: 10000,

  /**
   * Long timeout - 30 seconds
   */
  LONG: 30000,

  /**
   * Very long timeout - 1 minute
   */
  VERY_LONG: 60000,

  /**
   * Extended timeout - 5 minutes
   */
  EXTENDED: 300000,
};
