/**
 * Bulkhead Pattern - Resource isolation with concurrency control
 */

import { AsyncFunction, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import { BulkheadOptions, BulkheadResult, BulkheadStats } from "../types/bulkhead";

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: BulkheadResult<T>) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

/**
 * Bulkhead class for resource isolation
 */
class Bulkhead<TResult = any> {
  private concurrent = 0;
  private queue: QueuedRequest<TResult>[] = [];
  private completed = 0;
  private rejected = 0;

  constructor(
    private readonly fn: AsyncFunction<TResult>,
    private readonly options: Omit<BulkheadOptions<TResult>, "execute">
  ) {}

  async execute(): Promise<BulkheadResult<TResult>> {
    const {
      maxConcurrent = 10,
      maxQueue = 100,
      queueTimeout,
      logger = defaultLogger,
      onQueued,
      onQueueFull,
    } = this.options;

    const queuedAt = Date.now();

    // Check if we can execute immediately
    if (this.concurrent < maxConcurrent) {
      return await this.executeNow(queuedAt);
    }

    // Check if queue is full
    if (this.queue.length >= maxQueue) {
      this.rejected++;
      if (onQueueFull) {
        onQueueFull();
      }
      throw new PatternError(
        `Bulkhead queue full (${maxQueue})`,
        ErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Add to queue
    return new Promise<BulkheadResult<TResult>>((resolve, reject) => {
      const request: QueuedRequest<TResult> = {
        execute: () => this.fn(),
        resolve,
        reject,
        queuedAt,
      };

      this.queue.push(request);

      if (onQueued) {
        onQueued(this.queue.length);
      }

      logger.info(`Request queued (${this.queue.length}/${maxQueue})`);

      // Queue timeout
      if (queueTimeout) {
        setTimeout(() => {
          const index = this.queue.indexOf(request);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(
              new PatternError(
                `Queue timeout after ${queueTimeout}ms`,
                ErrorCode.TIMEOUT
              )
            );
          }
        }, queueTimeout);
      }
    });
  }

  private async executeNow(queuedAt: number): Promise<BulkheadResult<TResult>> {
    const { logger = defaultLogger } = this.options;

    this.concurrent++;
    const executionStart = Date.now();

    if (this.options.onExecute) {
      this.options.onExecute();
    }

    try {
      logger.info(`Executing (${this.concurrent} concurrent)`);
      const value = await this.fn();
      const executionTime = Date.now() - executionStart;
      this.completed++;

      return {
        value,
        queueTime: executionStart - queuedAt,
        executionTime,
      };
    } finally {
      this.concurrent--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const { maxConcurrent = 10 } = this.options;

    if (this.concurrent < maxConcurrent) {
      const request = this.queue.shift()!;

      this.executeNow(request.queuedAt)
        .then(request.resolve)
        .catch(request.reject);
    }
  }

  getStats(): BulkheadStats {
    return {
      concurrent: this.concurrent,
      queueSize: this.queue.length,
      completed: this.completed,
      rejected: this.rejected,
    };
  }
}

/**
 * Define a bulkhead with Vercel-style callable API
 */
export function defineBulkhead<TResult = any>(
  options: BulkheadOptions<TResult>
): {
  (): Promise<BulkheadResult<TResult>>;
  getStats(): BulkheadStats;
} {
  const { execute: fn, ...rest } = options;
  const instance = new Bulkhead(fn, rest);

  const callable = async (): Promise<BulkheadResult<TResult>> => {
    return await instance.execute();
  };

  callable.getStats = () => instance.getStats();

  return callable;
}

export const bulkhead = defineBulkhead;
