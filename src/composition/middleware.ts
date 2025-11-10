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
import { bulkhead } from "../resilience/bulkhead";
import { debounce } from "../timing/debounce";
import { throttle } from "../timing/throttle";
import { idempotent } from "../consistency/idempotency";
import { costTracking } from "../monitoring/cost-tracking";
import { versionedPrompt } from "../experimentation/prompt-versioning";
import { validateResponse } from "../validation/response-validation";
import { smartContextWindow } from "../ai/context-window";
import type { RetryOptions } from "../types/retry";
import type { CircuitBreakerOptions } from "../types/circuit-breaker";
import type { RateLimiterOptions } from "../types/rate-limiter";
import type { BulkheadOptions } from "../types/bulkhead";
import type { DebounceOptions } from "../types/debounce";
import type { ThrottleOptions } from "../types/throttle";
import type { IdempotencyOptions } from "../types/idempotency";
import type { CostTrackingConfig } from "../types/cost-tracking";
import type { PromptVersioningConfig, PromptVersion } from "../types/prompt-versioning";
import type { ValidateResponseConfig, ResponseValidator } from "../types/response-validation";
import type { SmartContextWindowConfig, Message, ContextStrategy } from "../types/context-window";

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
 * Note: Maintains GLOBAL state across all calls. This rate limiter counts
 * all requests regardless of which function is being executed, making it
 * ideal for enforcing API rate limits across different operations.
 *
 * @example
 * ```typescript
 * // This rate limiter will count ALL requests together
 * const robustApi = compose([withRateLimiter({ maxRequests: 5, windowMs: 10000 })]);
 *
 * // These all share the same rate limit counter
 * await robustApi(fetchUsers, undefined);   // Count: 1/5
 * await robustApi(fetchProducts, undefined); // Count: 2/5
 * await robustApi(fetchOrders, undefined);   // Count: 3/5
 * ```
 */
export function rateLimiterMiddleware<TInput = any, TOutput = any>(
  options: Omit<RateLimiterOptions<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  // Create a global rate limiter instance that will be shared across all functions
  // We use a dummy function since we'll override the execution logic
  const limiter = new RateLimiter(
    async () => {
      throw new Error("This should never be called directly");
    },
    options
  );

  // Get direct access to the internal limiter for acquire() calls
  const internalLimiter = limiter.getLimiter();

  return (next) => {
    return async (input) => {
      // Check if we're allowed to proceed based on global rate limit
      const { allowed, retryAfter, remaining } = await internalLimiter.acquire();

      if (!allowed) {
        const logger = options.logger;
        if (logger) {
          logger.warn(`Rate limit reached. Retry in ${retryAfter}ms`);
        }

        if (options.onLimitReached) {
          options.onLimitReached(retryAfter);
        }

        throw new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
      }

      // Execute the actual function with the current input
      try {
        return await next(input);
      } catch (error) {
        // If execution fails, we still count it against the rate limit
        // (the token/slot has been consumed)
        throw error;
      }
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

// ===== Bulkhead Middleware =====

/**
 * Bulkhead middleware - wraps the bulkhead pattern
 * Note: Creates a new bulkhead instance for each input
 */
export function bulkheadMiddleware<TInput = any, TOutput = any>(
  options: Omit<BulkheadOptions<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const fn = bulkhead<TOutput>({
      ...options,
      execute: async () => await next(input),
    });
    return await fn();
  };
}

// ===== Debounce Middleware =====

/**
 * Debounce middleware - wraps the debounce pattern
 */
export function debounceMiddleware<TInput = any, TOutput = any>(
  options: Omit<DebounceOptions<[TInput], TOutput>, "execute">
): Middleware<TInput, TOutput> {
  let debouncedFn: ReturnType<typeof debounce<[TInput], TOutput>> | null = null;

  return (next) => {
    if (!debouncedFn) {
      debouncedFn = debounce<[TInput], TOutput>({
        ...options,
        execute: async (input: TInput) => await next(input),
      });
    }

    return async (input) => await debouncedFn!(input);
  };
}

// ===== Throttle Middleware =====

/**
 * Throttle middleware - wraps the throttle pattern
 */
export function throttleMiddleware<TInput = any, TOutput = any>(
  options: Omit<ThrottleOptions<[TInput], TOutput>, "execute">
): Middleware<TInput, TOutput> {
  let throttledFn: ReturnType<typeof throttle<[TInput], TOutput>> | null = null;

  return (next) => {
    if (!throttledFn) {
      throttledFn = throttle<[TInput], TOutput>({
        ...options,
        execute: async (input: TInput) => await next(input),
      });
    }

    return async (input) => {
      const result = await throttledFn!(input);
      return result!;
    };
  };
}

// ===== Idempotency Middleware =====

/**
 * Idempotency middleware - wraps the idempotency pattern
 */
export function idempotencyMiddleware<TInput = any, TOutput = any>(
  options: Omit<IdempotencyOptions<TOutput>, "execute" | "key"> & {
    keyFn: (input: TInput) => string;
  }
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const key = options.keyFn(input);
    return await idempotent<TOutput>({
      ...options,
      key,
      execute: async () => await next(input),
    });
  };
}

// ===== Cost Tracking Middleware =====

/**
 * Cost tracking middleware - wraps the cost tracking pattern
 */
export function costTrackingMiddleware<TInput = any, TOutput = any>(
  options: Omit<CostTrackingConfig<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const result = await costTracking<TOutput>({
      ...options,
      execute: async () => {
        const value = await next(input);
        // If the value contains tokens, extract them
        if (typeof value === "object" && value !== null && "tokens" in value) {
          return { value: value as TOutput, tokens: (value as any).tokens };
        }
        return { value };
      },
    });
    return result.value;
  };
}

