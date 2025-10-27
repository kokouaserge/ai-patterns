import { describe, it, expect, vi, beforeEach } from 'vitest';
import { idempotent } from './idempotency';

describe('idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should execute once for same key', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result1 = await idempotent({
        execute: fn,
        key: 'operation-1',
      });

      const result2 = await idempotent({
        execute: fn,
        key: 'operation-1',
      });

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1); // Only once
    });

    it('should execute separately for different keys', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result1 = await idempotent({
        execute: fn,
        key: 'operation-1',
      });

      const result2 = await idempotent({
        execute: fn,
        key: 'operation-2',
      });

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(2); // Once per key
    });
  });

  describe('TTL (time-to-live)', () => {
    it('should expire after TTL', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await idempotent({
        execute: fn,
        key: 'operation-1',
        ttl: 1000,
      });

      expect(fn).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      await idempotent({
        execute: fn,
        key: 'operation-1',
        ttl: 1000,
      });

      expect(fn).toHaveBeenCalledTimes(2); // Executed again
    });
  });

  describe('onCacheHit callback', () => {
    it('should invoke onCacheHit for duplicate operations', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const onCacheHit = vi.fn();

      await idempotent({
        execute: fn,
        key: 'operation-1',
        onCacheHit,
      });

      expect(onCacheHit).not.toHaveBeenCalled();

      await idempotent({
        execute: fn,
        key: 'operation-1',
        onCacheHit,
      });

      expect(onCacheHit).toHaveBeenCalledTimes(1);
      expect(onCacheHit).toHaveBeenCalledWith('operation-1');
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests with same key', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `result-${callCount}`;
      });

      // Start two concurrent requests with same key
      const [result1, result2] = await Promise.all([
        idempotent({
          execute: fn,
          key: 'operation-1',
        }),
        idempotent({
          execute: fn,
          key: 'operation-1',
        }),
      ]);

      // Both should get the same result
      expect(result1).toBe(result2);
      // Function should only execute once
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should not cache errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      // First call fails
      await expect(
        idempotent({
          execute: fn,
          key: 'operation-1',
        })
      ).rejects.toThrow('Fail');

      // Second call should retry (error not cached)
      const result = await idempotent({
        execute: fn,
        key: 'operation-1',
      });

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

      const result = await idempotent<User>({
        execute: async () => user,
        key: 'get-user-1',
      });

      expect(result).toEqual(user);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test');
    });
  });
});
