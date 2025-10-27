# Fallback Pattern

Execute alternative functions if primary fails. Essential for building resilient AI applications with graceful degradation.

## Overview

The fallback pattern provides automatic failover to backup implementations when the primary function fails. Perfect for multi-provider AI systems (OpenAI → Claude → Gemini).

### Key Features

- **Multiple fallbacks** - Chain multiple backup functions
- **Conditional fallback** - Custom logic to determine when to fallback
- **Type-safe** - Full TypeScript support
- **Observability** - Track which function succeeded

### Use Cases

- **Multi-provider AI** - OpenAI → Claude → Local model
- **API redundancy** - Primary → Backup → Cached data
- **Graceful degradation** - Full feature → Limited feature → Offline mode

---

## Basic Usage

```typescript
import { fallback } from 'ai-patterns';

const result = await fallback({
  execute: async () => callPrimaryAPI(),
  fallback: async () => callBackupAPI()
});

console.log(result.value);        // Data from whichever succeeded
console.log(result.succeededAt);  // 0 = primary, 1 = fallback
```

---

## API Reference

### `fallback<TResult>(options: FallbackOptions<TResult>): Promise<FallbackResult<TResult>>`

#### Options

```typescript
interface FallbackOptions<TResult> {
  execute: AsyncFunction<TResult>;
  fallback: AsyncFunction<TResult> | AsyncFunction<TResult>[];
  shouldFallback?: (error: Error) => boolean;
  onPrimaryFailure?: (error: Error) => void;
  onFallbackUsed?: (fallbackIndex: number, error: Error) => void;
  onAllFailed?: (errors: Error[]) => void;
  logger?: Logger;
}
```

#### Result

```typescript
interface FallbackResult<T> {
  value: T;
  succeededAt: number;  // 0 = primary, 1+ = fallback index
  attempts: number;
  errors: Error[];
}
```

---

## Examples

### Multi-Provider AI with Fallback

```typescript
import { fallback } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const result = await fallback({
  execute: async () => {
    // Try OpenAI first
    const response = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Explain quantum computing'
    });
    return { text: response.text, provider: 'OpenAI' };
  },

  fallback: [
    // Fallback 1: Claude
    async () => {
      const response = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt: 'Explain quantum computing'
      });
      return { text: response.text, provider: 'Claude' };
    },

    // Fallback 2: Cached response
    async () => {
      return {
        text: await cache.get('quantum-computing'),
        provider: 'Cache'
      };
    }
  ],

  onFallbackUsed: (index, error) => {
    console.log(`Using fallback #${index + 1} due to: ${error.message}`);
  }
});

console.log(`Success with ${result.value.provider}`);
```

### Conditional Fallback

```typescript
const result = await fallback({
  execute: async () => callAPI(),

  fallback: async () => cachedData(),

  // Only fallback on server errors (5xx)
  shouldFallback: (error: any) => {
    return error.statusCode >= 500;
  }
});
```

---

## Best Practices

### ✅ Do

1. **Order fallbacks by preference** - Best → Good → Acceptable
2. **Use conditional fallback** - Don't fallback on client errors (4xx)
3. **Monitor fallback usage** - Track when fallbacks are triggered
4. **Consider cost** - Put cheaper options as fallbacks

### ❌ Don't

1. **Don't fallback on validation errors** - These won't succeed with fallbacks either
2. **Don't create infinite loops** - Ensure fallbacks can actually succeed
3. **Don't ignore primary failures** - Log and monitor them

---

## Related Patterns

- **[Retry](./retry.md)** - Combine with retry for robust recovery
- **[Circuit Breaker](./circuit-breaker.md)** - Prevent cascading failures

---

**[← Back to Documentation](../../README.md#patterns)**
