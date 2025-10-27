/**
 * Types for Composition and Middleware
 */

/**
 * Middleware type - transforms a function by wrapping it
 */
export type Middleware<TInput = any, TOutput = any> = (
  next: (input: TInput) => Promise<TOutput>
) => (input: TInput) => Promise<TOutput>;

/**
 * Configuration for compose function
 */
export interface ComposeConfig<_TInput = void, TOutput = unknown> {
  /**
   * Called before execution starts
   */
  onStart?: () => void | Promise<void>;

  /**
   * Called after successful completion
   */
  onComplete?: (result: TOutput, duration: number) => void | Promise<void>;

  /**
   * Called on error
   */
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Options for timeout middleware
 */
export interface TimeoutMiddlewareOptions {
  /**
   * Timeout duration in milliseconds
   */
  duration: number;

  /**
   * Custom error message
   */
  message?: string;
}

/**
 * Options for fallback middleware
 */
export interface FallbackMiddlewareOptions<TInput = any, TOutput = any> {
  /**
   * Fallback function(s) to execute if primary fails
   */
  fallback:
    | ((input: TInput) => TOutput | Promise<TOutput>)
    | Array<(input: TInput) => TOutput | Promise<TOutput>>;

  /**
   * Predicate to determine if fallback should be used
   * @default () => true
   */
  shouldFallback?: (error: Error) => boolean;
}

/**
 * Options for cache middleware
 */
export interface CacheMiddlewareOptions<TInput = any, _TOutput = any> {
  /**
   * Time-to-live in milliseconds
   */
  ttl?: number;

  /**
   * Custom key generation function
   * @default JSON.stringify
   */
  keyFn?: (input: TInput) => string;
}
