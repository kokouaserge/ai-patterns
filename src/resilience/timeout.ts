/**
 * Timeout Pattern - Limit execution time of operations
 */

import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  TimeoutOptions,
  TimeoutResult,
  TimeoutError,
  TimeoutDurations,
} from "../types/timeout";

export { TimeoutDurations };

/**
 * Timeout Pattern - Execute function with time limit
 */
export async function timeout<TResult>(
  options: TimeoutOptions<TResult>
): Promise<TimeoutResult<TResult>> {
  const {
    execute: fn,
    timeoutMs,
    message = `Operation cancelled after ${timeoutMs}ms`,
    logger = defaultLogger,
    onTimeout,
    signal: externalSignal,
  } = options;

  // Validation
  if (timeoutMs <= 0) {
    throw new PatternError(
      `timeoutMs must be > 0, received: ${timeoutMs}`,
      ErrorCode.INVALID_TIMEOUT
    );
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const { signal: internalSignal } = controller;

  // If external signal provided, combine with internal signal
  if (externalSignal) {
    if (externalSignal.aborted) {
      throw new PatternError(
        "Operation cancelled before start",
        ErrorCode.ABORTED
      );
    }

    externalSignal.addEventListener("abort", () => {
      controller.abort();
    });
  }

  // Create timeout timer
  const timer = setTimeout(() => {
    logger.warn(`Timeout after ${timeoutMs}ms`);
    if (onTimeout) {
      onTimeout();
    }
    controller.abort();
  }, timeoutMs);

  try {
    // Execute function with signal
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        internalSignal.addEventListener("abort", () => {
          const duration = Date.now() - startTime;
          const error = new PatternError(
            message,
            ErrorCode.TIMEOUT,
            undefined,
            { duration, timeoutMs }
          ) as TimeoutError;
          error.duration = duration;
          error.timedOut = true;
          reject(error);
        });
      }),
    ]);

    const duration = Date.now() - startTime;
    logger.debug(`Operation completed in ${duration}ms`);

    return {
      value,
      duration,
      timedOut: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create an AbortSignal that aborts after a delay
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Combine multiple AbortSignals into one
 * The combined signal aborts when any input signal aborts
 */
export function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }

    signal.addEventListener("abort", () => {
      controller.abort();
    });
  }

  return controller.signal;
}
