# Compose Pattern

Compose multiple patterns together to build robust, production-ready AI workflows using functional composition.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The compose pattern allows you to combine multiple resilience patterns into a single, reusable function. You can compose patterns either by **nesting them directly** (recommended for simple cases) or using **middleware composition** (for complex workflows).

### Key Features

- **Direct pattern composition** - Nest patterns together for clear control flow
- **Middleware composition** - Functional composition for advanced workflows
- **Type-safe** - Full TypeScript support with generics
- **Right-to-left composition** - Mathematical function composition style
- **Lifecycle hooks** - Monitor composition execution

### Use Cases

- **Production AI pipelines** - Combine retry, timeout, circuit breaker, fallback
- **Complex workflows** - Orchestrate multiple resilience patterns
- **Reusable functions** - Create pre-configured AI functions

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Direct Pattern Composition (Recommended)

Nest patterns together for clear, explicit control flow:

```typescript
import { retry, timeout, fallback, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

async function robustAI(prompt: string): Promise<string> {
  const result = await fallback<string>({
    execute: async () => {
      return await timeout<string>({
        execute: async () => {
          const retryResult = await retry<string>({
            execute: async () => {
              const { text } = await generateText({
                model: openai('gpt-4-turbo'),
                prompt,
                maxRetries: 0
              });
              return text;
            },
            maxAttempts: 3,
            backoffStrategy: BackoffStrategy.EXPONENTIAL
          });
          return retryResult.value;
        },
        timeoutMs: 10000
      });
    },
    fallback: async () => "Fallback response"
  });

  return result.value;
}
```

### Middleware Composition (Advanced)

For complex workflows, use the `compose()` function:

```typescript
import { compose, retryMiddleware, timeoutMiddleware } from 'ai-patterns';

const pipeline = compose([
  timeoutMiddleware({ duration: 10000 }),
  retryMiddleware({ maxAttempts: 3 })
]);

const result = await pipeline(
  async (input) => generateText({ model: openai('gpt-4-turbo'), prompt: input }),
  'Your prompt here'
);
```

---

## API Reference

### Direct Composition (Pattern Nesting)

Simply nest pattern function calls:

```typescript
const result = await pattern1({
  execute: async () => {
    return await pattern2({
      execute: async () => {
        return await actualOperation();
      }
    });
  }
});
```

### `compose<TInput, TOutput>(middlewares, config?)`

Create a composed function from middleware.

#### Parameters

```typescript
interface ComposeConfig<TInput, TOutput> {
  /**
   * Called before execution starts
   */
  onStart?: () => void | Promise<void>;

  /**
   * Called after successful execution
   */
  onComplete?: (result: TOutput, duration: number) => void | Promise<void>;

  /**
   * Called on error
   */
  onError?: (error: Error) => void | Promise<void>;
}
```

#### Returns

A composed function that accepts an execution function and input:

```typescript
(execute: (input: TInput) => TOutput | Promise<TOutput>, input?: TInput) => Promise<TOutput>
```

---

## Examples

### Example 1: Production AI Pipeline (Direct Composition)

```typescript
import { retry, timeout, fallback, memoize, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

interface PromptInput {
  prompt: string;
  userId?: string;
}

// Create memoized AI function
const cachedAI = memoize<[PromptInput], string>({
  execute: async (input: PromptInput) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: input.prompt,
      maxRetries: 0
    });
    return text;
  },
  ttl: 5 * 60 * 1000,
  keyFn: (input) => input.prompt
});

// Compose patterns together
async function robustAI(input: PromptInput): Promise<string> {
  const result = await fallback<string>({
    execute: async () => {
      return await timeout<string>({
        execute: async () => {
          const retryResult = await retry<string>({
            execute: async () => await cachedAI(input),
            maxAttempts: 3,
            backoffStrategy: BackoffStrategy.EXPONENTIAL
          });
          return retryResult.value;
        },
        timeoutMs: 10000
      });
    },
    fallback: async () => "I'm having trouble right now. Please try again later."
  });

  return result.value;
}

// Usage
const response = await robustAI({ prompt: 'Explain quantum computing' });
console.log(response);
```

### Example 2: Middleware Composition with Lifecycle Hooks

```typescript
import {
  compose,
  retryMiddleware,
  timeoutMiddleware,
  fallbackMiddleware
} from 'ai-patterns';

const pipeline = compose(
  [
    fallbackMiddleware({ fallback: async () => getCachedResponse() }),
    timeoutMiddleware({ duration: 10000 }),
    retryMiddleware({ maxAttempts: 3 })
  ],
  {
    onStart: () => console.log('🚀 Starting AI request'),
    onComplete: (result, duration) => {
      console.log(`✅ Completed in ${duration}ms`);
      metrics.recordLatency(duration);
    },
    onError: (error) => {
      console.error('❌ Pipeline failed:', error);
      alerting.trigger('ai-pipeline-failure', { error });
    }
  }
);

const result = await pipeline(
  async (input) => callAI(input),
  { prompt: 'Your prompt here' }
);
```

