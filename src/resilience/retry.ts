/**
 * Retry Pattern - Automatically retry failed operations with intelligent backoff
 */

import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  BackoffStrategy,
  RetryOptions,
  RetryResult,
  RetryPredicates,
} from "../types/retry";

export { RetryPredicates };

/**
 * Calculate backoff delay based on strategy
 */
function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  strategy: BackoffStrategy
): number {
  let delay: number;

  switch (strategy) {
    case BackoffStrategy.CONSTANT:
      delay = initialDelay;
      break;

    case BackoffStrategy.LINEAR:
      delay = initialDelay * attempt;
      break;

    case BackoffStrategy.EXPONENTIAL:
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;

    default:
      delay = initialDelay;
  }

  return Math.min(delay, maxDelay);
}

/**
 * Add jitter (random variation) to delay to prevent thundering herd
 */
function addJitter(delay: number): number {
  const jitter = Math.random() * 0.3; // ±30% variation
  return Math.floor(delay * (1 + jitter - 0.15));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry Pattern - Execute function with retry logic
 */
export async function retry<TResult>(
  options: RetryOptions<TResult>
): Promise<RetryResult<TResult>> {
  const {
    execute: fn,
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffStrategy = BackoffStrategy.EXPONENTIAL,
    shouldRetry = () => true,
    logger = defaultLogger,
    onRetry,
  } = options;

  // Validation
  if (maxAttempts < 1) {
    throw new PatternError(
      `maxAttempts must be >= 1, received: ${maxAttempts}`,
      ErrorCode.INVALID_MAX_ATTEMPTS
    );
  }

  let lastError: Error;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxAttempts}`);
      const value = await fn();

      if (attempt > 1) {
        logger.info(`Success after ${attempt} attempt(s)`);
      }

      return {
        value,
        attempts: attempt,
        totalDelay,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt, throw error
      if (attempt === maxAttempts) {
        logger.error(`Failed after ${maxAttempts} attempt(s)`, {
          error: lastError.message,
        });

        throw new PatternError(
          `Operation failed after ${maxAttempts} attempts`,
          ErrorCode.MAX_RETRIES_EXCEEDED,
          lastError,
          {
            attempts: maxAttempts,
            lastError: lastError.message,
          }
        );
      }

      // Check if we should retry
      if (!shouldRetry(lastError, attempt)) {
        logger.warn("Non-retryable error, aborting retry", {
          error: lastError.message,
        });

        throw new PatternError(
          "Operation failed with non-retryable error",
          ErrorCode.NON_RETRYABLE_ERROR,
          lastError
        );
      }

      // Calculate delay with backoff and jitter
      const baseDelay = calculateBackoff(
        attempt,
        initialDelay,
        maxDelay,
        backoffStrategy
      );
      const delay = addJitter(baseDelay);
      totalDelay += delay;

      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: lastError.message,
      });

      // Invoke callback if provided
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // Should never reach here, but for TypeScript
  throw lastError!;
}
