/**
 * Types for Rate Limiter Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Rate limiting strategies
 */
export enum RateLimitStrategy {
  /**
   * Sliding window - most accurate, higher memory usage
   */
  SLIDING_WINDOW = "SLIDING_WINDOW",

  /**
   * Fixed window - simple, potential burst at boundaries
   */
  FIXED_WINDOW = "FIXED_WINDOW",

  /**
   * Token bucket - best for handling bursts
   */
  TOKEN_BUCKET = "TOKEN_BUCKET",
}

/**
 * Options for rate limiter
 */
export interface RateLimiterOptions<TResult = any> {
  /**
   * Function to execute with rate limiting
   */
  execute: AsyncFunction<TResult>;

  /**
   * Maximum number of requests allowed
   * @default 100
   */
  maxRequests?: number;

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Rate limiting strategy
   * @default RateLimitStrategy.SLIDING_WINDOW
   */
  strategy?: RateLimitStrategy;

  /**
   * For token bucket: refill rate (tokens per second)
   * @default maxRequests / (windowMs / 1000)
   */
  refillRate?: number;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback when limit is reached
   */
  onLimitReached?: (retryAfter: number) => void;
}

/**
 * Result of a rate-limited operation
 */
export interface RateLimitResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Remaining requests in window
   */
  remaining: number;

  /**
   * Reset timestamp
   */
  resetAt: number;
}
