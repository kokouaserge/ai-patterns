# Compose Pattern

Compose multiple patterns together to build robust, production-ready AI workflows using functional composition.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Two Approaches](#two-approaches)
  - [Direct Nesting](#direct-nesting)
  - [Middleware Composition](#middleware-composition)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The compose pattern allows you to combine multiple resilience patterns into a single, reusable function. There are **two approaches** for composition:

1. **Direct nesting** - Explicit pattern composition by nesting function calls
2. **Middleware composition** - Functional composition using the `compose()` function

### Key Features

- **Direct pattern composition** - Nest patterns together for clear control flow
- **Type-safe** - Full TypeScript support with generics
- **Composable** - Patterns work together seamlessly
- **Observable** - Built-in lifecycle callbacks for monitoring

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

## Two Approaches

### Direct Nesting

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

**Pros:**
- Explicit and easy to understand
- Full control over each pattern's options
- Clear execution order

**Cons:**
- Can become deeply nested with many patterns
- Less reusable (tied to specific implementation)

### Middleware Composition

Use the `compose()` function for functional, middleware-based composition:

```typescript
import { compose, retryMiddleware, timeoutMiddleware, fallbackMiddleware } from 'ai-patterns/composition';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Create reusable composed function
const robustAI = compose<string, string>([
  fallbackMiddleware({ fallback: () => "Fallback response" }),
  timeoutMiddleware({ duration: 10000 }),
  retryMiddleware({ maxAttempts: 3, backoffStrategy: 'exponential' })
]);

// Use it multiple times
const result = await robustAI(
  async (prompt: string) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt,
      maxRetries: 0
    });
    return text;
  },
  'Explain quantum computing'
);
```

**Pros:**
- Flat, readable structure
- Highly reusable (separate concerns)
- Easy to add/remove patterns
- Follows functional programming principles

**Cons:**
- Requires understanding middleware concept
- Slightly less explicit than nesting

**Choose:**
- **Direct nesting** for one-off compositions or when clarity is paramount
- **Middleware composition** for reusable, configurable patterns

---

## API Reference

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

### Example 2: Multi-Provider Fallback

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

### Example 3: Stateful Pattern Composition

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

4. **Cache expensive operations**
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

### Production Checklist

- [ ] Patterns composed in logical order
- [ ] Timeout configured for all external calls
- [ ] Retry with exponential backoff
- [ ] Circuit breaker for external services
- [ ] Fallback strategy defined
- [ ] Caching for expensive operations
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
- [Multi-Provider Fallback](../../examples/composition/multi-provider.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
