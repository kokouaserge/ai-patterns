import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineDebounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should delay execution until quiet period', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const debounced = defineDebounce({
        execute: fn,
        delayMs: 1000,
      });

      // Multiple rapid calls
      const p1 = debounced('call1');
      const p2 = debounced('call2');
      const p3 = debounced('call3');

      // Function should not have been called yet
      expect(fn).not.toHaveBeenCalled();

      // Advance time
      vi.advanceTimersByTime(1000);

      // Only the last call should execute
      await p3;
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call3');
    });

    it('should restart delay on new call', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const debounced = defineDebounce({
        execute: fn,
        delayMs: 1000,
      });

      debounced('call1');
      vi.advanceTimersByTime(500);

      // New call should restart delay
      debounced('call2');
      vi.advanceTimersByTime(500); // Total 1000ms, but only 500ms since last call

      // Should not have executed yet
      expect(fn).not.toHaveBeenCalled();

      // Advance remaining time
      vi.advanceTimersByTime(500);

      // Now should execute with last call
      await vi.runAllTimersAsync();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call2');
    });
  });

  describe('leading edge', () => {
    it('should execute immediately with leading: true', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const debounced = defineDebounce({
        execute: fn,
        delayMs: 1000,
        leading: true,
      });

      debounced('call1');

      // Should execute immediately
      await vi.runAllTimersAsync();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call1');
    });
  });

  describe('cancel', () => {
    it('should cancel pending execution', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const debounced = defineDebounce({
        execute: fn,
        delayMs: 1000,
      });

      debounced('call1');

      // Cancel before execution
      debounced.cancel();

      // Advance time
      vi.advanceTimersByTime(1000);

      // Should not have executed
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should execute immediately', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const debounced = defineDebounce({
        execute: fn,
        delayMs: 1000,
      });

      debounced('call1');

      // Flush immediately
      debounced.flush();

      // Should execute without waiting
      await vi.runAllTimersAsync();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call1');
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const debounced = defineDebounce<User, [string]>({
        execute: async (id: string) => ({ ...user, id }),
        delayMs: 1000,
      });

      const promise = debounced('123');
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
    });
  });
});
