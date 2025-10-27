/**
 * Circuit Breaker Pattern - Protect against failing external services
 */

import { AsyncFunction, Logger, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerStats,
} from "../types/circuit-breaker";

/**
 * Internal options (without execute field)
 */
interface CircuitBreakerInternalOptions {
  failureThreshold?: number;
  openDuration?: number;
  halfOpenMaxAttempts?: number;
  timeout?: number;
  shouldCountFailure?: (error: Error) => boolean;
  logger?: Logger;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

/**
 * Circuit Breaker - Protects application from failing services
 */
export class CircuitBreaker<TResult = any, TArgs extends any[] = any[]> {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalCalls = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private halfOpenAttempts = 0;
  private nextAttemptTime = 0;

  private readonly failureThreshold: number;
  private readonly openDuration: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly timeout: number;
  private readonly shouldCountFailure: (error: Error) => boolean;
  private readonly logger: Logger;
  private readonly onStateChange?: (
    oldState: CircuitState,
    newState: CircuitState
  ) => void;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;
  private readonly onHalfOpen?: () => void;

  constructor(
    private readonly fn: AsyncFunction<TResult, TArgs>,
    options: CircuitBreakerInternalOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.openDuration = options.openDuration ?? 60000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
    this.timeout = options.timeout ?? 30000;
    this.shouldCountFailure = options.shouldCountFailure ?? (() => true);
    this.logger = options.logger ?? defaultLogger;
    this.onStateChange = options.onStateChange;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onHalfOpen = options.onHalfOpen;

    // Validation
    if (this.failureThreshold < 1) {
      throw new PatternError(
        `failureThreshold must be >= 1, received: ${this.failureThreshold}`,
        ErrorCode.CIRCUIT_INVALID_CONFIG
      );
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(...args: TArgs): Promise<TResult> {
    this.totalCalls++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if we can transition to half-open
      if (Date.now() >= this.nextAttemptTime) {
        this.changeState(CircuitState.HALF_OPEN);
      } else {
        const retryInSeconds = Math.ceil(
          (this.nextAttemptTime - Date.now()) / 1000
        );

        throw new PatternError(
          `Circuit is open. Retry in ${retryInSeconds}s`,
          ErrorCode.CIRCUIT_OPEN,
          undefined,
          {
            state: this.state,
            retryInSeconds,
            nextAttemptTime: this.nextAttemptTime,
          }
        );
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(args);
      this.onSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onFailure(err);
      throw err;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout(args: TArgs): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new PatternError(
            `Timeout after ${this.timeout}ms`,
            ErrorCode.TIMEOUT,
            undefined,
            { timeout: this.timeout }
          )
        );
      }, this.timeout);

      this.fn(...args)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;

      // If enough successful attempts, close circuit
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.logger.info("Circuit closed after successful half-open tests");
        this.changeState(CircuitState.CLOSED);
        this.consecutiveFailures = 0;
        this.halfOpenAttempts = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset consecutive failure count on success
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();

    // Check if error should count
    if (!this.shouldCountFailure(error)) {
      this.logger.debug("Failure ignored", { error: error.message });
      return;
    }

    this.consecutiveFailures++;
    this.totalFailures++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open reopens circuit
      this.logger.warn("Failure in half-open, reopening circuit");
      this.changeState(CircuitState.OPEN);
      this.halfOpenAttempts = 0;
      this.nextAttemptTime = Date.now() + this.openDuration;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold reached
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.logger.warn(
          `Failure threshold reached (${this.consecutiveFailures}/${this.failureThreshold}), opening circuit`
        );
        this.changeState(CircuitState.OPEN);
        this.nextAttemptTime = Date.now() + this.openDuration;
      }
    }
  }

  /**
   * Change circuit state
   */
  private changeState(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    this.logger.info(`Circuit: ${oldState} → ${newState}`);

    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    switch (newState) {
      case CircuitState.OPEN:
        if (this.onOpen) this.onOpen();
        break;
      case CircuitState.CLOSED:
        if (this.onClose) this.onClose();
        break;
      case CircuitState.HALF_OPEN:
        if (this.onHalfOpen) this.onHalfOpen();
        break;
    }
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.totalFailures,
      successCount: this.totalSuccesses,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Reset circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.halfOpenAttempts = 0;
    this.nextAttemptTime = 0;
    this.logger.info("Circuit reset");
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Callable circuit breaker type (Vercel-style)
 */
export interface CallableCircuitBreaker<TResult = any, TArgs extends any[] = any[]> {
  (...args: TArgs): Promise<TResult>;
  getState(): CircuitState;
  getStats(): CircuitBreakerStats;
  reset(): void;
}

/**
 * Define a circuit breaker with Vercel-style callable API
 *
 * @example
 * ```typescript
 * const breaker = defineCircuitBreaker({
 *   execute: async () => callAPI(),
 *   failureThreshold: 5,
 *   openDuration: 60000
 * });
 *
 * const result = await breaker(); // Direct call
 * console.log(breaker.getState()); // Check state
 * ```
 */
export function defineCircuitBreaker<TResult = any, TArgs extends any[] = any[]>(
  options: CircuitBreakerOptions<TResult>
): CallableCircuitBreaker<TResult, TArgs> {
  const {
    execute: fn,
    failureThreshold,
    openDuration,
    halfOpenMaxAttempts,
    timeout,
    shouldCountFailure,
    logger,
    onStateChange,
    onOpen,
    onClose,
    onHalfOpen,
  } = options;

  const instance = new CircuitBreaker(fn, {
    failureThreshold,
    openDuration,
    halfOpenMaxAttempts,
    timeout,
    shouldCountFailure,
    logger,
    onStateChange,
    onOpen,
    onClose,
    onHalfOpen,
  });

  // Create callable function (Vercel-style)
  const callable = async (...args: TArgs): Promise<TResult> => {
    return await instance.execute(...args);
  };

  // Attach utility methods
  callable.getState = () => instance.getState();
  callable.getStats = () => instance.getStats();
  callable.reset = () => instance.reset();

  return callable as CallableCircuitBreaker<TResult, TArgs>;
}

/**
 * @deprecated Use `defineCircuitBreaker` instead for better alignment with Vercel AI SDK patterns
 * @see defineCircuitBreaker
 */
export const circuitBreaker = defineCircuitBreaker;
