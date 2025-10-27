/**
 * Types for Debounce Pattern
 */

import { Logger } from "./common";

/**
 * Options for debounce pattern
 */
export interface DebounceOptions<TArgs extends any[] = any[], TResult = any> {
  /**
   * Function to debounce
   */
  execute: (...args: TArgs) => Promise<TResult> | TResult;

  /**
   * Wait time in milliseconds (silence period)
   * @default 300
   */
  wait?: number;

  /**
   * Maximum wait time before forcing execution
   * Prevents indefinite delays if execute is called repeatedly
   * @default undefined (no max wait)
   */
  maxWait?: number;

  /**
   * Execute on leading edge instead of trailing
   * @default false
   */
  leading?: boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callback when execution is debounced (skipped)
   */
  onDebounced?: () => void;

  /**
   * Callback when execution happens
   */
  onExecute?: (...args: TArgs) => void;
}

/**
 * Debounced function with utility methods
 */
export interface DebouncedFunction<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): Promise<TResult>;
  cancel(): void;
  flush(): Promise<TResult | undefined>;
  pending(): boolean;
}
