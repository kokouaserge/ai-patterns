# Compose Pattern

Combine multiple patterns together to create reusable, composable AI workflows.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [How It Works](#how-it-works)
- [Available Patterns](#available-patterns)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The compose pattern allows you to **combine multiple resilience patterns** into a single, reusable function. Instead of nesting patterns deeply, compose them into a clean pipeline.

```typescript
import { compose, retry, timeout, fallback } from 'ai-patterns';

// Create a reusable composed function
const robustAI = compose([
  fallback({ fallback: () => "Sorry, service unavailable" }),
  timeout({ duration: 5000 }),
  retry({ maxAttempts: 3 })
]);

// Use it anywhere
const result = await robustAI(
  async (prompt) => callAI(prompt),
  "Explain quantum computing"
);
```

### Key Features

- **Reusable pipelines** - Define once, use everywhere
- **Clean composition** - No deep nesting
- **Type-safe** - Full TypeScript support
- **Flexible** - Combine any patterns together

### Use Cases

- **Production AI workflows** - Combine retry, timeout, circuit breaker, fallback
- **API calls** - Add resilience to external service calls
- **Reusable configurations** - Create pre-configured pipelines for different environments

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Step 1: Import compose and patterns

```typescript
import { compose, retry, timeout, fallback } from 'ai-patterns';
```

### Step 2: Create a composed function

```typescript
const robustAPI = compose([
  fallback({ fallback: () => "Fallback response" }),
  timeout({ duration: 5000 }),
  retry({ maxAttempts: 3, backoffStrategy: 'exponential' })
]);
```

### Step 3: Use the composed function

```typescript
const result = await robustAPI(
  async (input) => {
    // Your operation here
    return await fetch('/api/data');
  },
  inputData
);
```

---

## How It Works

`compose()` applies patterns from **right to left** (like mathematical function composition):

```typescript
compose([A, B, C])

// Equivalent to: A(B(C(yourFunction)))
// Execution order: C → B → A → yourFunction → A → B → C
```

**Example:**

```typescript
const pipeline = compose([
  fallback({ ... }),    // Applied 1st (outermost)
  timeout({ ... }),     // Applied 2nd
  retry({ ... })        // Applied 3rd (innermost)
]);

// When you call pipeline():
// 1. retry wraps your function (retries on failure)
// 2. timeout wraps retry (adds timeout)
// 3. fallback wraps timeout (provides fallback)
```

---

## Available Patterns

You can compose any of these patterns together:

### retry

Automatically retry failed operations with backoff strategies.

```typescript
retry({
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000
})
```

**[→ Retry Pattern Documentation](./retry.md)**

### timeout

Add timeout protection to operations.

```typescript
timeout({
  duration: 5000,
  message: 'Operation timed out'
})
```

**[→ Timeout Pattern Documentation](./timeout.md)**

### fallback

Provide fallback values or alternative strategies when operations fail.

```typescript
fallback({
  fallback: (input) => `Fallback for: ${input}`,
  shouldFallback: (error) => error.message.includes('timeout')
})
```

**[→ Fallback Pattern Documentation](./fallback.md)**

### circuitBreaker

Prevent cascading failures with circuit breaker pattern.

```typescript
circuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
})
```

**[→ Circuit Breaker Pattern Documentation](./circuit-breaker.md)**

### rateLimiter

Control request rate to avoid overwhelming services.

```typescript
rateLimiter({
  requests: 10,
  window: 1000
})
```

**[→ Rate Limiter Pattern Documentation](./rate-limiter.md)**

### cache

Cache expensive operations with TTL support.

```typescript
cache({
  ttl: 300000,
  keyFn: (input) => JSON.stringify(input)
})
```

**[→ Memoize Pattern Documentation](./memoize.md)**

---

## Examples

### Example 1: Production AI Pipeline

```typescript
import { compose, retry, timeout, fallback } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Create a robust AI function
const robustAI = compose([
  fallback({
    fallback: () => "I'm having trouble right now. Please try again later."
  }),
  timeout({ duration: 10000 }),
  retry({
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    initialDelay: 1000
  })
]);

// Use it
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

console.log(result);
```

### Example 2: Multi-Provider Fallback

```typescript
import { compose, retry, timeout, fallback } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const multiProviderAI = compose([
  fallback({
    fallback: async (prompt: string) => {
      // Fallback to Claude if OpenAI fails
      const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt,
        maxRetries: 0
      });
      return text;
    }
  }),
  timeout({ duration: 8000 }),
  retry({ maxAttempts: 2 })
]);

const result = await multiProviderAI(
  async (prompt: string) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt,
      maxRetries: 0
    });
    return text;
  },
  'What is AI?'
);
```

### Example 3: API with Circuit Breaker

```typescript
import { compose, retry, timeout, circuitBreaker } from 'ai-patterns';

const robustAPI = compose([
  circuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
    onOpen: () => console.log('Circuit breaker opened'),
    onClose: () => console.log('Circuit breaker closed')
  }),
  timeout({ duration: 5000 }),
  retry({ maxAttempts: 3 })
]);

// Use the same composed function for all API calls
const user = await robustAPI(
  async (id: string) => fetch(`/api/users/${id}`).then(r => r.json()),
  'user-123'
);

const posts = await robustAPI(
  async (userId: string) => fetch(`/api/posts?userId=${userId}`).then(r => r.json()),
  'user-123'
);
```

### Example 4: Rate-Limited AI Agent

```typescript
import { compose, retry, timeout, rateLimiter, cache } from 'ai-patterns';

const aiAgent = compose([
  cache({ ttl: 300000 }),  // 5 min cache
  rateLimiter({
    requests: 10,
    window: 60000,  // 10 requests per minute
    onLimitReached: (retryAfter) => console.log(`Rate limited. Retry after ${retryAfter}ms`)
  }),
  timeout({ duration: 15000 }),
  retry({ maxAttempts: 2 })
]);

// All requests share the same rate limiter and cache
for (const task of tasks) {
  const result = await aiAgent(
    async (input) => processTask(input),
    task
  );
  console.log(result);
}
```

### Example 5: Environment-Specific Configurations

```typescript
import { compose, retry, timeout, fallback } from 'ai-patterns';

// Development config - more permissive
const devPipeline = compose([
  timeout({ duration: 30000 }),
  retry({ maxAttempts: 1 })
]);

// Production config - aggressive resilience
const prodPipeline = compose([
  fallback({ fallback: () => 'Service temporarily unavailable' }),
  timeout({ duration: 5000 }),
  retry({
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    maxDelay: 10000
  })
]);

// Use based on environment
const pipeline = process.env.NODE_ENV === 'production'
  ? prodPipeline
  : devPipeline;

const result = await pipeline(
  async (query: string) => callDatabase(query),
  'SELECT * FROM users'
);
```

---

## Best Practices

### ✅ Do

1. **Compose patterns in logical order**
   ```typescript
   // Good: Fallback → Timeout → Retry
   compose([
     fallback({ ... }),
     timeout({ ... }),
     retry({ ... })
   ]);
   ```

2. **Create reusable configurations**
   ```typescript
   // Good: Define once, reuse everywhere
   const robustAPI = compose([...]);

   const user = await robustAPI(getUser, userId);
   const posts = await robustAPI(getPosts, userId);
   ```

3. **Use appropriate timeouts**
   ```typescript
   // Good: Timeout per retry attempt
   compose([
     timeout({ duration: 5000 }),
     retry({ maxAttempts: 3 })
   ]);
   // Total possible time: 15 seconds (3 × 5s)
   ```

4. **Add fallbacks for critical operations**
   ```typescript
   // Good: Always have a fallback
   compose([
     fallback({ fallback: () => defaultValue }),
     // ... other patterns
   ]);
   ```

5. **Share stateful patterns across calls**
   ```typescript
   // Good: Circuit breaker state shared across all calls
   const api = compose([
     circuitBreaker({ ... }),
     retry({ ... })
   ]);

   await api(operation1, input1);
   await api(operation2, input2);  // Same circuit breaker
   ```

### ❌ Don't

1. **Don't over-compose**
   ```typescript
   // Bad: Too many patterns, hard to reason about
   compose([
     pattern1,
     pattern2,
     pattern3,
     pattern4,
     pattern5,
     pattern6
   ]);

   // Good: 2-4 patterns maximum
   compose([
     fallback({ ... }),
     timeout({ ... }),
     retry({ ... })
   ]);
   ```

2. **Don't put timeout outside retry**
   ```typescript
   // Bad: Single timeout for all retries
   compose([
     timeout({ duration: 5000 }),
     retry({ maxAttempts: 3 })
   ]);
   // All 3 retries must complete in 5s total

   // Good: Timeout per retry
   compose([
     retry({ maxAttempts: 3 }),
     timeout({ duration: 5000 })
   ]);
   // Each retry has 5s timeout
   ```

3. **Don't ignore the composition order**
   ```typescript
   // Bad: Fallback innermost (defeats the purpose)
   compose([
     retry({ ... }),
     timeout({ ... }),
     fallback({ ... })
   ]);

   // Good: Fallback outermost (catches all failures)
   compose([
     fallback({ ... }),
     timeout({ ... }),
     retry({ ... })
   ]);
   ```

4. **Don't recreate composed functions unnecessarily**
   ```typescript
   // Bad: Creating new instance every time
   async function handler() {
     const api = compose([...]);  // ❌
     return await api(operation, input);
   }

   // Good: Create once, reuse
   const api = compose([...]);  // ✅

   async function handler() {
     return await api(operation, input);
   }
   ```

### Composition Order Guide

**Common pattern order** (from outermost to innermost):

1. **Fallback** - Catches all failures, provides fallback
2. **Circuit Breaker** - Prevents cascading failures
3. **Rate Limiter** - Controls request rate
4. **Timeout** - Adds time limit
5. **Retry** - Retries on failure
6. **Cache** - Caches results (innermost)

```typescript
const pipeline = compose([
  fallback({ ... }),       // 1. Outermost
  circuitBreaker({ ... }), // 2.
  rateLimiter({ ... }),    // 3.
  timeout({ ... }),        // 4.
  retry({ ... }),          // 5.
  cache({ ... })           // 6. Innermost
]);
```

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

### Rate Limiter Pattern
```typescript
import { defineRateLimiter } from 'ai-patterns';
```
**[→ Rate Limiter Pattern Documentation](./rate-limiter.md)**

---

## Examples

- [Basic Composition Example](../../examples/composition/basic-compose.ts)
- [Advanced Composition Example](../../examples/composition/advanced-compose.ts)
- [AI Agent Example](../../examples/composition/ai-agent.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