### Example 3: Multi-Provider Fallback

```typescript
import { retry, timeout, fallback, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

async function multiProviderAI(prompt: string): Promise<string> {
  const result = await fallback<string>({
    execute: async () => {
      // Try OpenAI first
      return await timeout<string>({
        execute: async () => {
          const retryResult = await retry<string>({
            execute: async () => {
              const { text } = await generateText({
                model: openai('gpt-4-turbo'),
                prompt,
                maxRetries: 0
              });
              return text;
            },
            maxAttempts: 2,
            backoffStrategy: BackoffStrategy.EXPONENTIAL
          });
          return retryResult.value;
        },
        timeoutMs: 8000
      });
    },
    // Fallback to Claude if OpenAI fails
    fallback: async () => {
      const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt,
        maxRetries: 0
      });
      return text;
    }
  });

  return result.value;
}
```

### Example 4: Stateful Pattern Composition

```typescript
import { defineCircuitBreaker, retry, timeout } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Circuit breaker maintains state across calls
const breaker = defineCircuitBreaker({
  execute: async (prompt: string) => {
    return await timeout({
      execute: async () => {
        const retryResult = await retry({
          execute: async () => {
            const { text } = await generateText({
              model: openai('gpt-4-turbo'),
              prompt,
              maxRetries: 0
            });
            return text;
          },
          maxAttempts: 2
        });
        return retryResult.value;
      },
      timeoutMs: 5000
    });
  },
  failureThreshold: 5,
  resetTimeout: 60000
});

// Reuse the same breaker instance
const result1 = await breaker('First prompt');
const result2 = await breaker('Second prompt');
console.log(breaker.getState()); // Check circuit state
```

---

## Best Practices

### ✅ Do

1. **Use direct composition for clarity**
   ```typescript
   // Clear and explicit
   await retry({
     execute: async () => await timeout({
       execute: async () => await operation()
     })
   });
   ```

2. **Compose patterns in logical order**
   ```typescript
   // Fallback → Timeout → Retry → Cache → Actual operation
   fallback({ execute: async () =>
     timeout({ execute: async () =>
       retry({ execute: async () =>
         cachedOperation()
       })
     })
   });
   ```

3. **Use stateful patterns (define) for reusable instances**
   ```typescript
   const breaker = defineCircuitBreaker({ ... });
   await breaker(input1);
   await breaker(input2);
   ```

4. **Add lifecycle hooks for monitoring**
   ```typescript
   compose([...middlewares], {
     onComplete: (result, duration) => metrics.record(duration)
   });
   ```

5. **Cache expensive operations**
   ```typescript
   const cached = memoize({ execute: expensiveAI, ttl: 300000 });
   ```

### ❌ Don't

1. **Don't over-compose**
   ```typescript
   // Too many layers - hard to debug
   pattern1 → pattern2 → pattern3 → pattern4 → pattern5 → pattern6
   ```

2. **Don't compose patterns in wrong order**
   ```typescript
   // Wrong - timeout outside retry means total time limit
   timeout({ execute: async () => retry({ ... }) })

   // Right - each retry attempt has timeout
   retry({ execute: async () => timeout({ ... }) })
   ```

3. **Don't forget to extract result values**
   ```typescript
   // Wrong
   const result = await retry({ ... });
   console.log(result); // RetryResult object

   // Right
   const result = await retry({ ... });
   console.log(result.value); // Actual value
   ```

4. **Don't use middleware composition for simple cases**
   ```typescript
   // Overkill - just nest directly
   const pipeline = compose([retryMiddleware({ maxAttempts: 3 })]);

   // Better
   await retry({ execute: async () => operation(), maxAttempts: 3 });
   ```

### Production Checklist

- [ ] Patterns composed in logical order
- [ ] Timeout configured for all external calls
- [ ] Retry with exponential backoff
- [ ] Circuit breaker for external services
- [ ] Fallback strategy defined
- [ ] Caching for expensive operations
- [ ] Lifecycle hooks for monitoring
- [ ] Error handling implemented

---

## Related Patterns

### Retry Pattern

```typescript
import { retry } from 'ai-patterns';
```

**[→ Retry Pattern Documentation](./retry.md)**

### Timeout Pattern

```typescript
import { timeout } from 'ai-patterns';
```

**[→ Timeout Pattern Documentation](./timeout.md)**

### Circuit Breaker Pattern

```typescript
import { defineCircuitBreaker } from 'ai-patterns';
```

**[→ Circuit Breaker Pattern Documentation](./circuit-breaker.md)**

### Fallback Pattern

```typescript
import { fallback } from 'ai-patterns';
```

**[→ Fallback Pattern Documentation](./fallback.md)**

### Memoize Pattern

```typescript
import { memoize } from 'ai-patterns';
```

**[→ Memoize Pattern Documentation](./memoize.md)**

---

## Examples

- [Basic Composition Example](../../examples/composition/basic-compose.ts)
- [Advanced Middleware Composition](../../examples/composition/advanced-compose.ts)
- [Multi-Provider Fallback](../../examples/composition/multi-provider.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
