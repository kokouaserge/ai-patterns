/**
 * Base class for in-memory storage implementations across ai-patterns.
 * Provides common functionality for managing Map-based storage with optional TTL and cleanup.
 */

/**
 * Configuration options for InMemoryStorage
 */
export interface InMemoryStorageOptions {
  /**
   * Enable automatic cleanup of expired entries
   */
  autoCleanup?: boolean;
  /**
   * Cleanup interval in milliseconds (default: 60000ms = 1 minute)
   */
  cleanupIntervalMs?: number;
}

/**
 * Entry wrapper with optional expiration timestamp
 */
export interface StorageEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Base class for in-memory storage using Map
 * Supports optional TTL-based expiration and automatic cleanup
 */
export class InMemoryStorage<K = string, V = any> {
  protected store = new Map<K, StorageEntry<V>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly options: InMemoryStorageOptions;

  constructor(options: InMemoryStorageOptions = {}) {
    this.options = {
      autoCleanup: false,
      cleanupIntervalMs: 60000,
      ...options,
    };

    if (this.options.autoCleanup) {
      this.startCleanup(this.options.cleanupIntervalMs);
    }
  }

  /**
   * Get a value from storage
   * Returns undefined if key doesn't exist or entry has expired
   */
  async get(key: K): Promise<V | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in storage with optional TTL
   */
  async set(key: K, value: V, ttlMs?: number): Promise<void> {
    const entry: StorageEntry<V> = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
    this.store.set(key, entry);
  }

  /**
   * Delete a specific entry
   */
  async delete(key: K): Promise<boolean> {
    return this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  protected async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Check if a key exists and is not expired
   */
  protected async has(key: K): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Get all keys (excluding expired entries)
   */
  async keys(): Promise<K[]> {
    const keys: K[] = [];
    for (const [key] of this.store.entries()) {
      if (await this.has(key)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Get number of entries (excluding expired)
   */
  protected async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  protected startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  protected stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Manually cleanup expired entries
   */
  protected cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get raw entry (including expiration metadata)
   */
  protected getRawEntry(key: K): StorageEntry<V> | undefined {
    return this.store.get(key);
  }

  /**
   * Cleanup on instance destruction
   */
  protected destroy(): void {
    this.stopCleanup();
    this.store.clear();
  }
}

/**
 * Simple key-value in-memory storage (string keys)
 */
export class InMemoryKeyValueStorage<V = any> extends InMemoryStorage<string, V> {
  async getValue(key: string): Promise<V | undefined> {
    return this.get(key);
  }

  async setValue(key: string, value: V, ttlMs?: number): Promise<void> {
    return this.set(key, value, ttlMs);
  }

  async deleteValue(key: string): Promise<boolean> {
    return this.delete(key);
  }

  async clearAll(): Promise<void> {
    return this.clear();
  }

  async hasValue(key: string): Promise<boolean> {
    return this.has(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.keys();
  }

  async getSize(): Promise<number> {
    return this.size();
  }
}
