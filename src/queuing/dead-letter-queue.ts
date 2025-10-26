/**
 * Dead Letter Queue Pattern - Handle failed messages
 */

import { AsyncFunction, defaultLogger, Logger } from "../types/common";

export interface DeadLetterQueueOptions<TInput = any, TResult = any> {
  execute: AsyncFunction<TResult, [TInput]>;
  maxRetries?: number;
  retryDelay?: number;
  onDeadLetter: (item: TInput, errors: Error[]) => void | Promise<void>;
  logger?: Logger;
}

export async function deadLetterQueue<TInput = any, TResult = any>(
  options: DeadLetterQueueOptions<TInput, TResult>,
  item: TInput
): Promise<TResult> {
  const {
    execute: fn,
    maxRetries = 3,
    retryDelay = 1000,
    onDeadLetter,
    logger = defaultLogger,
  } = options;

  const errors: Error[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Processing attempt ${attempt}/${maxRetries}`);
      return await fn(item);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      logger.warn(`Attempt ${attempt} failed: ${err.message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // All retries failed - send to dead letter queue
  logger.error("All retries failed, sending to dead letter queue");
  await onDeadLetter(item, errors);

  throw errors[errors.length - 1];
}
