# Retry Pattern

Automatically retry failed operations with configurable backoff strategies and intelligent error handling.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
- [Backoff Strategies](#backoff-strategies)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The retry pattern automatically re-executes failed operations with intelligent delays between attempts. It's essential for handling transient failures in distributed systems, network operations, and external API calls.

### Key Features

- **Multiple backoff strategies** - Constant, linear, exponential
- **Jitter support** - Prevent thundering herd
- **Conditional retry** - Custom logic to determine retry-ability
- **Lifecycle callbacks** - Monitor and log retry attempts
- **Type-safe** - Full TypeScript support with generics

### Use Cases

- **Unstable APIs** - Retry transient HTTP 5xx errors
- **Network issues** - Handle temporary connectivity problems
- **Rate limits** - Retry after rate limit errors with backoff
- **Database timeouts** - Retry failed queries
- **Distributed systems** - Handle temporary service unavailability

---

## When to Use This vs Vercel AI SDK's Built-in Retry

Vercel AI SDK's `generateText` and `generateObject` have **built-in retry** (`maxRetries: 2` by default).

### Use Vercel's Built-in Retry When:

✅ **Simple AI calls** - Default 2 retries is enough
✅ **Single provider** - Staying with one AI provider (OpenAI, Claude, etc.)
✅ **Standard retry logic** - Basic exponential backoff suffices

```typescript
// ✅ Vercel built-in retry (simple case)
await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'Hello',
  maxRetries: 3 // ← Simple retry
});
```

### Use Our Retry Pattern When:

🎯 **Cross-provider fallback** - Retry across OpenAI → Claude → Gemini
🎯 **Advanced backoff** - Custom strategies (constant, linear, exponential with jitter)
🎯 **More control** - Conditional retry, detailed callbacks, metrics
🎯 **More attempts** - Need > 2 retries
🎯 **Observability** - Detailed metrics (`attempts`, `totalDelay`)

```typescript
// ✅ Our retry pattern (advanced case)
await retry({
  execute: async () => {
    try {
      // Try OpenAI first (disable its retry)
      return await generateText({
        model: openai('gpt-4-turbo'),
        prompt: 'Hello',
        maxRetries: 0 // ← Disable to use our retry
      });
    } catch {
      // Fallback to Claude
      return await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt: 'Hello',
        maxRetries: 0
      });
    }
  },
  maxAttempts: 5,
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  onRetry: (err, attempt) => logger.warn(`Retry ${attempt}`)
});
```

### Comparison Table

| Feature | Vercel Built-in | Our Pattern |
|---------|----------------|-------------|
| **Max retries** | 2 (configurable) | Unlimited (configurable) |
| **Backoff strategies** | Exponential only | Constant, Linear, Exponential |
| **Cross-provider fallback** | ❌ No | ✅ Yes |
| **Conditional retry** | ❌ No | ✅ Yes (`shouldRetry`) |
| **Detailed callbacks** | ❌ No | ✅ Yes (`onRetry`) |
| **Metrics** | ❌ No | ✅ Yes (`attempts`, `totalDelay`) |
| **Use case** | Simple AI calls | Production-grade resilience |

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

```typescript
import { retry } from 'ai-patterns';

const result = await retry({
  execute: () => fetch('https://api.example.com/data'),
  maxAttempts: 3
});

console.log(result.value);      // Response data
console.log(result.attempts);   // Number of attempts (1-3)
console.log(result.totalDelay); // Total time spent waiting
```

---

## API Reference

### `retry<TResult>(options: RetryOptions<TResult>): Promise<RetryResult<TResult>>`

#### RetryOptions

```typescript
interface RetryOptions<TResult = any> {
  /**
   * Function to execute with retry
   */
  execute: AsyncFunction<TResult>;

  /**
   * Maximum number of attempts (including the first)
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay between attempts in milliseconds
   * @default 30000 (30 seconds)
   */
  maxDelay?: number;

  /**
   * Backoff strategy
   * @default BackoffStrategy.EXPONENTIAL
   */
  backoffStrategy?: BackoffStrategy;

  /**
   * Function to determine if an error is retryable
   * @default () => true (all errors are retryable)
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Logger for retry attempts
   */
  logger?: Logger;

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}
```

#### RetryResult

```typescript
interface RetryResult<T> {
  /**
   * The successful result value
   */
  value: T;

  /**
   * Number of attempts taken
   */
  attempts: number;

  /**
   * Total delay accumulated across retries
   */
  totalDelay: number;
}
```

#### BackoffStrategy Enum

```typescript
enum BackoffStrategy {
  /**
   * Same delay between each attempt
   */
  CONSTANT = "CONSTANT",

  /**
   * Delay increases linearly (initialDelay * attempt)
   */
  LINEAR = "LINEAR",

  /**
   * Delay increases exponentially (initialDelay * 2^attempt)
   */
  EXPONENTIAL = "EXPONENTIAL"
}
```

---

## Backoff Strategies

### Exponential (Default - Recommended)

Best for most scenarios. Delays increase exponentially to prevent overwhelming the service.

```typescript
const result = await retry({
  execute: () => callAPI(),
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  initialDelay: 1000,
  maxDelay: 30000
});

// Delays: 1s, 2s, 4s, 8s, 16s, 30s (capped)
```

### Linear

Delays increase linearly. Good for predictable backoff.

```typescript
const result = await retry({
  execute: () => callAPI(),
  backoffStrategy: BackoffStrategy.LINEAR,
  initialDelay: 1000
});

// Delays: 1s, 2s, 3s, 4s, 5s...
```

### Constant

Same delay between attempts. Useful for testing or specific requirements.

```typescript
const result = await retry({
  execute: () => callAPI(),
  backoffStrategy: BackoffStrategy.CONSTANT,
  initialDelay: 2000
});

// Delays: 2s, 2s, 2s, 2s...
```

---

## Examples

### Example 1: Basic Retry with AI Embeddings

```typescript
import { retry, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

async function generateEmbedding(text: string) {
  return await retry<EmbeddingResult>({
    execute: async () => {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text,
        maxRetries: 0 // Use our retry instead
      });

      return {
        embedding,
        dimensions: embedding.length
      };
    },
    maxAttempts: 3,
    backoffStrategy: BackoffStrategy.EXPONENTIAL
  });
}

const result = await generateEmbedding('Machine learning basics');
console.log(result.value.dimensions); // 1536
console.log(`Completed in ${result.attempts} attempts`);
```

### Example 2: Cross-Provider Fallback

Retry across multiple AI providers:

```typescript
import { retry, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

interface AIResponse {
  text: string;
  provider: string;
  tokens: number;
}

const result = await retry<AIResponse>({
  execute: async () => {
    try {
      // Try OpenAI first
      const response = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: 'Explain TypeScript generics',
        maxRetries: 0
      });
      return {
        text: response.text,
        provider: 'OpenAI',
        tokens: response.usage.totalTokens
      };
    } catch (openaiError) {
      // Fallback to Claude
      const response = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt: 'Explain TypeScript generics',
        maxRetries: 0
      });
      return {
        text: response.text,
        provider: 'Claude',
        tokens: response.usage.totalTokens
      };
    }
  },
  maxAttempts: 5,
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  onRetry: (error, attempt) => {
    console.log(`⚠️  Attempt ${attempt} failed, trying fallback...`);
  }
});

console.log(`✅ Success with ${result.value.provider}`);
console.log(`📊 Used ${result.value.tokens} tokens`);
```

### Example 3: With Lifecycle Callbacks

```typescript
import { retry } from 'ai-patterns';

const result = await retry({
  execute: () => callPaymentAPI(),
  maxAttempts: 3,
  initialDelay: 1000,

  onRetry: (error, attempt, delay) => {
    console.log(`Attempt ${attempt} failed: ${error.message}`);
    console.log(`Retrying in ${delay}ms...`);

    // Report to monitoring
    metrics.increment('payment.retry.attempt', { attempt });
  }
});

console.log(`✅ Success after ${result.attempts} attempts`);
```

### Example 4: HTTP Retry with Status Codes

```typescript
import { retry, RetryPredicates } from 'ai-patterns';

const result = await retry({
  execute: async () => {
    return await fetch('/api/data');
  },
  maxAttempts: 5,

  // Retry only on 429 (rate limit) and 5xx (server errors)
  shouldRetry: RetryPredicates.httpStatusCodes([429, 500, 502, 503, 504])
});
```

### Example 5: Production Configuration

```typescript
import { retry, BackoffStrategy } from 'ai-patterns';

async function callExternalAPI() {
  return await retry({
    execute: () => fetch('https://external-api.com/data'),

    // Configuration
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffStrategy: BackoffStrategy.EXPONENTIAL,

    // Conditional retry
    shouldRetry: (error, attempt) => {
      // Don't retry on last attempt
      if (attempt === 5) return false;

      // Retry network errors
      if (RetryPredicates.networkErrors(error)) return true;

      // Retry rate limits
      if (RetryPredicates.rateLimitErrors(error)) return true;

      // Don't retry client errors
      return false;
    },

    // Monitoring
    logger: customLogger,
    onRetry: (error, attempt, delay) => {
      logger.warn('API retry', {
        attempt,
        delay,
        error: error.message,
        timestamp: Date.now()
      });

      // Alert on repeated failures
      if (attempt >= 3) {
        alerting.trigger('api-instability', { attempt, error });
      }
    }
  });
}
```

---

## Error Handling

### Catching Max Retries Error

When all retry attempts fail, the original error is thrown:

```typescript
import { retry } from 'ai-patterns';

try {
  const result = await retry({
    execute: () => unstableAPI(),
    maxAttempts: 3
  });

  console.log(result.value);
} catch (error) {
  console.error('All retries failed:', error);

  // Handle the error
  return fallbackData;
}
```

### Custom Error Messages

```typescript
const result = await retry({
  execute: async () => {
    try {
      return await callAPI();
    } catch (err) {
      throw new Error(`API call failed: ${err.message}`);
    }
  },
  maxAttempts: 3
});
```

---

## Best Practices

### ✅ Do

1. **Use exponential backoff** for most scenarios
   ```typescript
   backoffStrategy: BackoffStrategy.EXPONENTIAL
   ```

2. **Set reasonable maxDelay** to prevent excessive waiting
   ```typescript
   maxDelay: 30000 // 30 seconds max
   ```

3. **Use conditional retry** to avoid retrying non-retryable errors
   ```typescript
   shouldRetry: (error) => error.status >= 500
   ```

4. **Log retry attempts** for debugging and monitoring
   ```typescript
   onRetry: (error, attempt) => logger.warn('Retry', { attempt, error })
   ```

5. **Set appropriate maxAttempts** based on operation criticality
   ```typescript
   maxAttempts: 5 // For critical operations
   ```

### ❌ Don't

1. **Don't retry non-idempotent operations without idempotency keys**
   - Use the [idempotency pattern](./idempotency.md) first

2. **Don't retry client errors (4xx)**
   ```typescript
   // Bad
   shouldRetry: () => true // Retries everything

   // Good
   shouldRetry: (error) => error.status >= 500
   ```

3. **Don't set maxAttempts too high**
   ```typescript
   // Bad - causes long waits
   maxAttempts: 20

   // Good
   maxAttempts: 5
   ```

4. **Don't retry authentication errors**
   ```typescript
   shouldRetry: (error) => {
     if (error.status === 401 || error.status === 403) return false;
     return true;
   }
   ```

5. **Don't retry without understanding the root cause**
   - Use monitoring and logging to understand failures

### Production Checklist

- [ ] Exponential backoff configured
- [ ] maxDelay cap set
- [ ] Conditional retry logic implemented
- [ ] Logging/monitoring configured
- [ ] Idempotency ensured for mutations
- [ ] Timeout configured (use with [timeout pattern](./timeout.md))
- [ ] Circuit breaker for external services (use with [circuit breaker](./circuit-breaker.md))

---

## Related Patterns

### Combine with Timeout

```typescript
import { retry, timeout } from 'ai-patterns';

const result = await retry({
  execute: async () => {
    return await timeout({
      execute: () => callAPI(),
      timeoutMs: 5000
    });
  },
  maxAttempts: 3
});
```

**[→ Timeout Pattern Documentation](./timeout.md)**

### Combine with Circuit Breaker

```typescript
import { retry, circuitBreaker } from 'ai-patterns';

const breaker = circuitBreaker({
  execute: async () => {
    return await retry({
      execute: () => callAPI(),
      maxAttempts: 3
    });
  },
  failureThreshold: 5
});
```

**[→ Circuit Breaker Pattern Documentation](./circuit-breaker.md)**

### Combine with Idempotency

```typescript
import { retry, idempotent } from 'ai-patterns';

const result = await retry({
  execute: async () => {
    return await idempotent({
      execute: () => processPayment(data),
      key: `payment-${data.id}`
    });
  },
  maxAttempts: 3
});
```

**[→ Idempotency Pattern Documentation](./idempotency.md)**

---

## Common Helpers

### RetryPredicates

Built-in predicates for common retry scenarios:

```typescript
import { RetryPredicates } from 'ai-patterns';

// Network errors
RetryPredicates.networkErrors(error)

// Specific HTTP status codes
RetryPredicates.httpStatusCodes([429, 500, 502, 503, 504])

// Rate limit errors
RetryPredicates.rateLimitErrors(error)

// Never retry
RetryPredicates.never()

// Always retry
RetryPredicates.always()
```

---

## See Also

- [Pattern Composition Guide](../guides/composition.md)
- [Error Handling Guide](../guides/error-handling.md)
- [Best Practices Guide](../guides/best-practices.md)
- [API Reference](../api-reference.md)

---

## Examples

- [Basic Retry Example](../../examples/basic/retry-simple.ts)
- [HTTP Retry Example](../../examples/basic/retry-http.ts)
- [Production Example](../../examples/basic/retry-production.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
