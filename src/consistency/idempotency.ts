/**
 * Idempotency Pattern - Ensure operations can be safely retried
 */

import { AsyncFunction, Logger, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  IdempotencyStatus,
  ConcurrentBehavior,
  IdempotencyRecord,
  IdempotencyStore,
  IdempotencyOptions,
  InMemoryStore,
  defaultKeyGenerator,
} from "../types/idempotency";

/**
 * Internal options (without execute, key, keyGenerator)
 */
interface IdempotencyInternalOptions<T = any> {
  keyGenerator?: (...args: any[]) => string;
  ttl?: number;
  store?: IdempotencyStore<T>;
  logger?: Logger;
  concurrentBehavior?: ConcurrentBehavior;
  waitTimeout?: number;
  onCacheHit?: (key: string, record: IdempotencyRecord<T>) => void;
  onCacheMiss?: (key: string) => void;
}

/**
 * Idempotency - Guarantees operation idempotence
 */
export class Idempotency<TResult = any, TArgs extends any[] = any[]> {
  private store: IdempotencyStore<TResult>;
  private keyGenerator: (...args: TArgs) => string;
  private ttl: number;
  private logger: Logger;
  private concurrentBehavior: ConcurrentBehavior;
  private waitTimeout: number;
  private pendingRequests = new Map<
    string,
    Promise<IdempotencyRecord<TResult>>
  >();

  constructor(
    private readonly fn: AsyncFunction<TResult, TArgs>,
    options: IdempotencyInternalOptions<TResult> = {}
  ) {
    this.store = options.store ?? new InMemoryStore<TResult>();
    this.keyGenerator = (options.keyGenerator ??
      defaultKeyGenerator) as (...args: TArgs) => string;
    this.ttl = options.ttl ?? 3600000;
    this.logger = options.logger ?? defaultLogger;
    this.concurrentBehavior =
      options.concurrentBehavior ?? ConcurrentBehavior.WAIT;
    this.waitTimeout = options.waitTimeout ?? 30000;

    // Start cleanup if in-memory store
    if (this.store instanceof InMemoryStore) {
      this.store.startCleanup();
    }
  }

  /**
   * Execute function with idempotency
   */
  async execute(...args: TArgs): Promise<TResult> {
    const key = this.keyGenerator(...args);
    this.logger.debug(`Idempotency key: ${key}`);

    // Check for cached result
    const cachedRecord = await this.store.get(key);

    if (cachedRecord) {
      if (cachedRecord.status === IdempotencyStatus.COMPLETED) {
        this.logger.info(
          `Cache hit for ${key} (hit #${cachedRecord.hitCount})`
        );
        cachedRecord.hitCount++;
        await this.store.set(key, cachedRecord);
        return cachedRecord.result;
      }

      if (cachedRecord.status === IdempotencyStatus.IN_PROGRESS) {
        return this.handleInProgress(key);
      }

      if (cachedRecord.status === IdempotencyStatus.FAILED) {
        this.logger.warn(`Previous operation failed for ${key}`);
        // Retry on previous failure
      }
    }

    // No cache, execute function
    return this.executeAndCache(key, args);
  }

  /**
   * Handle concurrent requests with same key
   */
  private async handleInProgress(key: string): Promise<TResult> {
    if (this.concurrentBehavior === ConcurrentBehavior.REJECT) {
      throw new PatternError(
        "Concurrent request with same key in progress",
        ErrorCode.CONCURRENT_REQUEST,
        undefined,
        { key }
      );
    }

    // Wait for concurrent request to complete
    this.logger.info(`Waiting for concurrent request: ${key}`);

    const pendingPromise = this.pendingRequests.get(key);
    if (pendingPromise) {
      try {
        const record = await Promise.race([
          pendingPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new PatternError(
                    `Timeout waiting for concurrent request (${this.waitTimeout}ms)`,
                    ErrorCode.WAIT_TIMEOUT,
                    undefined,
                    { key, timeout: this.waitTimeout }
                  )
                ),
              this.waitTimeout
            )
          ),
        ]);

        if (record.status === IdempotencyStatus.COMPLETED) {
          return record.result;
        }

