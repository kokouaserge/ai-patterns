import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memoize } from './memoize';

describe('memoize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should cache function results', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const memoized = memoize({
        execute: fn,
      });

      // First call executes function
      const result1 = await memoized('arg1');
      expect(result1).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call with same args returns cached result
      const result2 = await memoized('arg1');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1); // Still 1

      // Different args execute function again
      const result3 = await memoized('arg2');
      expect(result3).toBe('result');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with multiple arguments', async () => {
      const fn = vi.fn().mockImplementation(async (a: number, b: number) => a + b);

      const memoized = memoize<[number, number], number>({
        execute: fn,
      });

      const result1 = await memoized(1, 2);
      expect(result1).toBe(3);

      const result2 = await memoized(1, 2);
      expect(result2).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);

      const result3 = await memoized(2, 3);
      expect(result3).toBe(5);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('TTL (time-to-live)', () => {
    it('should expire cache after TTL', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const memoized = memoize({
        execute: fn,
        ttl: 1000, // 1 second
      });

      // First call
      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call within TTL
      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(1); // Cached

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      // Third call after TTL should execute again
      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work without TTL (permanent cache)', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const memoized = memoize({
        execute: fn,
      });

      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(1);

      // Advance time significantly
      vi.advanceTimersByTime(1000000);

      // Still cached
      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom key function', () => {
    it('should use custom keyFn for cache key', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const memoized = memoize<[{ id: string; name: string }], string>({
        execute: fn,
        keyFn: (obj) => obj.id, // Only use id for key
      });

      await memoized({ id: '1', name: 'Alice' });
      expect(fn).toHaveBeenCalledTimes(1);

      // Same id, different name - should use cache
      await memoized({ id: '1', name: 'Bob' });
      expect(fn).toHaveBeenCalledTimes(1);

      // Different id - should execute
      await memoized({ id: '2', name: 'Alice' });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache clearing', () => {
    it('should clear cache', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const memoized = memoize({
        execute: fn,
      });

      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(1);

      memoized.clear();

      // After clear, should execute again
      await memoized('arg1');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should not cache errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      const memoized = memoize({
        execute: fn,
      });

      // First call fails
      await expect(memoized('arg1')).rejects.toThrow('Fail');
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call with same args should retry (error not cached)
      const result = await memoized('arg1');
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const memoized = memoize<[string], User>({
        execute: async (id: string) => ({ ...user, id }),
      });

      const result = await memoized('1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test');
    });
  });

  describe('onCacheHit callback', () => {
    it('should invoke onCacheHit when cache is used', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const onCacheHit = vi.fn();

      const memoized = memoize({
        execute: fn,
        onCacheHit,
      });

      await memoized('arg1');
      expect(onCacheHit).not.toHaveBeenCalled();

      await memoized('arg1'); // Cache hit
      expect(onCacheHit).toHaveBeenCalledTimes(1);
    });
  });

  describe('onCacheMiss callback', () => {
    it('should invoke onCacheMiss when cache is not used', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const onCacheMiss = vi.fn();

      const memoized = memoize({
        execute: fn,
        onCacheMiss,
      });

      await memoized('arg1');
      expect(onCacheMiss).toHaveBeenCalledTimes(1);

      await memoized('arg1'); // Cache hit
      expect(onCacheMiss).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
