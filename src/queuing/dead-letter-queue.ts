/**
 * Dead Letter Queue Pattern - Handle failed messages
 */

import { AsyncFunction, defaultLogger, Logger } from "../types/common";

export interface DeadLetterQueueOptions<TInput = any, TResult = any> {
  execute: AsyncFunction<TResult, TInput extends undefined ? [] : [TInput]>;
  maxRetries?: number;
  retryDelay?: number;
  message?: TInput;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onDeadLetter: (error: Error, message?: TInput) => void | Promise<void>;
  logger?: Logger;
}

export interface DeadLetterQueueResult<TResult = any> {
  success: boolean;
  value?: TResult;
  error?: Error;
}

export async function deadLetterQueue<TResult = any, TInput = any>(
  options: DeadLetterQueueOptions<TInput, TResult>
): Promise<DeadLetterQueueResult<TResult>> {
  const {
    execute: fn,
    maxRetries = 3,
    retryDelay = 1000,
    message,
    shouldRetry = () => true,
    onDeadLetter,
    logger = defaultLogger,
  } = options;

  const errors: Error[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Processing attempt ${attempt}/${maxRetries}`);
      const result = message !== undefined
        ? await (fn as AsyncFunction<TResult, [TInput]>)(message)
        : await (fn as AsyncFunction<TResult>)();

      return {
        success: true,
        value: result,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      logger.warn(`Attempt ${attempt} failed: ${err.message}`);

      // Check if we should retry
      if (attempt < maxRetries) {
        if (!shouldRetry(err, attempt)) {
          logger.info("shouldRetry returned false, stopping retries");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // All retries failed - send to dead letter queue
  const lastError = errors[errors.length - 1];
  logger.error("All retries failed, sending to dead letter queue");
  await onDeadLetter(lastError, message);

  return {
    success: false,
    error: lastError,
  };
}
