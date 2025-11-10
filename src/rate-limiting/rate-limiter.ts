/**
 * Rate Limiter Pattern - Control request throughput
 */

import { AsyncFunction, Logger, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  RateLimitStrategy,
  RateLimiterOptions,
  RateLimitResult,
} from "../types/rate-limiter";

/**
 * Internal options (without execute field)
 */
interface RateLimiterInternalOptions {
  maxRequests?: number;
  windowMs?: number;
  strategy?: RateLimitStrategy;
  refillRate?: number;
  logger?: Logger;
  onLimitReached?: (retryAfter: number) => void;
}

/**
 * Sliding Window Rate Limiter
 */
class SlidingWindowLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire(): Promise<{
    allowed: boolean;
    retryAfter: number;
    remaining: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old requests
    this.requests = this.requests.filter((time) => time > windowStart);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return {
        allowed: true,
        retryAfter: 0,
        remaining: this.maxRequests - this.requests.length,
      };
    }

    // Calculate wait time
    const oldestRequest = this.requests[0];
    const retryAfter = oldestRequest + this.windowMs - now;

    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }

  getRemaining(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.requests = this.requests.filter((time) => time > windowStart);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }
}

/**
 * Fixed Window Rate Limiter
 */
class FixedWindowLimiter {
  private count = 0;
  private windowStart = Date.now();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire(): Promise<{
    allowed: boolean;
    retryAfter: number;
    remaining: number;
  }> {
    const now = Date.now();

    // Reset if window expired
    if (now - this.windowStart >= this.windowMs) {
      this.count = 0;
      this.windowStart = now;
    }

    if (this.count < this.maxRequests) {
      this.count++;
      return {
        allowed: true,
        retryAfter: 0,
        remaining: this.maxRequests - this.count,
      };
    }

    // Calculate wait time
    const retryAfter = this.windowStart + this.windowMs - now;

    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }

  getRemaining(): number {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - this.count);
  }

  reset(): void {
    this.count = 0;
    this.windowStart = Date.now();
  }
}

/**
 * Token Bucket Rate Limiter
 */
class TokenBucketLimiter {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
  }

  async acquire(): Promise<{
    allowed: boolean;
    retryAfter: number;
    remaining: number;
  }> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return {
        allowed: true,
        retryAfter: 0,
        remaining: Math.floor(this.tokens),
      };
    }

    // Calculate wait time for next token
    const retryAfter = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);

    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // in seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getRemaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

type Limiter = SlidingWindowLimiter | FixedWindowLimiter | TokenBucketLimiter;

/**
 * Rate Limiter - Controls request throughput
 */
export class RateLimiter<TResult = any, TArgs extends any[] = any[]> {
  private limiter: Limiter;

  constructor(
    private readonly fn: AsyncFunction<TResult, TArgs>,
    private readonly options: RateLimiterInternalOptions = {}
  ) {
    const {
      maxRequests = 100,
      windowMs = 60000,
      strategy = RateLimitStrategy.SLIDING_WINDOW,
      refillRate = maxRequests / (windowMs / 1000),
    } = options;

    // Validation
    if (maxRequests <= 0) {
      throw new PatternError(
        `maxRequests must be > 0, received: ${maxRequests}`,
        ErrorCode.INVALID_RATE_LIMIT_CONFIG
      );
    }

    if (windowMs <= 0) {
      throw new PatternError(
        `windowMs must be > 0, received: ${windowMs}`,
        ErrorCode.INVALID_RATE_LIMIT_CONFIG
      );
    }

    switch (strategy) {
      case RateLimitStrategy.SLIDING_WINDOW:
        this.limiter = new SlidingWindowLimiter(maxRequests, windowMs);
        break;

      case RateLimitStrategy.FIXED_WINDOW:
        this.limiter = new FixedWindowLimiter(maxRequests, windowMs);
        break;

      case RateLimitStrategy.TOKEN_BUCKET:
        this.limiter = new TokenBucketLimiter(maxRequests, refillRate);
        break;

      default:
        throw new PatternError(
          `Unknown strategy: ${strategy}`,
          ErrorCode.INVALID_RATE_LIMIT_STRATEGY
        );
    }
  }

  /**
   * Execute function with rate limiting
   */
  async execute(...args: TArgs): Promise<RateLimitResult<TResult>> {
    const logger = this.options.logger ?? defaultLogger;
    const { allowed, retryAfter, remaining } = await this.limiter.acquire();

    if (!allowed) {
      logger.warn(`Rate limit reached. Retry in ${retryAfter}ms`);

      if (this.options.onLimitReached) {
        this.options.onLimitReached(retryAfter);
      }

      return {
        allowed: false,
        retryAfter,
        remaining: 0,
      };
    }

    const value = await this.fn(...args);

    return {
      allowed: true,
      value,
      remaining,
      retryAfter: 0,
    };
  }

  /**
   * Execute with automatic wait if rate limit reached
   */
  async executeWithWait(...args: TArgs): Promise<RateLimitResult<TResult>> {
    const logger = this.options.logger ?? defaultLogger;
    const { allowed, retryAfter, remaining } = await this.limiter.acquire();

    if (allowed) {
      const value = await this.fn(...args);

      return {
        allowed: true,
        value,
        remaining,
        retryAfter: 0,
      };
    }

    logger.info(`Rate limit reached, waiting ${retryAfter}ms`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter));

    // Recursively retry after waiting
    return this.executeWithWait(...args);
  }

  /**
   * Get remaining requests
   */
  getRemaining(): number {
    return this.limiter.getRemaining();
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.limiter.reset();
  }

  /**
   * Get the internal limiter for direct access (used by middleware)
   * @internal
   */
  getLimiter(): Limiter {
    return this.limiter;
  }
}

/**
 * Callable rate limiter type (Vercel-style)
 */
export interface CallableRateLimiter<TResult = any, TArgs extends any[] = any[]> {
  (...args: TArgs): Promise<RateLimitResult<TResult>>;
  wait(...args: TArgs): Promise<RateLimitResult<TResult>>;
  getRemaining(): number;
  reset(): void;
}

/**
 * Define a rate limiter with Vercel-style callable API
 *
 * @example
 * ```typescript
 * const limiter = defineRateLimiter({
 *   execute: async () => callAPI(),
 *   maxRequests: 60,
 *   windowMs: 60000
 * });
 *
 * const result = await limiter(); // Direct call
 * console.log(limiter.getRemaining()); // Check remaining
 * await limiter.wait(); // Wait if needed
 * ```
 */
export function defineRateLimiter<TResult = any, TArgs extends any[] = any[]>(
  options: RateLimiterOptions<TResult>
): CallableRateLimiter<TResult, TArgs> {
  const {
    execute: fn,
    maxRequests,
    windowMs,
    strategy,
    refillRate,
    logger,
    onLimitReached,
  } = options;

  const instance = new RateLimiter(fn, {
    maxRequests,
    windowMs,
    strategy,
    refillRate,
    logger,
    onLimitReached,
  });

  // Create callable function (Vercel-style)
  const callable = async (...args: TArgs): Promise<RateLimitResult<TResult>> => {
    return await instance.execute(...args);
  };

  // Attach utility methods
  callable.wait = async (...args: TArgs) => await instance.executeWithWait(...args);
  callable.getRemaining = () => instance.getRemaining();
  callable.reset = () => instance.reset();

  return callable as CallableRateLimiter<TResult, TArgs>;
}

/**
 * @deprecated Use `defineRateLimiter` instead for better alignment with Vercel AI SDK patterns
 * @see defineRateLimiter
 */
export const rateLimiter = defineRateLimiter;