// ===== Prompt Versioning Middleware =====

/**
 * Prompt versioning middleware - wraps the versionedPrompt pattern
 */
export function promptVersioningMiddleware<TInput = any, TOutput = any>(
  options: {
    promptId: string;
    versions: Record<string, PromptVersion>;
    getPromptForInput?: (input: TInput) => string;
  } & Omit<PromptVersioningConfig<TOutput>, "execute" | "promptId" | "versions">
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const result = await versionedPrompt<TOutput>({
      promptId: options.promptId,
      versions: options.versions,
      execute: async (_prompt, _version) => {
        // Pass the selected prompt to the next middleware/function
        // The input can be enhanced with the prompt if needed
        return await next(input);
      },
      storage: options.storage,
      onVersionUsed: options.onVersionUsed,
      onSuccess: options.onSuccess,
      onError: options.onError,
      autoRollback: options.autoRollback,
      logger: options.logger,
    });
    return result.value;
  };
}

// ===== Response Validation Middleware =====

/**
 * Response validation middleware - wraps the validateResponse pattern
 */
export function responseValidationMiddleware<TInput = any, TOutput = any>(
  options: {
    validators: ResponseValidator<TOutput>[];
  } & Omit<ValidateResponseConfig<TOutput>, "execute" | "validators">
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const result = await validateResponse<TOutput>({
      execute: async () => await next(input),
      validators: options.validators,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      parallel: options.parallel,
      onValidationFailed: options.onValidationFailed,
      onValidatorPassed: options.onValidatorPassed,
      onValidationSuccess: options.onValidationSuccess,
      onAllRetriesFailed: options.onAllRetriesFailed,
      logger: options.logger,
    });
    return result.value;
  };
}

// ===== Context Window Middleware =====

/**
 * Context window middleware - wraps the smartContextWindow pattern
 * Useful for managing message history in chat applications
 */
export function contextWindowMiddleware<TInput = any, TOutput = any>(
  options: {
    getMessages: (input: TInput) => Message[];
    maxTokens: number;
    strategy?: ContextStrategy;
  } & Omit<SmartContextWindowConfig<TOutput>, "execute" | "messages" | "maxTokens" | "strategy">
): Middleware<TInput, TOutput> {
  return (next) => async (input) => {
    const messages = options.getMessages(input);

    const result = await smartContextWindow<TOutput>({
      execute: async (_optimizedMessages) => {
        // The next function should receive the optimized messages
        // This can be done by enhancing the input or by convention
        return await next(input);
      },
      messages,
      maxTokens: options.maxTokens,
      strategy: options.strategy,
      strategies: options.strategies,
      tokenCounter: options.tokenCounter,
      keepRecentCount: options.keepRecentCount,
      summarizeOldCount: options.summarizeOldCount,
      summarizer: options.summarizer,
      onTruncation: options.onTruncation,
      onOptimization: options.onOptimization,
      logger: options.logger,
    });
    return result.value;
  };
}

// ===== Cleaner "with*" Aliases =====

export const withRetry = retryMiddleware;
export const withTimeout = timeoutMiddleware;
export const withFallback = fallbackMiddleware;
export const withCircuitBreaker = circuitBreakerMiddleware;
export const withRateLimiter = rateLimiterMiddleware;
export const withCache = cacheMiddleware;
export const withBulkhead = bulkheadMiddleware;
export const withDebounce = debounceMiddleware;
export const withThrottle = throttleMiddleware;
export const withIdempotency = idempotencyMiddleware;
export const withCostTracking = costTrackingMiddleware;
export const withPromptVersioning = promptVersioningMiddleware;
export const withResponseValidation = responseValidationMiddleware;
export const withContextWindow = contextWindowMiddleware;
