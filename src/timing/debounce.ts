/**
 * Debounce Pattern - Execute after silence period
 */

import { defaultLogger } from "../types/common";
import { DebounceOptions, DebouncedFunction } from "../types/debounce";

/**
 * Define a debounced function
 *
 * @example
 * ```typescript
 * const saveData = defineDebounce({
 *   execute: async () => await api.save(),
 *   wait: 500,
 *   maxWait: 2000
 * });
 *
 * saveData(); // Will execute after 500ms of silence
 * ```
 */
export function defineDebounce<TArgs extends any[] = any[], TResult = any>(
  options: DebounceOptions<TArgs, TResult>
): DebouncedFunction<TArgs, TResult> {
  const {
    execute: fn,
    wait,
    maxWait,
    leading = false,
    logger = defaultLogger,
    onDebounced,
    onExecute,
  } = options;

  // Support both 'wait' and 'delayMs' for compatibility
  const delay = wait ?? (options as any).delayMs ?? 300;

  let timeoutId: NodeJS.Timeout | null = null;
  let maxWaitTimeoutId: NodeJS.Timeout | null = null;
  let lastInvokeTime = 0;
  let lastArgs: TArgs | null = null;
  let lastThis: any = null;
  let result: TResult | undefined;
  let pending = false;
  let pendingResolvers: Array<(value: TResult) => void> = [];

  const invokeFunction = async (): Promise<TResult> => {
    const args = lastArgs!;
    const thisArg = lastThis;
    const resolvers = [...pendingResolvers];

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = Date.now();
    pending = false;
    pendingResolvers = [];

    if (onExecute) {
      onExecute(...args);
    }

    logger.info("Executing debounced function");
    result = await fn.apply(thisArg, args);

    // Resolve all pending promises
    resolvers.forEach(resolve => resolve(result!));

    return result;
  };

  const cancelMaxWaitTimer = () => {
    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
  };

  const cancelTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const debounced = function (this: any, ...args: TArgs): Promise<TResult> {
    const time = Date.now();
    const isInvoking = leading && !pending;

    lastArgs = args;
    lastThis = this;
    pending = true;

    if (isInvoking) {
      return invokeFunction();
    }

    cancelTimer();

    if (onDebounced) {
      onDebounced();
    }

    return new Promise<TResult>((resolve) => {
      // Add this resolver to pending resolvers
      pendingResolvers.push(resolve);

      // Set timeout for this debounced call (always create new timeout after cancel)
      timeoutId = setTimeout(async () => {
        timeoutId = null;
        cancelMaxWaitTimer();
        await invokeFunction();
      }, delay);

      // Max wait timer
      if (maxWait !== undefined && !maxWaitTimeoutId) {
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeToMaxWait = maxWait - timeSinceLastInvoke;

        if (timeToMaxWait > 0) {
          maxWaitTimeoutId = setTimeout(async () => {
            maxWaitTimeoutId = null;
            cancelTimer();
            await invokeFunction();
          }, timeToMaxWait);
        }
      }
    });
  };

  debounced.cancel = () => {
    cancelTimer();
    cancelMaxWaitTimer();
    lastArgs = null;
    lastThis = null;
    pending = false;
    pendingResolvers = [];
    logger.info("Debounced function cancelled");
  };

  debounced.flush = async (): Promise<TResult | undefined> => {
    if (!pending) {
      return result;
    }

    cancelTimer();
    cancelMaxWaitTimer();
    return await invokeFunction();
  };

  debounced.pending = (): boolean => {
    return pending;
  };

  return debounced as DebouncedFunction<TArgs, TResult>;
}

/**
 * @deprecated Use `defineDebounce` instead
 * @see defineDebounce
 */
export const debounce = defineDebounce;
