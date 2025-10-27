import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineRateLimiter } from './rate-limiter';
import { RateLimitStrategy } from '../types/rate-limiter';
import { PatternError, ErrorCode } from '../types/errors';

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should allow requests within limit', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 3,
        windowMs: 1000,
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await limiter();
        expect(result.allowed).toBe(true);
        expect(result.value).toBe('success');
      }

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should reject requests over limit', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 2,
        windowMs: 1000,
      });

      // First 2 succeed
      await limiter();
      await limiter();

      // Third should be rate limited
      const result = await limiter();
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should reset after window expires (fixed window)', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 2,
        windowMs: 1000,
        strategy: RateLimitStrategy.FIXED_WINDOW,
      });

      // Use up limit
      await limiter();
      await limiter();

      // Advance time past window
      vi.advanceTimersByTime(1000);

      // Should allow again
      const result = await limiter();
      expect(result.allowed).toBe(true);
    });
  });

  describe('sliding window strategy', () => {
    it('should allow requests as old requests expire', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 2,
        windowMs: 1000,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
      });

      // Use up limit
      await limiter();
      vi.advanceTimersByTime(500);
      await limiter();

      // Third request is blocked
      let result = await limiter();
      expect(result.allowed).toBe(false);

      // Advance 600ms more (first request is now 1100ms old, outside window)
      vi.advanceTimersByTime(600);

      // Should allow new request
      result = await limiter();
      expect(result.allowed).toBe(true);
    });
  });

  describe('token bucket strategy', () => {
    it('should refill tokens over time', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 2,
        windowMs: 1000,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        refillRate: 1, // 1 token per second
      });

      // Use up tokens
      await limiter();
      await limiter();

      // Third is blocked
      let result = await limiter();
      expect(result.allowed).toBe(false);

      // Advance time to refill 1 token
      vi.advanceTimersByTime(1000);

      // Should allow again
      result = await limiter();
      expect(result.allowed).toBe(true);
    });
  });

  describe('wait method', () => {
    it('should wait and retry when limit reached', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 1,
        windowMs: 1000,
        strategy: RateLimitStrategy.FIXED_WINDOW,
      });

      // First request succeeds
      await limiter();

      // Second request should wait
      const waitPromise = limiter.wait();

      // Advance time
      vi.advanceTimersByTime(1000);

      const result = await waitPromise;
      expect(result.allowed).toBe(true);
      expect(result.value).toBe('success');
    });
  });

  describe('getRemaining', () => {
    it('should return correct remaining requests', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 3,
        windowMs: 1000,
      });

      expect(limiter.getRemaining()).toBe(3);

      await limiter();
      expect(limiter.getRemaining()).toBe(2);

      await limiter();
      expect(limiter.getRemaining()).toBe(1);

      await limiter();
      expect(limiter.getRemaining()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset rate limiter state', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 2,
        windowMs: 1000,
      });

      // Use up limit
      await limiter();
      await limiter();

      expect(limiter.getRemaining()).toBe(0);

      // Reset
      limiter.reset();

      expect(limiter.getRemaining()).toBe(2);
    });
  });

  describe('onLimitReached callback', () => {
    it('should invoke callback when limit reached', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const onLimitReached = vi.fn();

      const limiter = defineRateLimiter({
        execute: fn,
        maxRequests: 1,
        windowMs: 1000,
        onLimitReached,
      });

      // First succeeds
      await limiter();

      // Second triggers callback
      await limiter();

      expect(onLimitReached).toHaveBeenCalledTimes(1);
      expect(onLimitReached).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const limiter = defineRateLimiter<User>({
        execute: async () => user,
        maxRequests: 3,
        windowMs: 1000,
      });

      const result = await limiter();

      expect(result.value).toEqual(user);
      expect(result.value?.id).toBe('1');
      expect(result.value?.name).toBe('Test');
    });
  });

  describe('validation', () => {
    it('should throw error for invalid maxRequests', () => {
      expect(() =>
        defineRateLimiter({
          execute: async () => 'test',
          maxRequests: 0,
          windowMs: 1000,
        })
      ).toThrow(PatternError);
    });

    it('should throw error for invalid windowMs', () => {
      expect(() =>
        defineRateLimiter({
          execute: async () => 'test',
          maxRequests: 5,
          windowMs: 0,
        })
      ).toThrow(PatternError);
    });
  });
});
