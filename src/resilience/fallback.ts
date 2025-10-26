/**
 * Fallback Pattern - Execute alternative functions if primary fails
 */

import { defaultLogger } from "../types/common";
import { FallbackOptions, FallbackResult } from "../types/fallback";

/**
 * Fallback - Try fallback functions if primary fails
 *
 * @example
 * ```typescript
 * const result = await fallback({
 *   execute: async () => callPrimaryAPI(),
 *   fallback: async () => callBackupAPI()
 * });
 * ```
 */
export async function fallback<TResult>(
  options: FallbackOptions<TResult>
): Promise<FallbackResult<TResult>> {
  const {
    execute: primaryFn,
    fallback: fallbackFns,
    shouldFallback = () => true,
    logger = defaultLogger,
    onPrimaryFailure,
    onFallbackUsed,
    onAllFailed,
  } = options;

  const fallbacks = Array.isArray(fallbackFns) ? fallbackFns : [fallbackFns];
  const errors: Error[] = [];
  let attempts = 0;

  // Try primary function
  try {
    logger.info("Executing primary function");
    const result = await primaryFn();
    attempts++;

    return {
      value: result,
      succeededAt: 0,
      attempts,
      errors: [],
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errors.push(err);
    attempts++;

    logger.warn("Primary function failed", { error: err.message });

    if (onPrimaryFailure) {
      onPrimaryFailure(err);
    }

    // Check if we should fallback
    if (!shouldFallback(err)) {
      logger.error("Fallback not triggered by shouldFallback predicate");
      throw err;
    }
  }

  // Try fallback functions in order
  for (let i = 0; i < fallbacks.length; i++) {
    try {
      logger.info(`Trying fallback function #${i + 1}`);
      const result = await fallbacks[i]();
      attempts++;

      if (onFallbackUsed) {
        onFallbackUsed(i, errors[0]);
      }

      return {
        value: result,
        succeededAt: i + 1,
        attempts,
        errors,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      attempts++;

      logger.warn(`Fallback function #${i + 1} failed`, {
        error: err.message,
      });
    }
  }

  // All attempts failed
  logger.error("All functions failed (primary + fallbacks)");

  if (onAllFailed) {
    onAllFailed(errors);
  }

  // Throw the last error
  throw errors[errors.length - 1];
}
