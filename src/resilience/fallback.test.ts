import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fallback } from './fallback';

describe('fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should succeed with primary function', async () => {
      const primary = vi.fn().mockResolvedValue('primary success');
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');

      const result = await fallback({
        execute: primary,
        fallback: fallbackFn,
      });

      expect(result.value).toBe('primary success');
      expect(result.succeededAt).toBe(0);
      expect(result.attempts).toBe(1);
      expect(result.errors).toEqual([]);
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallbackFn).not.toHaveBeenCalled();
    });

    it('should use fallback when primary fails', async () => {
      const primaryError = new Error('Primary failed');
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');

      const result = await fallback({
        execute: primary,
        fallback: fallbackFn,
      });

      expect(result.value).toBe('fallback success');
      expect(result.succeededAt).toBe(1);
      expect(result.attempts).toBe(2);
      expect(result.errors).toEqual([primaryError]);
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });

    it('should try multiple fallbacks in order', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallback1 = vi.fn().mockRejectedValue(new Error('Fallback 1 failed'));
      const fallback2 = vi.fn().mockResolvedValue('fallback 2 success');
      const fallback3 = vi.fn().mockResolvedValue('fallback 3 success');

      const result = await fallback({
        execute: primary,
        fallback: [fallback1, fallback2, fallback3],
      });

      expect(result.value).toBe('fallback 2 success');
      expect(result.succeededAt).toBe(2);
      expect(result.attempts).toBe(3);
      expect(result.errors).toHaveLength(2);
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback1).toHaveBeenCalledTimes(1);
      expect(fallback2).toHaveBeenCalledTimes(1);
      expect(fallback3).not.toHaveBeenCalled();
    });

    it('should throw error when all functions fail', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallback1 = vi.fn().mockRejectedValue(new Error('Fallback 1 failed'));
      const fallback2 = vi.fn().mockRejectedValue(new Error('Fallback 2 failed'));

      await expect(
        fallback({
          execute: primary,
          fallback: [fallback1, fallback2],
        })
      ).rejects.toThrow('Fallback 2 failed');

      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback1).toHaveBeenCalledTimes(1);
      expect(fallback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldFallback predicate', () => {
    it('should not use fallback when shouldFallback returns false', async () => {
      const primaryError = new Error('Non-fallback error');
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');
      const shouldFallback = vi.fn().mockReturnValue(false);

      await expect(
        fallback({
          execute: primary,
          fallback: fallbackFn,
          shouldFallback,
        })
      ).rejects.toThrow('Non-fallback error');

      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallbackFn).not.toHaveBeenCalled();
      expect(shouldFallback).toHaveBeenCalledWith(primaryError);
    });

    it('should use fallback when shouldFallback returns true', async () => {
      const primaryError = new Error('Fallback-able error');
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');
      const shouldFallback = vi.fn().mockReturnValue(true);

      const result = await fallback({
        execute: primary,
        fallback: fallbackFn,
        shouldFallback,
      });

      expect(result.value).toBe('fallback success');
      expect(shouldFallback).toHaveBeenCalledWith(primaryError);
    });
  });

  describe('callbacks', () => {
    it('should invoke onPrimaryFailure when primary fails', async () => {
      const primaryError = new Error('Primary failed');
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');
      const onPrimaryFailure = vi.fn();

      await fallback({
        execute: primary,
        fallback: fallbackFn,
        onPrimaryFailure,
      });

      expect(onPrimaryFailure).toHaveBeenCalledTimes(1);
      expect(onPrimaryFailure).toHaveBeenCalledWith(primaryError);
    });

    it('should not invoke onPrimaryFailure when primary succeeds', async () => {
      const primary = vi.fn().mockResolvedValue('primary success');
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');
      const onPrimaryFailure = vi.fn();

      await fallback({
        execute: primary,
        fallback: fallbackFn,
        onPrimaryFailure,
      });

      expect(onPrimaryFailure).not.toHaveBeenCalled();
    });

    it('should invoke onFallbackUsed when fallback is used', async () => {
      const primaryError = new Error('Primary failed');
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallbackFn = vi.fn().mockResolvedValue('fallback success');
      const onFallbackUsed = vi.fn();

      await fallback({
        execute: primary,
        fallback: fallbackFn,
        onFallbackUsed,
      });

      expect(onFallbackUsed).toHaveBeenCalledTimes(1);
      expect(onFallbackUsed).toHaveBeenCalledWith(0, primaryError);
    });

    it('should invoke onAllFailed when all functions fail', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackFn = vi.fn().mockRejectedValue(new Error('Fallback failed'));
      const onAllFailed = vi.fn();

      await expect(
        fallback({
          execute: primary,
          fallback: fallbackFn,
          onAllFailed,
        })
      ).rejects.toThrow();

      expect(onAllFailed).toHaveBeenCalledTimes(1);
      expect(onAllFailed).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };
      const primary = vi.fn().mockResolvedValue(user);
      const fallbackFn = vi.fn().mockResolvedValue(user);

      const result = await fallback<User>({
        execute: primary,
        fallback: fallbackFn,
      });

      expect(result.value).toEqual(user);
      expect(result.value.id).toBe('1');
      expect(result.value.name).toBe('Test');
    });
  });

  describe('error handling', () => {
    it('should collect all errors', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const error3 = new Error('Error 3');

      const primary = vi.fn().mockRejectedValue(error1);
      const fallback1 = vi.fn().mockRejectedValue(error2);
      const fallback2 = vi.fn().mockRejectedValue(error3);

      try {
        await fallback({
          execute: primary,
          fallback: [fallback1, fallback2],
        });
      } catch (error) {
        // Should throw last error
        expect(error).toBe(error3);
      }
    });

    it('should handle non-Error rejections', async () => {
      const primary = vi.fn().mockRejectedValue('string error');
      const fallbackFn = vi.fn().mockResolvedValue('success');

      const result = await fallback({
        execute: primary,
        fallback: fallbackFn,
      });

      expect(result.value).toBe('success');
      expect(result.errors[0]).toBeInstanceOf(Error);
    });
  });
});
