import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  timeout,
  createTimeoutSignal,
  combineSignals,
  TimeoutDurations,
} from './timeout';
import { PatternError, ErrorCode } from '../types/errors';

describe('timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should complete successfully before timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await timeout({
        execute: fn,
        timeoutMs: 1000,
      });

      expect(result.value).toBe('success');
      expect(result.timedOut).toBe(false);
      expect(result.duration).toBeLessThan(1000);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should timeout for slow operations', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too slow'), 1000);
          })
      );

      await expect(
        timeout({
          execute: fn,
          timeoutMs: 50,
        })
      ).rejects.toThrow(PatternError);
    });

    it('should throw TimeoutError with correct code', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too slow'), 1000);
          })
      );

      try {
        await timeout({
          execute: fn,
          timeoutMs: 50,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.TIMEOUT);
        expect((error as any).timedOut).toBe(true);
      }
    });

    it('should include duration and timeout in error metadata', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too slow'), 1000);
          })
      );

      try {
        await timeout({
          execute: fn,
          timeoutMs: 50,
        });
      } catch (error) {
        expect((error as PatternError).metadata).toBeDefined();
        expect((error as PatternError).metadata?.timeoutMs).toBe(50);
        expect((error as PatternError).metadata?.duration).toBeGreaterThan(0);
      }
    });
  });

  describe('custom error message', () => {
    it('should use custom timeout message', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too slow'), 1000);
          })
      );

      const customMessage = 'Custom timeout message';

      try {
        await timeout({
          execute: fn,
          timeoutMs: 50,
          message: customMessage,
        });
      } catch (error) {
        expect((error as Error).message).toBe(customMessage);
      }
    });
  });

  describe('onTimeout callback', () => {
    it('should invoke onTimeout callback', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('too slow'), 1000);
          })
      );

      const onTimeout = vi.fn();

      try {
        await timeout({
          execute: fn,
          timeoutMs: 50,
          onTimeout,
        });
      } catch {
        // Expected to throw
      }

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should not invoke onTimeout for successful operations', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const onTimeout = vi.fn();

      await timeout({
        execute: fn,
        timeoutMs: 1000,
        onTimeout,
      });

      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  describe('external signal', () => {
    it('should abort when external signal is aborted', async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('never'), 1000);
          })
      );

      // Abort signal after 50ms
      setTimeout(() => controller.abort(), 50);

      await expect(
        timeout({
          execute: fn,
          timeoutMs: 1000,
          signal: controller.signal,
        })
      ).rejects.toThrow(PatternError);
    });

    it('should throw error if signal already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        timeout({
          execute: async () => 'test',
          timeoutMs: 1000,
          signal: controller.signal,
        })
      ).rejects.toThrow(PatternError);
    });
  });

  describe('validation', () => {
    it('should throw error for invalid timeout', async () => {
      await expect(
        timeout({
          execute: async () => 'test',
          timeoutMs: 0,
        })
      ).rejects.toThrow(PatternError);
    });

    it('should throw error for negative timeout', async () => {
      await expect(
        timeout({
          execute: async () => 'test',
          timeoutMs: -1,
        })
      ).rejects.toThrow(PatternError);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };
      const fn = vi.fn().mockResolvedValue(user);

      const result = await timeout<User>({
        execute: fn,
        timeoutMs: 1000,
      });

      expect(result.value).toEqual(user);
      expect(result.value.id).toBe('1');
      expect(result.value.name).toBe('Test');
    });
  });

  describe('TimeoutDurations', () => {
    it('should have predefined duration constants', () => {
      expect(TimeoutDurations.SHORT).toBe(5000);
      expect(TimeoutDurations.MEDIUM).toBe(15000);
      expect(TimeoutDurations.LONG).toBe(30000);
    });
  });
});

describe('createTimeoutSignal', () => {
  it('should create signal that aborts after delay', async () => {
    const signal = createTimeoutSignal(50);

    expect(signal.aborted).toBe(false);

    await new Promise((resolve) => {
      signal.addEventListener('abort', resolve);
    });

    expect(signal.aborted).toBe(true);
  });
});

describe('combineSignals', () => {
  it('should abort when any signal aborts', async () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const combined = combineSignals(controller1.signal, controller2.signal);

    expect(combined.aborted).toBe(false);

    controller1.abort();

    expect(combined.aborted).toBe(true);
  });

  it('should be aborted if any input signal is already aborted', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    controller1.abort();

    const combined = combineSignals(controller1.signal, controller2.signal);

    expect(combined.aborted).toBe(true);
  });

  it('should handle multiple signals', async () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const controller3 = new AbortController();

    const combined = combineSignals(
      controller1.signal,
      controller2.signal,
      controller3.signal
    );

    expect(combined.aborted).toBe(false);

    controller3.abort();

    expect(combined.aborted).toBe(true);
  });
});
