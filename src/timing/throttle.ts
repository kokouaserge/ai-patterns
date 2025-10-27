/**
 * Throttle Pattern - Limit execution frequency
 */

import { defaultLogger } from "../types/common";
import { ThrottleOptions, ThrottledFunction } from "../types/throttle";

/**
 * Define a throttled function
 *
 * @example
 * ```typescript
 * const trackEvent = defineThrottle({
 *   execute: async () => await analytics.track(),
 *   interval: 1000 // Max once per second
 * });
 *
 * trackEvent(); // Executes immediately
 * trackEvent(); // Throttled (skipped)
 * ```
 */
export function defineThrottle<TArgs extends any[] = any[], TResult = any>(
  options: ThrottleOptions<TArgs, TResult>
): ThrottledFunction<TArgs, TResult> {
  const {
    execute: fn,
    interval,
    leading = true,
    trailing = true,
    logger = defaultLogger,
    onThrottled,
    onExecute,
  } = options;

  // Support both 'interval' and 'intervalMs' for compatibility
  const intervalMs = interval ?? (options as any).intervalMs ?? 1000;

  let timeoutId: NodeJS.Timeout | null = null;
  let lastInvokeTime = 0;
  let lastArgs: TArgs | null = null;
  let lastThis: any = null;
  let result: TResult | undefined;

  const invokeFunction = async (): Promise<TResult> => {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = Date.now();

    if (onExecute) {
      onExecute(...args);
    }

    logger.info("Executing throttled function");
    result = await fn.apply(thisArg, args);
    return result;
  };

  const throttled = function (this: any, ...args: TArgs): Promise<TResult | undefined> {
    const time = Date.now();
    const timeSinceLastInvoke = time - lastInvokeTime;

    lastArgs = args;
    lastThis = this;

    const shouldInvoke = timeSinceLastInvoke >= intervalMs;

    if (shouldInvoke) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (leading) {
        return invokeFunction();
      }
    }

    if (onThrottled) {
      onThrottled();
    }

    if (trailing && !timeoutId) {
      return new Promise<TResult | undefined>((resolve) => {
        timeoutId = setTimeout(async () => {
          timeoutId = null;
          const result = await invokeFunction();
          resolve(result);
        }, intervalMs - timeSinceLastInvoke);
      });
    }

    return Promise.resolve(result);
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastThis = null;
    logger.info("Throttled function cancelled");
  };

  throttled.flush = async (): Promise<TResult | undefined> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      return await invokeFunction();
    }
    return result;
  };

  return throttled as ThrottledFunction<TArgs, TResult>;
}

/**
 * @deprecated Use `defineThrottle` instead
 * @see defineThrottle
 */
export const throttle = defineThrottle;
