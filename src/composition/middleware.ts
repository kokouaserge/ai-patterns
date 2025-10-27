/**
 * Middleware Adapters - Pattern to Middleware Conversion
 *
 * This file contains adapters that wrap existing patterns as middleware
 * for use with the compose() function.
 */

import type {
  Middleware,
  TimeoutMiddlewareOptions,
  FallbackMiddlewareOptions,
  CacheMiddlewareOptions,
} from "../types/composition";
import { retry } from "../resilience/retry";
import { timeout } from "../resilience/timeout";
import { fallback } from "../resilience/fallback";
import { CircuitBreaker } from "../resilience/circuit-breaker";
import { RateLimiter } from "../rate-limiting/rate-limiter";
import { memoize } from "../caching/memoize";
import type { RetryOptions } from "../types/retry";
import type { CircuitBreakerOptions } from "../types/circuit-breaker";
import type { RateLimiterOptions } from "../types/rate-limiter";

// Re-export types for convenience
export type {
  TimeoutMiddlewareOptions,
  FallbackMiddlewareOptions,
  CacheMiddlewareOptions,
};

// ===== Retry Middleware =====

/**
 * Retry middleware - wraps the retry pattern
 */
export function retryMiddleware<TInput = any, TOutput = any>(
  options: Omit<RetryOptions<TOutput>, "execute"> = {}
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const result = await retry<TOutput>({
      ...options,
      execute: async () => await next(input),
    });
    return result.value;
  };
}

// ===== Timeout Middleware =====

/**
 * Timeout middleware - wraps the timeout pattern
 */
export function timeoutMiddleware<TInput = any, TOutput = any>(
  options: TimeoutMiddlewareOptions
): Middleware<TInput, TOutput> {
  const { duration, message } = options;

  return (next) => async (input) => {
    const result = await timeout<TOutput>({
      execute: async () => await next(input),
      timeoutMs: duration,
      message: message,
    });
    return result.value;
  };
}

// ===== Fallback Middleware =====

/**
 * Fallback middleware - wraps the fallback pattern
 */
export function fallbackMiddleware<TInput = any, TOutput = any>(
  options: FallbackMiddlewareOptions<TInput, TOutput>
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const fallbackFns = Array.isArray(options.fallback)
      ? options.fallback
      : [options.fallback];

    const result = await fallback<TOutput>({
      execute: async () => await next(input),
      fallback: fallbackFns.map(fn => async () => await fn(input)),
      shouldFallback: options.shouldFallback,
    });

    return result.value;
  };
}

// ===== Circuit Breaker Middleware =====

/**
 * Circuit breaker middleware - wraps the CircuitBreaker class
 *
 * Note: Maintains state across calls. Create once and reuse.
 */
export function circuitBreakerMiddleware<TInput = any, TOutput = any>(
  options: Omit<CircuitBreakerOptions<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  let breaker: CircuitBreaker<TOutput> | null = null;

  return (next) => {
    if (!breaker) {
      breaker = new CircuitBreaker(
        async (input: TInput) => await next(input),
        options
      );
    }

    return async (input) => await breaker!.execute(input);
  };
}

// ===== Rate Limiter Middleware =====

/**
 * Rate limiter middleware - wraps the RateLimiter class
 *
 * Note: Maintains state across calls. Create once and reuse.
 */
export function rateLimiterMiddleware<TInput = any, TOutput = any>(
  options: Omit<RateLimiterOptions<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  let limiter: RateLimiter<TOutput> | null = null;

  return (next) => {
    if (!limiter) {
      limiter = new RateLimiter(
        async (input: TInput) => await next(input),
        options
      );
    }

    return async (input) => {
      const result = await limiter!.execute(input);
      if (!result.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}ms`);
      }
      return result.value!;
    };
  };
}

// ===== Cache Middleware =====

/**
 * Cache middleware - wraps the memoize pattern
 */
export function cacheMiddleware<TInput = any, TOutput = any>(
  options: CacheMiddlewareOptions<TInput, TOutput> = {}
): Middleware<TInput, TOutput> {
  return (next) => {
    const memoized = memoize<[TInput], TOutput>({
      execute: async (input: TInput) => await next(input),
      ttl: options.ttl,
      keyFn: options.keyFn ? (input: TInput) => options.keyFn!(input) : undefined,
    });

    return async (input) => await memoized(input);
  };
}

// ===== Cleaner "with*" Aliases =====

export const withRetry = retryMiddleware;
export const withTimeout = timeoutMiddleware;
export const withFallback = fallbackMiddleware;
export const withCircuitBreaker = circuitBreakerMiddleware;
export const withRateLimiter = rateLimiterMiddleware;
export const withCache = cacheMiddleware;
