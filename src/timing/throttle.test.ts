import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineThrottle } from './throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should limit execution frequency', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const throttled = defineThrottle({
        execute: fn,
        intervalMs: 1000,
      });

      // First call executes immediately
      await throttled('call1');
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call is throttled
      throttled('call2');
      expect(fn).toHaveBeenCalledTimes(1); // Still 1

      // Advance time
      vi.advanceTimersByTime(1000);

      // Now should execute
      await vi.runAllTimersAsync();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should execute with latest arguments', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const throttled = defineThrottle({
        execute: fn,
        intervalMs: 1000,
      });

      await throttled('call1');
      throttled('call2');
      throttled('call3'); // This should be executed after interval

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, 'call1');
      expect(fn).toHaveBeenNthCalledWith(2, 'call3'); // Latest args
    });
  });

  describe('leading and trailing', () => {
    it('should execute on leading edge only with trailing: false', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const throttled = defineThrottle({
        execute: fn,
        intervalMs: 1000,
        leading: true,
        trailing: false,
      });

      await throttled('call1');
      throttled('call2');

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should still be 1 (no trailing call)
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute on trailing edge only with leading: false', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const throttled = defineThrottle({
        execute: fn,
        intervalMs: 1000,
        leading: false,
        trailing: true,
      });

      throttled('call1');
      throttled('call2');

      // Should not execute immediately
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Now should execute
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call2');
    });
  });

  describe('cancel', () => {
    it('should cancel pending execution', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const throttled = defineThrottle({
        execute: fn,
        intervalMs: 1000,
      });

      await throttled('call1');
      throttled('call2');

      // Cancel before trailing execution
      throttled.cancel();

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Should only have first call
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const throttled = defineThrottle<User, [string]>({
        execute: async (id: string) => ({ ...user, id }),
        intervalMs: 1000,
      });

      const result = await throttled('123');

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
    });
  });
});
