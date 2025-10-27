import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fanOut } from './fan-out';

describe('fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn().mockImplementation(async (n: number) => n * 2);

      const result = await fanOut({
        items,
        execute: fn,
      });

      expect(result.results).toEqual([2, 4, 6, 8, 10]);
      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toEqual([]);
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should handle empty array', async () => {
      const fn = vi.fn();

      const result = await fanOut({
        items: [],
        execute: fn,
      });

      expect(result.results).toEqual([]);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      let activeCount = 0;
      let maxActiveCount = 0;

      const fn = vi.fn().mockImplementation(async (n: number) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);

        await new Promise((resolve) => setTimeout(resolve, 10));

        activeCount--;
        return n * 2;
      });

      await fanOut({
        items,
        execute: fn,
        concurrency: 2,
      });

      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should continue processing on errors', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn().mockImplementation(async (n: number) => {
        if (n === 2 || n === 4) {
          throw new Error(`Error with ${n}`);
        }
        return n * 2;
      });

      const result = await fanOut({
        items,
        execute: fn,
        continueOnError: true,
      });

      expect(result.results).toEqual([2, 6, 10]); // Only successful items
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should stop on first error when continueOnError is false', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn().mockImplementation(async (n: number) => {
        if (n === 2) {
          throw new Error('Error with 2');
        }
        return n * 2;
      });

      await expect(
        fanOut({
          items,
          execute: fn,
          continueOnError: false,
        })
      ).rejects.toThrow('Error with 2');
    });
  });

  describe('progress callback', () => {
    it('should invoke onProgress callback', async () => {
      const items = [1, 2, 3];
      const fn = vi.fn().mockImplementation(async (n: number) => n * 2);
      const onProgress = vi.fn();

      await fanOut({
        items,
        execute: fn,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
      expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
    });
  });

  describe('item error callback', () => {
    it('should invoke onItemError for failed items', async () => {
      const items = [1, 2, 3];
      const fn = vi.fn().mockImplementation(async (n: number) => {
        if (n === 2) {
          throw new Error('Error with 2');
        }
        return n * 2;
      });
      const onItemError = vi.fn();

      await fanOut({
        items,
        execute: fn,
        continueOnError: true,
        onItemError,
      });

      expect(onItemError).toHaveBeenCalledTimes(1);
      expect(onItemError).toHaveBeenCalledWith(2, expect.any(Error), 1);
    });
  });

  describe('type safety', () => {
    it('should preserve input and output types', async () => {
      interface User {
        id: string;
        name: string;
      }

      const users: User[] = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ];

      const result = await fanOut<User, string>({
        items: users,
        execute: async (user) => `Hello, ${user.name}!`,
      });

      expect(result.results).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });
  });
});
