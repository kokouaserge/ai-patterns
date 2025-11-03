/**
 * Global unified storage for all ai-patterns.
 * Single source of truth for all in-memory state management.
 */

/**
 * Configuration options for GlobalStorage
 */
export interface GlobalStorageOptions {
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
 * Namespace prefixes for different patterns
 */
export enum StorageNamespace {
  IDEMPOTENCY = "idempotency:",
  COST_TRACKING = "cost:",
  AB_TEST = "abtest:",
  PROMPT_VERSION = "prompt:",
  REFLECTION = "reflection:",
  CUSTOM = "custom:",
}

/**
 * Entry wrapper with optional expiration timestamp
 */
export interface StorageEntry<T> {
  value: T;
  expiresAt?: number;
  namespace?: string;
}

/**
 * Global unified storage singleton
 * Single Map for all patterns with namespace isolation
 */
export class GlobalStorage {
  private static instance: GlobalStorage | null = null;
  private store = new Map<string, StorageEntry<any>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private options: GlobalStorageOptions;

  private constructor(options: GlobalStorageOptions = {}) {
    this.options = {
      autoCleanup: true,
      cleanupIntervalMs: 60000,
      ...options,
    };

    if (this.options.autoCleanup) {
      this.startCleanup(this.options.cleanupIntervalMs);
    }
  }

  /**
   * Get the global storage instance (singleton)
   */
  static getInstance(options?: GlobalStorageOptions): GlobalStorage {
    if (!GlobalStorage.instance) {
      GlobalStorage.instance = new GlobalStorage(options);
    }
    return GlobalStorage.instance;
  }

  /**
   * Reset the global storage instance (useful for testing)
   */
  static resetInstance(): void {
    if (GlobalStorage.instance) {
      GlobalStorage.instance.destroy();
      GlobalStorage.instance = null;
    }
  }

  /**
   * Clear all data but keep the instance (useful for tests)
   */
  static async clearAll(): Promise<void> {
    const instance = GlobalStorage.getInstance();
    await instance.clear();
  }

  /**
   * Create a namespaced key
   */
  private namespaceKey(namespace: string, key: string): string {
    return `${namespace}${key}`;
  }

  /**
   * Get a value from storage
   */
  async get<T = any>(namespace: string, key: string): Promise<T | undefined> {
    const fullKey = this.namespaceKey(namespace, key);
    const entry = this.store.get(fullKey);
    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a value in storage with optional TTL
   */
  async set<T = any>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void> {
    const fullKey = this.namespaceKey(namespace, key);
    const entry: StorageEntry<T> = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      namespace,
    };
    this.store.set(fullKey, entry);
  }

  /**
   * Delete a specific entry
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    const fullKey = this.namespaceKey(namespace, key);
    return this.store.delete(fullKey);
  }

  /**
   * Clear all entries for a namespace (or all if no namespace)
   */
  async clear(namespace?: string): Promise<void> {
    if (!namespace) {
      this.store.clear();
      return;
    }

    const keysToDelete: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.namespace === namespace || key.startsWith(namespace)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(namespace: string, key: string): Promise<boolean> {
    const value = await this.get(namespace, key);
    return value !== undefined;
  }

  /**
   * Get all keys for a namespace (excluding expired entries)
   */
  async keys(namespace: string): Promise<string[]> {
    const keys: string[] = [];
    const prefix = namespace;

    for (const [fullKey] of this.store.entries()) {
      if (fullKey.startsWith(prefix)) {
        const key = fullKey.substring(prefix.length);
        if (await this.has(namespace, key)) {
          keys.push(key);
        }
      }
    }
    return keys;
  }

  /**
   * Get number of entries for a namespace (excluding expired)
   */
  async size(namespace?: string): Promise<number> {
    if (!namespace) {
      // Count all non-expired entries
      let count = 0;
      for (const [, entry] of this.store.entries()) {
        if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
          count++;
        }
      }
      return count;
    }

    const keys = await this.keys(namespace);
    return keys.length;
  }

  /**
   * Get statistics about storage usage
   */
  getStats(): {
    totalEntries: number;
    byNamespace: Record<string, number>;
    expiredEntries: number;
  } {
    const byNamespace: Record<string, number> = {};
    let expiredEntries = 0;
    const now = Date.now();

    for (const [, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredEntries++;
      } else if (entry.namespace) {
        byNamespace[entry.namespace] = (byNamespace[entry.namespace] || 0) + 1;
      }
    }

    return {
      totalEntries: this.store.size,
      byNamespace,
      expiredEntries,
    };
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(intervalMs: number = 60000): void {
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
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Manually cleanup expired entries
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Cleanup on instance destruction
   */
  private destroy(): void {
    this.stopCleanup();
    this.store.clear();
  }
}

/**
 * Legacy adapter class for backward compatibility
 * @deprecated Use GlobalStorage.getInstance() directly
 */
export class InMemoryStorage<K = string, V = any> {
  protected store = new Map<K, StorageEntry<V>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly options: GlobalStorageOptions;

  constructor(options: GlobalStorageOptions = {}) {
    this.options = {
      autoCleanup: false,
      cleanupIntervalMs: 60000,
      ...options,
    };

    if (this.options.autoCleanup) {
      this.startCleanup(this.options.cleanupIntervalMs);
    }
  }

  async get(key: K): Promise<V | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async set(key: K, value: V, ttlMs?: number): Promise<void> {
    const entry: StorageEntry<V> = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
    this.store.set(key, entry);
  }

  async delete(key: K): Promise<boolean> {
    return this.store.delete(key);
  }

  protected async clear(): Promise<void> {
    this.store.clear();
  }

  protected async has(key: K): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  async keys(): Promise<K[]> {
    const keys: K[] = [];
    for (const [key] of this.store.entries()) {
      if (await this.has(key)) {
        keys.push(key);
      }
    }
    return keys;
  }

  protected async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }

  protected startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  protected stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  protected cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  protected getRawEntry(key: K): StorageEntry<V> | undefined {
    return this.store.get(key);
  }

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
