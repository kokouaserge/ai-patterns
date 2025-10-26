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
    wait = 300,
    maxWait,
    leading = false,
    logger = defaultLogger,
    onDebounced,
    onExecute,
  } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let maxWaitTimeoutId: NodeJS.Timeout | null = null;
  let lastInvokeTime = 0;
  let lastArgs: TArgs | null = null;
  let lastThis: any = null;
  let result: TResult | undefined;
  let pending = false;

  const invokeFunction = async (): Promise<TResult> => {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = Date.now();
    pending = false;

    if (onExecute) {
      onExecute(...args);
    }

    logger.info("Executing debounced function");
    result = await fn.apply(thisArg, args);
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
      timeoutId = setTimeout(async () => {
        cancelMaxWaitTimer();
        const result = await invokeFunction();
        resolve(result);
      }, wait);

      // Max wait timer
      if (maxWait !== undefined && !maxWaitTimeoutId) {
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeToMaxWait = maxWait - timeSinceLastInvoke;

        if (timeToMaxWait > 0) {
          maxWaitTimeoutId = setTimeout(async () => {
            cancelTimer();
            const result = await invokeFunction();
            resolve(result);
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
