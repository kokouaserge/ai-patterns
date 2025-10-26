/**
 * Common types for ai-patterns
 */

/**
 * Async function type
 */
export type AsyncFunction<TResult = any, TArgs extends any[] = any[]> = (
  ...args: TArgs
) => Promise<TResult>;

/**
 * Value that may or may not be a promise
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Base pattern interface
 */
export interface Pattern<TOptions = any, TResult = any> {
  execute: (...args: any[]) => Promise<TResult>;
  options: TOptions;
}

/**
 * Logger interface for pattern logging
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
export const defaultLogger: Logger = {
  info: (message, meta) => console.log(`[INFO] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[ERROR] ${message}`, meta ?? ""),
  debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta ?? ""),
};
