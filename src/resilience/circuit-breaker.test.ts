import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineCircuitBreaker } from './circuit-breaker';
import { CircuitState } from '../types/circuit-breaker';
import { PatternError, ErrorCode } from '../types/errors';

describe('circuit-breaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should execute successfully in closed state', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 3,
      });

      const result = await breaker();

      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 3,
        openDuration: 1000,
      });

      // First 3 failures should open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker()).rejects.toThrow('Service unavailable');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Next call should fail immediately without executing
      await expect(breaker()).rejects.toThrow(PatternError);
      expect(fn).toHaveBeenCalledTimes(3); // Not 4
    });

    it('should transition to half-open after timeout', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValue('success');

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 3,
        openDuration: 1000,
      });

      // Trigger circuit open
      for (let i = 0; i < 3; i++) {
        await expect(breaker()).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past openDuration
      vi.advanceTimersByTime(1000);

      // Next call should transition to half-open and succeed
      const result = await breaker();
      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on half-open failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Half-open fail'));

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 3,
        openDuration: 1000,
      });

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker()).rejects.toThrow();
      }

      // Advance time to half-open
      vi.advanceTimersByTime(1000);

      // Half-open failure should reopen
      await expect(breaker()).rejects.toThrow('Half-open fail');
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('state transitions', () => {
    it('should invoke onStateChange callback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));
      const onStateChange = vi.fn();

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 2,
        onStateChange,
      });

      // Trigger state change to OPEN
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();

      expect(onStateChange).toHaveBeenCalledWith(
        CircuitState.CLOSED,
        CircuitState.OPEN
      );
    });

    it('should invoke onOpen callback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));
      const onOpen = vi.fn();

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 2,
        onOpen,
      });

      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should invoke onClose callback', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const onClose = vi.fn();

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 2,
        openDuration: 1000,
        onClose,
      });

      // Open circuit
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();

      // Advance time and succeed
      vi.advanceTimersByTime(1000);
      await breaker();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const fn = vi
        .fn()
        .mockResolvedValueOnce('success 1')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success 2');

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 5,
      });

      await breaker();
      await expect(breaker()).rejects.toThrow();
      await breaker();

      const stats = breaker.getStats();

      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.totalCalls).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset circuit state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 2,
      });

      // Open circuit
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  describe('shouldCountFailure', () => {
    it('should not count errors when shouldCountFailure returns false', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Ignored error'));

      const breaker = defineCircuitBreaker({
        execute: fn,
        failureThreshold: 2,
        shouldCountFailure: () => false,
      });

      // These failures should not count
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();

      // Circuit should still be closed
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should preserve return type', async () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: '1', name: 'Test' };

      const breaker = defineCircuitBreaker<User>({
        execute: async () => user,
        failureThreshold: 3,
      });

      const result = await breaker();

      expect(result).toEqual(user);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Test');
    });

    it('should handle arguments', async () => {
      const fn = vi.fn().mockImplementation(async (a: number, b: number) => a + b);

      const breaker = defineCircuitBreaker<number, [number, number]>({
        execute: fn,
        failureThreshold: 3,
      });

      const result = await breaker(5, 3);

      expect(result).toBe(8);
      expect(fn).toHaveBeenCalledWith(5, 3);
    });
  });

  describe('validation', () => {
    it('should throw error for invalid failureThreshold', () => {
      expect(() =>
        defineCircuitBreaker({
          execute: async () => 'test',
          failureThreshold: 0,
        })
      ).toThrow(PatternError);
    });
  });
});
