/**
 * Memoize Pattern - Cache function results
 */

import { defaultLogger, Logger } from "../types/common";

export interface MemoizeOptions<TArgs extends any[] = any[], TResult = any> {
  execute: (...args: TArgs) => Promise<TResult> | TResult;
  ttl?: number;
  keyFn?: (...args: TArgs) => string;
  logger?: Logger;
  onCacheHit?: (key: string) => void;
  onCacheMiss?: (key: string) => void;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface MemoizedFunction<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): Promise<TResult>;
  clear: () => void;
}

export function memoize<TArgs extends any[] = any[], TResult = any>(
  options: MemoizeOptions<TArgs, TResult>
): MemoizedFunction<TArgs, TResult> {
  const {
    execute: fn,
    ttl,
    keyFn = (...args) => JSON.stringify(args),
    logger = defaultLogger,
    onCacheHit,
    onCacheMiss,
  } = options;

  const cache = new Map<string, CacheEntry<TResult>>();

  const memoized = async function(...args: TArgs): Promise<TResult> {
    const key = keyFn(...args);
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      if (onCacheHit) onCacheHit(key);
      logger.info(`Cache hit: ${key}`);
      return cached.value;
    }

    // Cache miss
    if (onCacheMiss) onCacheMiss(key);
    logger.info(`Cache miss: ${key}`);

    const value = await fn(...args);
    const expiresAt = ttl ? now + ttl : Infinity;

    cache.set(key, { value, expiresAt });

    return value;
  };

  // Add clear method to the function
  memoized.clear = () => {
    cache.clear();
  };

  return memoized as MemoizedFunction<TArgs, TResult>;
}
