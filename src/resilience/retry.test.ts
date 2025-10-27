import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry, RetryPredicates } from './retry';
import { BackoffStrategy } from '../types/retry';
import { PatternError, ErrorCode } from '../types/errors';

describe('retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry({
        execute: fn,
        maxAttempts: 3,
      });

      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const result = await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 10,
      });

      expect(result.value).toBe('success');
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBeGreaterThan(0);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retry({
          execute: fn,
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow(PatternError);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw error with correct error code', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await retry({
          execute: fn,
          maxAttempts: 2,
          initialDelay: 10,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(
          ErrorCode.MAX_RETRIES_EXCEEDED
        );
      }
    });
  });

  describe('backoff strategies', () => {
    it('should use constant backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 100,
        backoffStrategy: BackoffStrategy.CONSTANT,
        onRetry,
      });

      // Constant strategy should use same delay (with jitter)
      const delay = onRetry.mock.calls[0][2];
      expect(delay).toBeGreaterThan(70); // 100 - 30%
      expect(delay).toBeLessThan(130); // 100 + 30%
    });

    it('should use linear backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 100,
        backoffStrategy: BackoffStrategy.LINEAR,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);

      // First retry: initialDelay * 1
      const delay1 = onRetry.mock.calls[0][2];
      expect(delay1).toBeGreaterThan(70);
      expect(delay1).toBeLessThan(130);

      // Second retry: initialDelay * 2
      const delay2 = onRetry.mock.calls[1][2];
      expect(delay2).toBeGreaterThan(140);
      expect(delay2).toBeLessThan(260);
    });

    it('should use exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 100,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);

      // First retry: initialDelay * 2^0 = 100
      const delay1 = onRetry.mock.calls[0][2];
      expect(delay1).toBeGreaterThan(70);
      expect(delay1).toBeLessThan(130);

      // Second retry: initialDelay * 2^1 = 200
      const delay2 = onRetry.mock.calls[1][2];
      expect(delay2).toBeGreaterThan(140);
      expect(delay2).toBeLessThan(260);
    });

    it('should respect maxDelay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 100,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        onRetry,
      });

      // Delay should be capped at maxDelay
      const delay = onRetry.mock.calls[0][2];
      expect(delay).toBeLessThanOrEqual(130); // maxDelay + jitter
    });
  });

  describe('shouldRetry callback', () => {
    it('should stop retrying when shouldRetry returns false', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable error'));

      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(
        retry({
          execute: fn,
          maxAttempts: 3,
          shouldRetry,
          initialDelay: 10,
        })
      ).rejects.toThrow(PatternError);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it('should continue retrying when shouldRetry returns true', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Retryable error'))
        .mockResolvedValue('success');

      const shouldRetry = vi.fn().mockReturnValue(true);

      const result = await retry({
        execute: fn,
        maxAttempts: 3,
        shouldRetry,
        initialDelay: 10,
      });

      expect(result.value).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('onRetry callback', () => {
    it('should invoke onRetry callback', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });

    it('should pass correct error and attempt to onRetry', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const onRetry = vi.fn();

      await retry({
        execute: fn,
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
    });
  });

  describe('validation', () => {
    it('should throw error for invalid maxAttempts', async () => {
      await expect(
        retry({
          execute: async () => 'test',
          maxAttempts: 0,
        })
      ).rejects.toThrow(PatternError);
    });

    it('should throw error for negative maxAttempts', async () => {
      await expect(
        retry({
          execute: async () => 'test',
          maxAttempts: -1,
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

      const result = await retry<User>({
        execute: fn,
        maxAttempts: 3,
      });

      expect(result.value).toEqual(user);
      expect(result.value.id).toBe('1');
      expect(result.value.name).toBe('Test');
    });
  });

  describe('RetryPredicates', () => {
    it('should have always predicate', () => {
      const error = new Error('Test');
      expect(RetryPredicates.always()(error, 1)).toBe(true);
    });

    it('should have never predicate', () => {
      const error = new Error('Test');
      expect(RetryPredicates.never()(error, 1)).toBe(false);
    });
  });
});
