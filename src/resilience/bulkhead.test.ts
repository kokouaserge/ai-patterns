import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineBulkhead } from './bulkhead';
import { PatternError, ErrorCode } from '../types/errors';

describe('bulkhead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should execute within concurrency limit', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const bulkhead = defineBulkhead({
        execute: fn,
        maxConcurrent: 3,
      });

      const promises = [bulkhead(), bulkhead(), bulkhead()];

      const results = await Promise.all(promises);

      expect(results).toEqual(['result', 'result', 'result']);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should queue requests beyond limit', async () => {
      let activeCount = 0;
      let maxActiveCount = 0;

      const fn = vi.fn().mockImplementation(async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);

        await new Promise((resolve) => setTimeout(resolve, 10));

        activeCount--;
        return 'result';
      });

      const bulkhead = defineBulkhead({
        execute: fn,
        maxConcurrent: 2,
      });

      // Start 5 concurrent requests
      const promises = [
        bulkhead(),
        bulkhead(),
        bulkhead(),
        bulkhead(),
        bulkhead(),
      ];

      await Promise.all(promises);

      // Should never exceed max concurrent
      expect(maxActiveCount).toBeLessThanOrEqual(2);
      expect(fn).toHaveBeenCalledTimes(5);
    });
  });

  describe('queue limit', () => {
    it('should reject requests when queue is full', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 1000))
      );

      const bulkhead = defineBulkhead({
        execute: fn,
        maxConcurrent: 1,
        maxQueued: 2,
      });

      // First request executes
      const p1 = bulkhead();

      // Second and third queue
      const p2 = bulkhead();
      const p3 = bulkhead();

      // Fourth should be rejected
      await expect(bulkhead()).rejects.toThrow(PatternError);
      await expect(bulkhead()).rejects.toThrow(ErrorCode.QUEUE_FULL);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
      );

      const bulkhead = defineBulkhead({
        execute: fn,
        maxConcurrent: 2,
      });

      // Start 4 requests
      const promises = [bulkhead(), bulkhead(), bulkhead(), bulkhead()];

      // Check stats while running
      const stats = bulkhead.getStats();
      expect(stats.activeCount).toBeGreaterThan(0);
      expect(stats.queuedCount).toBeGreaterThan(0);

      await Promise.all(promises);

      // After completion
      const finalStats = bulkhead.getStats();
      expect(finalStats.activeCount).toBe(0);
      expect(finalStats.queuedCount).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const bulkhead = defineBulkhead<User>({
        execute: async () => user,
        maxConcurrent: 3,
      });

      const result = await bulkhead();

      expect(result).toEqual(user);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test');
    });
  });

  describe('validation', () => {
    it('should throw error for invalid maxConcurrent', () => {
      expect(() =>
        defineBulkhead({
          execute: async () => 'test',
          maxConcurrent: 0,
        })
      ).toThrow(PatternError);
    });
  });
});
