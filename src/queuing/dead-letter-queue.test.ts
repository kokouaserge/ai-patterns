import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deadLetterQueue } from './dead-letter-queue';

describe('dead-letter-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should execute successfully without DLQ', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const dlqHandler = vi.fn();

      const result = await deadLetterQueue({
        execute: fn,
        onDeadLetter: dlqHandler,
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(dlqHandler).not.toHaveBeenCalled();
    });

    it('should send to DLQ on failure', async () => {
      const error = new Error('Operation failed');
      const fn = vi.fn().mockRejectedValue(error);
      const dlqHandler = vi.fn().mockResolvedValue(undefined);

      const result = await deadLetterQueue({
        execute: fn,
        onDeadLetter: dlqHandler,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(dlqHandler).toHaveBeenCalledTimes(1);
      expect(dlqHandler).toHaveBeenCalledWith(error, undefined);
    });

    it('should pass message to DLQ handler', async () => {
      const error = new Error('Failed');
      const fn = vi.fn().mockRejectedValue(error);
      const dlqHandler = vi.fn().mockResolvedValue(undefined);
      const message = { id: '123', data: 'test' };

      await deadLetterQueue({
        execute: fn,
        onDeadLetter: dlqHandler,
        message,
      });

      expect(dlqHandler).toHaveBeenCalledWith(error, message);
    });
  });

  describe('max retries', () => {
    it('should retry before sending to DLQ', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const dlqHandler = vi.fn();

      const result = await deadLetterQueue({
        execute: fn,
        maxRetries: 3,
        onDeadLetter: dlqHandler,
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(dlqHandler).not.toHaveBeenCalled();
    });

    it('should send to DLQ after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      const dlqHandler = vi.fn().mockResolvedValue(undefined);

      const result = await deadLetterQueue({
        execute: fn,
        maxRetries: 3,
        onDeadLetter: dlqHandler,
      });

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(dlqHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldRetry predicate', () => {
    it('should skip retries when shouldRetry returns false', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));
      const dlqHandler = vi.fn().mockResolvedValue(undefined);
      const shouldRetry = vi.fn().mockReturnValue(false);

      await deadLetterQueue({
        execute: fn,
        maxRetries: 3,
        shouldRetry,
        onDeadLetter: dlqHandler,
      });

      expect(fn).toHaveBeenCalledTimes(1); // No retries
      expect(dlqHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const result = await deadLetterQueue<User>({
        execute: async () => user,
        onDeadLetter: async () => {},
      });

      expect(result.success).toBe(true);
      expect(result.value).toEqual(user);
      expect(result.value?.id).toBe('1');
    });
  });
});
