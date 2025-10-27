/**
 * Types for Circuit Breaker Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /**
   * Circuit is closed - requests flow normally
   */
  CLOSED = "CLOSED",

  /**
   * Circuit is open - requests are blocked
   */
  OPEN = "OPEN",

  /**
   * Circuit is half-open - testing if service recovered
   */
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Options for circuit breaker
 */
export interface CircuitBreakerOptions<TResult = any> {
  /**
   * Function to execute with circuit breaker protection
   */
  execute: AsyncFunction<TResult>;

  /**
   * Number of consecutive failures before opening circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Duration in ms to keep circuit open
   * @default 60000 (1 minute)
   */
  openDuration?: number;

  /**
   * Number of test requests in half-open state before closing
   * @default 1
   */
  halfOpenMaxAttempts?: number;

  /**
   * Timeout for each request in ms
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Function to determine if error should count towards failure
   * @default () => true
   */
  shouldCountFailure?: (error: Error) => boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callbacks for state changes
   */
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /**
   * Current state
   */
  state: CircuitState;

  /**
   * Number of failures
   */
  failureCount: number;

  /**
   * Number of successes
   */
  successCount: number;

  /**
   * Total calls
   */
  totalCalls: number;

  /**
   * Last failure timestamp
   */
  lastFailureTime: number | null;

  /**
   * Last success timestamp
   */
  lastSuccessTime: number | null;
}
