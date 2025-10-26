/**
 * Types for Throttle Pattern
 */

import { Logger } from "./common";

/**
 * Options for throttle pattern
 */
export interface ThrottleOptions<TArgs extends any[] = any[], TResult = any> {
  /**
   * Function to throttle
   */
  execute: (...args: TArgs) => Promise<TResult> | TResult;

  /**
   * Minimum interval between executions in milliseconds
   * @default 1000
   */
  interval?: number;

  /**
   * Execute on leading edge (immediately on first call)
   * @default true
   */
  leading?: boolean;

  /**
   * Execute on trailing edge (after interval expires)
   * @default false
   */
  trailing?: boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback when execution is throttled (skipped)
   */
  onThrottled?: () => void;

  /**
   * Callback when execution happens
   */
  onExecute?: (...args: TArgs) => void;
}

/**
 * Throttled function with utility methods
 */
export interface ThrottledFunction<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): Promise<TResult | undefined>;
  cancel(): void;
  flush(): Promise<TResult | undefined>;
}
