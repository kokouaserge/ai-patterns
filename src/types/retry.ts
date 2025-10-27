/**
 * Types for Retry Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Backoff strategy for retry delays
 */
export enum BackoffStrategy {
  /**
   * Same delay between each attempt
   */
  CONSTANT = "CONSTANT",

  /**
   * Delay increases linearly (initialDelay * attempt)
   */
  LINEAR = "LINEAR",

  /**
   * Delay increases exponentially (initialDelay * 2^attempt)
   */
  EXPONENTIAL = "EXPONENTIAL",
}

/**
 * Options for retry pattern
 */
export interface RetryOptions<TResult = any> {
  /**
   * Function to execute with retry
   */
  execute: AsyncFunction<TResult>;

  /**
   * Maximum number of attempts (including the first)
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay between attempts in milliseconds
   * @default 30000 (30 seconds)
   */
  maxDelay?: number;

  /**
   * Backoff strategy
   * @default BackoffStrategy.EXPONENTIAL
   */
  backoffStrategy?: BackoffStrategy;

  /**
   * Function to determine if an error is retryable
   * @default () => true (all errors are retryable)
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Logger for retry attempts
   */
  logger?: Logger;

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Number of attempts taken
   */
  attempts: number;

  /**
   * Total delay accumulated across retries
   */
  totalDelay: number;
}

/**
 * Common retry predicates for different error scenarios
 */
export const RetryPredicates = {
  /**
   * Retry only on network errors
   */
  networkErrors: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    );
  },

  /**
   * Retry only on specific HTTP status codes
   */
  httpStatusCodes: (retryCodes: number[]): ((error: Error) => boolean) => {
    return (error: Error & { response?: { status?: number } }): boolean => {
      return (
        error.response !== undefined &&
        error.response.status !== undefined &&
        retryCodes.includes(error.response.status)
      );
    };
  },

  /**
   * Retry on rate limit errors (429) with exponential backoff
   */
  rateLimitErrors: (error: Error & { response?: { status?: number } }): boolean => {
    return error.response !== undefined && error.response.status === 429;
  },

  /**
   * Never retry (useful for testing)
   */
  never: (): ((error: Error, attempt: number) => boolean) => {
    return () => false;
  },

  /**
   * Always retry (default behavior)
   */
  always: (): ((error: Error, attempt: number) => boolean) => {
    return () => true;
  },
};
