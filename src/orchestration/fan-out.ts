/**
 * Fan-Out Pattern - Parallel processing with concurrency control
 */

import { defaultLogger } from "../types/common";
import { FanOutOptions, FanOutResult } from "../types/fan-out";

/**
 * Fan-Out - Process array of items in parallel
 */
export async function fanOut<TInput, TOutput>(
  options: FanOutOptions<TInput, TOutput>
): Promise<FanOutResult<TOutput>> {
  const {
    items,
    execute: fn,
    concurrency = Infinity,
    continueOnError = false,
    logger = defaultLogger,
    onProgress,
    onItemError,
  } = options;

  const startTime = Date.now();
  const total = items.length;
  const results: TOutput[] = [];
  const errors: Error[] = [];
  let completed = 0;

  logger.info(
    `Starting fan-out: ${total} items, concurrency: ${concurrency}`
  );

  // If no items, return immediately
  if (total === 0) {
    return {
      results: [],
      errors,
      total: 0,
      successCount: 0,
      errorCount: 0,
      failureCount: 0,
      duration: 0,
    };
  }

  // Function to process a single item
  const processItem = async (item: TInput, index: number): Promise<void> => {
    try {
      const result = await fn(item);
      results[index] = result;
      completed++;

      if (onProgress) {
        onProgress(completed, total);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      completed++;

      logger.error(`Error on item ${index + 1}/${total}`, {
        error: err.message,
      });

      if (onItemError) {
        onItemError(item, err, index);
      }

      if (!continueOnError) {
        throw err;
      }
    }
  };

  // Process with limited concurrency
  if (concurrency !== Infinity && concurrency > 0) {
    // Worker pool with concurrency limit
    const queue = [...items.entries()];
    const workers: Promise<void>[] = [];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const entry = queue.shift();
        if (!entry) break;

        const [index, item] = entry;
        await processItem(item, index);
      }
    };

    // Create workers
    const workerCount = Math.min(concurrency, items.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);
  } else {
    // Unlimited parallelism
    await Promise.all(items.map((item, index) => processItem(item, index)));
  }

  const duration = Date.now() - startTime;
  const successCount = total - errors.length;
  const errorCount = errors.length;

  logger.info(
    `Fan-out completed: ${successCount} successes, ${errorCount} errors in ${duration}ms`
  );

  return {
    results: results.filter((r) => r !== undefined),
    errors,
    total,
    successCount,
    errorCount,
    failureCount: errorCount,
    duration,
  };
}
