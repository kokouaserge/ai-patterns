/**
 * Compose Pattern - Middleware-based composition
 */

import type { Middleware, ComposeConfig } from "../types/composition";

// Re-export types for convenience
export type { Middleware, ComposeConfig };

/**
 * Compose multiple middlewares together
 *
 * Middlewares are applied from right to left (innermost first), similar to
 * function composition in mathematics: compose([f, g, h])(x) = f(g(h(x)))
 *
 * @example
 * ```typescript
 * import { compose, retry, timeout, circuitBreaker } from 'ai-patterns';
 *
 * const robustAPI = compose([
 *   timeout({ duration: 5000 }),
 *   retry({ maxAttempts: 3 }),
 *   circuitBreaker({ failureThreshold: 5 })
 * ]);
 *
 * const result = await robustAPI(
 *   async () => fetch('/api/data'),
 *   undefined
 * );
 * ```
 *
 * @param middlewares - Array of middlewares to compose
 * @param config - Optional configuration
 * @returns Composed function that applies all middlewares
 */
export function compose<TInput = void, TOutput = unknown>(
  middlewares: Middleware<TInput, TOutput>[],
  config?: ComposeConfig<TInput, TOutput>
) {
  return async (
    execute: (input: TInput) => TOutput | Promise<TOutput>,
    input?: TInput
  ): Promise<TOutput> => {
    const startTime = Date.now();

    if (config?.onStart) {
      await config.onStart();
    }

    try {
      // Build the middleware chain from right to left
      let wrappedFn: (input: TInput) => Promise<TOutput> = async (inp) => {
        return await execute(inp);
      };

      // Apply middlewares from right to left (last middleware wraps first)
      for (let i = middlewares.length - 1; i >= 0; i--) {
        wrappedFn = middlewares[i](wrappedFn);
      }

      const result = await wrappedFn(input as TInput);

      if (config?.onComplete) {
        const duration = Date.now() - startTime;
        await config.onComplete(result, duration);
      }

      return result;
    } catch (error) {
      if (config?.onError) {
        await config.onError(error as Error);
      }
      throw error;
    }
  };
}
