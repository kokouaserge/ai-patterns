# Memoize Pattern

Cache function results based on input arguments. Essential for expensive AI operations and repeated computations.

## Overview

Memoization caches function results by input arguments, returning cached values for repeated calls. Significantly reduces costs for AI APIs.

### Key Features

- **Automatic caching** - Cache by function arguments
- **TTL support** - Configurable cache expiration
- **Custom key function** - Control cache keys
- **Type-safe** - Full TypeScript generics support

### Use Cases

- **AI API calls** - Cache expensive LLM responses
- **Expensive computations** - Mathematical operations
- **Database queries** - Cache frequent lookups
- **API responses** - Reduce external calls

---

## Basic Usage

```typescript
import { memoize } from 'ai-patterns';

const fetchUser = memoize({
  execute: async (id: string) => {
    return await db.users.findById(id);
  },
  ttl: 60000,  // Cache for 60s
  keyFn: (id) => `user:${id}`
});

await fetchUser('123'); // DB call
await fetchUser('123'); // Cached (instant)
```

---

## API Reference

### `memoize<TArgs, TResult>(options): (...args: TArgs) => Promise<TResult>`

#### Options

```typescript
interface MemoizeOptions<TArgs, TResult> {
  execute: (...args: TArgs) => Promise<TResult> | TResult;
  ttl?: number;  // Cache TTL in ms
  keyFn?: (...args: TArgs) => string;  // Default: JSON.stringify
  logger?: Logger;
  onCacheHit?: (key: string) => void;
  onCacheMiss?: (key: string) => void;
}
```

---

## Examples

### Memoize AI Responses

```typescript
import { memoize } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const aiComplete = memoize({
  execute: async (prompt: string) => {
    console.log(`🤖 Calling OpenAI (costs tokens)...`);

    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt
    });

    return { text, tokens: usage.totalTokens };
  },
  ttl: 3600000,  // Cache 1 hour
  keyFn: (prompt) => `ai:${prompt}`,

  onCacheHit: (key) => {
    console.log(`✅ Cache hit - Saved API call!`);
  }
});

// First call - OpenAI API
const result1 = await aiComplete('Explain TypeScript');
console.log(`Cost: ${result1.tokens} tokens`);

// Second call - Cached (instant, free)
const result2 = await aiComplete('Explain TypeScript');
console.log(`Cached: 0 tokens`);
```

### Memoize with Complex Arguments

```typescript
const search = memoize({
  execute: async (query: string, filters: Filter[]) => {
    return await searchAPI(query, filters);
  },
  ttl: 300000,  // 5 minutes
  keyFn: (query, filters) => {
    return `search:${query}:${JSON.stringify(filters)}`;
  }
});
```

---

## Memoize vs Idempotency

| Feature | Memoize | Idempotency |
|---------|---------|-------------|
| **Purpose** | Performance optimization | Prevent duplicates |
| **Key** | Function arguments | External key |
| **Use case** | Expensive reads | Write operations |

---

## Best Practices

### ✅ Do

1. **Set appropriate TTL** - Balance freshness vs performance
2. **Use for expensive operations** - AI calls, complex computations
3. **Monitor cache hit rate** - Optimize TTL based on usage
4. **Custom key function** - For complex arguments

### ❌ Don't

1. **Don't memoize mutations** - Use idempotency instead
2. **Don't cache sensitive data** - Consider security implications
3. **Don't set TTL too high** - Stale data issues

---

## Related Patterns

- **[Idempotency](./idempotency.md)** - For write operations
- **[Fallback](./fallback.md)** - Combine with cached fallback

---

**[← Back to Documentation](../../README.md#patterns)**