        throw record.error ?? new Error("Concurrent request failed");
      } catch (error) {
        // On timeout or error, retry
        this.logger.warn("Error waiting for concurrent request, retrying");
      }
    }

    // If we get here, retry
    const cachedRecord = await this.store.get(key);
    if (cachedRecord && cachedRecord.status === IdempotencyStatus.COMPLETED) {
      return cachedRecord.result;
    }

    throw new PatternError(
      "Unable to get result from concurrent request",
      ErrorCode.REQUEST_FAILED
    );
  }

  /**
   * Execute function and cache result
   */
  private async executeAndCache(key: string, args: TArgs): Promise<TResult> {
    // Create in-progress record
    const inProgressRecord: IdempotencyRecord<TResult> = {
      key,
      result: null as any,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      status: IdempotencyStatus.IN_PROGRESS,
      hitCount: 0,
    };

    await this.store.set(key, inProgressRecord);

    // Create promise for concurrent requests
    const executionPromise = (async (): Promise<
      IdempotencyRecord<TResult>
    > => {
      try {
        this.logger.info(`Executing operation for ${key}`);
        const result = await this.fn(...args);

        const completedRecord: IdempotencyRecord<TResult> = {
          key,
          result,
          createdAt: Date.now(),
          expiresAt: Date.now() + this.ttl,
          status: IdempotencyStatus.COMPLETED,
          hitCount: 0,
        };

        await this.store.set(key, completedRecord);
        this.logger.info(`Operation completed for ${key}`);

        return completedRecord;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        const failedRecord: IdempotencyRecord<TResult> = {
          key,
          result: null as any,
          createdAt: Date.now(),
          expiresAt: Date.now() + this.ttl,
          status: IdempotencyStatus.FAILED,
          error: err,
          hitCount: 0,
        };

        await this.store.set(key, failedRecord);
        this.logger.error(`Operation failed for ${key}`, {
          error: err.message,
        });

        throw err;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, executionPromise);

    const record = await executionPromise;
    return record.result;
  }

  /**
   * Invalidate cache for key
   */
  async invalidate(...args: TArgs): Promise<void> {
    const key = this.keyGenerator(...args);
    await this.store.delete(key);
    this.logger.info(`Cache invalidated for ${key}`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.store.clear();
    this.pendingRequests.clear();
    this.logger.info("Cache cleared");
  }

  /**
   * Get cached record
   */
  async getRecord(...args: TArgs): Promise<IdempotencyRecord<TResult> | null> {
    const key = this.keyGenerator(...args);
    return this.store.get(key);
  }
}

/**
 * Global shared store for idempotent function calls
 */
const globalIdempotencyStore = new InMemoryStore<any>();
globalIdempotencyStore.startCleanup();

/**
 * Global pending requests map to handle concurrent requests
 */
const globalPendingRequests = new Map<string, Promise<any>>();

/**
 * Reset the global idempotency store (useful for testing)
 */
export function resetGlobalIdempotencyStore(): void {
  // Clear all entries by creating a new store
  const newStore = new InMemoryStore<any>();
  newStore.startCleanup();
  // Copy the new store's internal state to the global store
  // Since InMemoryStore doesn't expose a clear method, we need to manually clear
  (globalIdempotencyStore as any).store = new Map();
  globalPendingRequests.clear();
}

/**
 * Create idempotent function with single parameter API
 */
export async function idempotent<TResult = any>(
  options: IdempotencyOptions<TResult>
): Promise<TResult> {
  const {
    execute: fn,
    key,
    keyGenerator,
    ttl,
    store,
    logger = defaultLogger,
    onCacheHit,
    onCacheMiss,
  } = options;

  // Determine the key
  let idempotencyKey: string;
  if (key) {
    idempotencyKey = key;
  } else if (keyGenerator) {
    idempotencyKey = keyGenerator();
  } else {
    throw new PatternError(
      "Either 'key' or 'keyGenerator' must be provided for idempotency",
      ErrorCode.INVALID_IDEMPOTENCY_KEY
    );
  }

  const idempotencyStore = store ?? (globalIdempotencyStore as IdempotencyStore<TResult>);
  const cacheTtl = ttl ?? 3600000;

  logger.debug(`Idempotency key: ${idempotencyKey}`);

  // Check for cached result
  const cachedRecord = await idempotencyStore.get(idempotencyKey);

  if (cachedRecord) {
    if (cachedRecord.status === IdempotencyStatus.COMPLETED) {
      logger.info(
        `Cache hit for ${idempotencyKey} (hit #${cachedRecord.hitCount})`
      );

      // Update hit count
      cachedRecord.hitCount++;
      await idempotencyStore.set(idempotencyKey, cachedRecord);

      if (onCacheHit) {
        onCacheHit(idempotencyKey);
      }

      return cachedRecord.result;
    } else if (cachedRecord.status === IdempotencyStatus.FAILED) {
      logger.warn(`Previous execution failed for ${idempotencyKey}`);
      // Retry on previous failure by continuing to execute
    }
  }

  if (onCacheMiss) {
    onCacheMiss(idempotencyKey);
  }

  // Check if there's already a pending request for this key
  const pendingRequest = globalPendingRequests.get(idempotencyKey);
  if (pendingRequest) {
    logger.info(`Waiting for pending request for ${idempotencyKey}`);
    return await pendingRequest;
  }

  // Create execution promise
  const executionPromise = (async () => {
    try {
      logger.info(`Executing operation for ${idempotencyKey}`);
      const result = await fn();

      const completedRecord: IdempotencyRecord<TResult> = {
        key: idempotencyKey,
        result,
        createdAt: Date.now(),
        expiresAt: Date.now() + cacheTtl,
        status: IdempotencyStatus.COMPLETED,
        hitCount: 0,
      };

      await idempotencyStore.set(idempotencyKey, completedRecord);
      logger.info(`Operation completed for ${idempotencyKey}`);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      const failedRecord: IdempotencyRecord<TResult> = {
        key: idempotencyKey,
        result: null as any,
        createdAt: Date.now(),
        expiresAt: Date.now() + cacheTtl,
        status: IdempotencyStatus.FAILED,
        error: err,
        hitCount: 0,
      };

      await idempotencyStore.set(idempotencyKey, failedRecord);
      logger.error(`Operation failed for ${idempotencyKey}`, {
        error: err.message,
      });

      throw err;
    } finally {
      // Remove from pending requests when done
      globalPendingRequests.delete(idempotencyKey);
    }
  })();

  // Store the pending request
  globalPendingRequests.set(idempotencyKey, executionPromise);

  // Execute and return
  return await executionPromise;
}

/**
 * Decorator to make a method idempotent
 */
export function Idempotent<T>(options?: IdempotencyOptions<T>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const idempotency = new Idempotency(originalMethod, options);

    descriptor.value = async function (...args: any[]) {
      return idempotency.execute(...args);
    };

    return descriptor;
  };
}
