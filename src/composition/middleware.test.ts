import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compose } from './compose';
import { withRateLimiter } from './middleware';
import { RateLimitStrategy } from '../types/rate-limiter';

describe('middleware - rate limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('global rate limiting with different functions', () => {
    it('should execute different functions correctly and return their own results', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 10,
          windowMs: 60000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
        }),
      ]);

      // Execute three different functions
      const result1 = await robustApi(
        async () => ({ type: 'user', id: 123, name: 'Alice' }),
        undefined
      );

      const result2 = await robustApi(
        async () => ({ type: 'product', id: 456, name: 'Phone' }),
        undefined
      );

      const result3 = await robustApi(
        async () => ({ type: 'order', id: 789, total: 99.99 }),
        undefined
      );

      // Each function should return its own result, not cached previous results
      expect(result1).toEqual({ type: 'user', id: 123, name: 'Alice' });
      expect(result2).toEqual({ type: 'product', id: 456, name: 'Phone' });
      expect(result3).toEqual({ type: 'order', id: 789, total: 99.99 });

      // Results should be different from each other
      expect(result1.type).toBe('user');
      expect(result2.type).toBe('product');
      expect(result3.type).toBe('order');
    });

    it('should enforce global rate limit across different functions', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 3,
          windowMs: 5000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
        }),
      ]);

      // First 3 requests with different functions should succeed
      await robustApi(async () => ({ type: 'user' }), undefined);
      await robustApi(async () => ({ type: 'product' }), undefined);
      await robustApi(async () => ({ type: 'order' }), undefined);

      // Fourth request should be rate limited
      await expect(
        robustApi(async () => ({ type: 'payment' }), undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should track requests globally regardless of function type', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 5,
          windowMs: 10000,
          strategy: RateLimitStrategy.FIXED_WINDOW,
        }),
      ]);

      // Mix of same and different functions
      await robustApi(async () => ({ call: 1 }), undefined);
      await robustApi(async () => ({ call: 2 }), undefined);
      await robustApi(async () => ({ call: 3 }), undefined);
      await robustApi(async () => ({ call: 4 }), undefined);
      await robustApi(async () => ({ call: 5 }), undefined);

      // Sixth request should be blocked
      await expect(
        robustApi(async () => ({ call: 6 }), undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should pass different input parameters correctly', async () => {
      const robustApi = compose<number, number>([
        withRateLimiter({
          maxRequests: 10,
          windowMs: 60000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
        }),
      ]);

      // Execute same function with different inputs
      const result1 = await robustApi(async (x) => x * 2, 5);
      const result2 = await robustApi(async (x) => x * 2, 10);
      const result3 = await robustApi(async (x) => x * 2, 15);

      // Each should return correct calculated result
      expect(result1).toBe(10);
      expect(result2).toBe(20);
      expect(result3).toBe(30);
    });

    it('should maintain rate limit state across multiple calls', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 2,
          windowMs: 1000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
        }),
      ]);

      // First two calls should succeed
      const result1 = await robustApi(async () => 'first', undefined);
      const result2 = await robustApi(async () => 'second', undefined);

      expect(result1).toBe('first');
      expect(result2).toBe('second');

      // Third call should fail
      await expect(
        robustApi(async () => 'third', undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should call onLimitReached callback when rate limit is exceeded', async () => {
      const onLimitReached = vi.fn();

      const robustApi = compose([
        withRateLimiter({
          maxRequests: 1,
          windowMs: 5000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
          onLimitReached,
        }),
      ]);

      // First call succeeds
      await robustApi(async () => 'success', undefined);

      // Second call should trigger callback
      try {
        await robustApi(async () => 'fail', undefined);
      } catch (error) {
        // Expected to throw
      }

      expect(onLimitReached).toHaveBeenCalledOnce();
      expect(onLimitReached).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should count failed executions against rate limit', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 2,
          windowMs: 5000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
        }),
      ]);

      // First call succeeds
      await robustApi(async () => 'success', undefined);

      // Second call fails during execution
      try {
        await robustApi(async () => {
          throw new Error('Execution failed');
        }, undefined);
      } catch (error) {
        expect((error as Error).message).toBe('Execution failed');
      }

      // Third call should be rate limited (second call counted even though it failed)
      await expect(
        robustApi(async () => 'third', undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });
  });

  describe('rate limiter strategies', () => {
    it('should work with TOKEN_BUCKET strategy', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 3,
          windowMs: 1000,
          strategy: RateLimitStrategy.TOKEN_BUCKET,
          refillRate: 1, // 1 token per second
        }),
      ]);

      // Use 3 tokens
      await robustApi(async () => 'call1', undefined);
      await robustApi(async () => 'call2', undefined);
      await robustApi(async () => 'call3', undefined);

      // Fourth should be rate limited
      await expect(
        robustApi(async () => 'call4', undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should work with FIXED_WINDOW strategy', async () => {
      const robustApi = compose([
        withRateLimiter({
          maxRequests: 2,
          windowMs: 1000,
          strategy: RateLimitStrategy.FIXED_WINDOW,
        }),
      ]);

      await robustApi(async () => 'call1', undefined);
      await robustApi(async () => 'call2', undefined);

      // Third should be rate limited
      await expect(
        robustApi(async () => 'call3', undefined)
      ).rejects.toThrow(/Rate limit exceeded/);
    });
  });
});
