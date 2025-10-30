/**
 * Types for Idempotency Pattern
 */

import { AsyncFunction, Logger } from "./common";
import { InMemoryStorage } from "../common/storage";

/**
 * Idempotency record status
 */
export enum IdempotencyStatus {
  /**
   * Operation in progress
   */
  IN_PROGRESS = "IN_PROGRESS",

  /**
   * Operation completed successfully
   */
  COMPLETED = "COMPLETED",

  /**
   * Operation failed
   */
  FAILED = "FAILED",
}

/**
 * Concurrent request behavior
 */
export enum ConcurrentBehavior {
  /**
   * Wait for the concurrent request to complete
   */
  WAIT = "WAIT",

  /**
   * Immediately reject concurrent request
   */
  REJECT = "REJECT",
}

/**
 * Idempotency record
 */
export interface IdempotencyRecord<T = any> {
  /**
   * Idempotency key
   */
  key: string;

  /**
   * Operation result
   */
  result: T;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Expiration timestamp
   */
  expiresAt: number;

  /**
   * Status
   */
  status: IdempotencyStatus;

  /**
   * Error (if failed)
   */
  error?: Error;

  /**
   * Number of cache hits
   */
  hitCount: number;
}

/**
 * Interface for custom idempotency store
 */
export interface IdempotencyStore<T = any> {
  getRecord(key: string): Promise<IdempotencyRecord<T> | null>;
  set(key: string, record: IdempotencyRecord<T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * Options for idempotency pattern
 */
export interface IdempotencyOptions<TResult = any> {
  /**
   * Function to execute with idempotency
   */
  execute: AsyncFunction<TResult>;

  /**
   * Idempotency key (if not provided, uses keyGenerator)
   */
  key?: string;

  /**
   * Function to generate idempotency key
   * Default: generates random key (not recommended for production)
   */
  keyGenerator?: () => string;

  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Custom store for persistence
   */
  store?: IdempotencyStore<TResult>;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Behavior for concurrent requests
   * @default ConcurrentBehavior.WAIT
   */
  concurrentBehavior?: ConcurrentBehavior;

  /**
   * Timeout for waiting on concurrent request (ms)
   * @default 30000
   */
  waitTimeout?: number;

  /**
   * Callback on cache hit
   */
  onCacheHit?: (key: string) => void;

  /**
   * Callback on cache miss
   */
  onCacheMiss?: (key: string) => void;
}

/**
 * In-memory store implementation
 */
export class InMemoryStore<T = any>
  extends InMemoryStorage<string, IdempotencyRecord<T>>
  implements IdempotencyStore<T>
{
  constructor() {
    super({ autoCleanup: false });
  }

  override async get(key: string): Promise<IdempotencyRecord<T> | undefined> {
    const entry = this.getRawEntry(key);
    if (!entry) return undefined;

    const record = entry.value;
    // Check expiration using the record's own expiresAt
    if (Date.now() > record.expiresAt) {
      await super.delete(key);
      return undefined;
    }

    return record;
  }

  async getRecord(key: string): Promise<IdempotencyRecord<T> | null> {
    const result = await this.get(key);
    return result ?? null;
  }

  async set(key: string, record: IdempotencyRecord<T>): Promise<void> {
    // Store record without additional TTL wrapper since record has its own expiresAt
    await super.set(key, record);
  }

  async delete(key: string): Promise<boolean> {
    return super.delete(key);
  }

  async clear(): Promise<void> {
    return super.clear();
  }

  /**
   * Start automatic cleanup of expired entries
   */
  startCleanup(intervalMs: number = 60000): void {
    super.startCleanup(intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    super.stopCleanup();
  }
}

/**
 * Default key generator (simple hash)
 */
export function defaultKeyGenerator(...args: any[]): string {
  const str = JSON.stringify(args);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `idempotency-${hash}`;
}
