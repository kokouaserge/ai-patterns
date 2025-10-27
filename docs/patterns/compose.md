# Compose Pattern

Middleware-based composition for building reusable, composable AI workflows.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [What is Middleware?](#what-is-middleware)
- [How compose() Works](#how-compose-works)
- [Built-in Middleware](#built-in-middleware)
- [Writing Custom Middleware](#writing-custom-middleware)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The compose pattern enables **middleware-based composition** where you build a pipeline of reusable middleware functions that wrap your operations. Each middleware can add behavior before, after, or around the execution.

```typescript
import { compose, retryMiddleware, timeoutMiddleware } from 'ai-patterns/composition';

// Create a reusable composed function
const robustAI = compose([
  loggingMiddleware,           // Custom middleware
  timeoutMiddleware({ duration: 5000 }),
  retryMiddleware({ maxAttempts: 3 })
]);

// Use it anywhere
const result = await robustAI(
  async (prompt: string) => callAI(prompt),
  "Explain quantum computing"
);
```

### Key Features

- **Middleware composition** - Build pipelines from reusable middleware functions
- **Custom middleware** - Write your own middleware for logging, metrics, error handling
- **Type-safe** - Full TypeScript support with generics
- **Functional** - Clean separation of concerns, easy to test

### Use Cases

- **Reusable AI pipelines** - Create pre-configured functions with retry, timeout, fallback
- **Cross-cutting concerns** - Add logging, metrics, tracing to any operation
- **Custom behavior** - Write middleware for domain-specific requirements

---

## Installation

```bash
npm install ai-patterns
```

---

## What is Middleware?

Middleware is a **higher-order function** that wraps another function, adding behavior around it.

```typescript
type Middleware<TInput, TOutput> = (
  next: (input: TInput) => Promise<TOutput>
) => (input: TInput) => Promise<TOutput>
```

A middleware:
1. Takes the `next` function in the chain
2. Returns a new function that wraps `next`
3. Can modify input, output, or handle errors

### Simple Example

```typescript
import type { Middleware } from 'ai-patterns/composition';

// Logging middleware
const loggingMiddleware: Middleware<any, any> = (next) => async (input) => {
  console.log('Input:', input);
  const result = await next(input);
  console.log('Output:', result);
  return result;
};

// Timing middleware
const timingMiddleware: Middleware<any, any> = (next) => async (input) => {
  const start = Date.now();
  const result = await next(input);
  console.log(`Took ${Date.now() - start}ms`);
  return result;
};
```

---

## How compose() Works

`compose()` builds a **middleware chain** by wrapping each middleware around the previous one.

```typescript
import { compose } from 'ai-patterns/composition';

const pipeline = compose<string, string>([
  middleware1,  // Outermost
  middleware2,
  middleware3   // Innermost
]);

// Execution flow:
// middleware1 → middleware2 → middleware3 → your function
```

**Execution order**: Right-to-left (like mathematical function composition)
- Middleware are applied from right to left
- Each middleware wraps the next one
- The final result is a function that applies all middleware in sequence

### Visualization

```typescript
compose([A, B, C])

// Creates this chain:
A(
  B(
    C(
      yourFunction
    )
  )
)

// Execution flows through:
// A → B → C → yourFunction → C → B → A
```

---

## Built-in Middleware

ai-patterns provides middleware adapters for all resilience patterns:

### retryMiddleware

```typescript
import { retryMiddleware } from 'ai-patterns/composition';

const middleware = retryMiddleware({
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000
});
```

### timeoutMiddleware

```typescript
import { timeoutMiddleware } from 'ai-patterns/composition';

const middleware = timeoutMiddleware({
  duration: 5000,
  message: 'Operation timed out'
});
```

### fallbackMiddleware

```typescript
import { fallbackMiddleware } from 'ai-patterns/composition';

const middleware = fallbackMiddleware({
  fallback: (input) => `Fallback response for: ${input}`
});
```

### circuitBreakerMiddleware

```typescript
import { circuitBreakerMiddleware } from 'ai-patterns/composition';

const middleware = circuitBreakerMiddleware({
  failureThreshold: 5,
  resetTimeout: 60000
});
```

### rateLimiterMiddleware

```typescript
import { rateLimiterMiddleware } from 'ai-patterns/composition';

const middleware = rateLimiterMiddleware({
  requests: 10,
  window: 1000
});
```

### cacheMiddleware

```typescript
import { cacheMiddleware } from 'ai-patterns/composition';

const middleware = cacheMiddleware({
  ttl: 300000,
  keyFn: (input) => JSON.stringify(input)
});
```

---

## Writing Custom Middleware

The real power of compose is writing **custom middleware** for your specific needs.

### Example 1: Logging Middleware

```typescript
import type { Middleware } from 'ai-patterns/composition';

const loggingMiddleware = <TInput, TOutput>(
  logger: Console = console
): Middleware<TInput, TOutput> => {
  return (next) => async (input) => {
    logger.log('[START]', input);
    try {
      const result = await next(input);
      logger.log('[SUCCESS]', result);
      return result;
    } catch (error) {
      logger.error('[ERROR]', error);
      throw error;
    }
  };
};
```

### Example 2: Metrics Middleware

```typescript
import type { Middleware } from 'ai-patterns/composition';

interface Metrics {
  recordDuration: (name: string, ms: number) => void;
  recordError: (name: string, error: Error) => void;
}

const metricsMiddleware = <TInput, TOutput>(
  name: string,
  metrics: Metrics
): Middleware<TInput, TOutput> => {
  return (next) => async (input) => {
    const start = Date.now();
    try {
      const result = await next(input);
      metrics.recordDuration(name, Date.now() - start);
      return result;
    } catch (error) {
      metrics.recordError(name, error as Error);
      throw error;
    }
  };
};
```

### Example 3: Input Validation Middleware

```typescript
import type { Middleware } from 'ai-patterns/composition';

const validationMiddleware = <TInput, TOutput>(
  validate: (input: TInput) => boolean,
  errorMessage: string = 'Invalid input'
): Middleware<TInput, TOutput> => {
  return (next) => async (input) => {
    if (!validate(input)) {
      throw new Error(errorMessage);
    }
    return await next(input);
  };
};
```

### Example 4: Error Transform Middleware

```typescript
import type { Middleware } from 'ai-patterns/composition';

const errorTransformMiddleware = <TInput, TOutput>(
  transform: (error: Error) => Error
): Middleware<TInput, TOutput> => {
  return (next) => async (input) => {
    try {
      return await next(input);
    } catch (error) {
      throw transform(error as Error);
    }
  };
};
```

### Example 5: Conditional Middleware

```typescript
import type { Middleware } from 'ai-patterns/composition';

const conditionalMiddleware = <TInput, TOutput>(
  condition: (input: TInput) => boolean,
  middleware: Middleware<TInput, TOutput>
): Middleware<TInput, TOutput> => {
  return (next) => async (input) => {
    if (condition(input)) {
      return await middleware(next)(input);
    }
    return await next(input);
  };
};
```

---

## Examples

### Example 1: Production AI Pipeline

```typescript
import { compose, retryMiddleware, timeoutMiddleware, fallbackMiddleware } from 'ai-patterns/composition';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { Middleware } from 'ai-patterns/composition';

// Custom logging middleware
const loggingMiddleware: Middleware<string, string> = (next) => async (input) => {
  console.log(`[AI] Processing: ${input}`);
  const start = Date.now();
  try {
    const result = await next(input);
    console.log(`[AI] Success in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`[AI] Error after ${Date.now() - start}ms:`, error);
    throw error;
  }
};

// Compose robust AI pipeline
const robustAI = compose<string, string>([
  loggingMiddleware,
  fallbackMiddleware({ fallback: () => "I'm having trouble right now. Please try again." }),
  timeoutMiddleware({ duration: 10000 }),
  retryMiddleware({ maxAttempts: 3, backoffStrategy: 'exponential' })
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
```

### Example 2: Multi-Provider with Metrics

```typescript
import { compose, retryMiddleware, timeoutMiddleware, fallbackMiddleware } from 'ai-patterns/composition';
import type { Middleware } from 'ai-patterns/composition';

// Metrics tracking
interface Metrics {
  duration: number;
  provider: string;
  success: boolean;
}

const metrics: Metrics[] = [];

const metricsMiddleware: Middleware<any, any> = (next) => async (input) => {
  const start = Date.now();
  try {
    const result = await next(input);
    metrics.push({
      duration: Date.now() - start,
      provider: input.provider || 'unknown',
      success: true
    });
    return result;
  } catch (error) {
    metrics.push({
      duration: Date.now() - start,
      provider: input.provider || 'unknown',
      success: false
    });
    throw error;
  }
};

const aiPipeline = compose([
  metricsMiddleware,
  fallbackMiddleware({
    fallback: (input) => callClaudeAI(input.prompt)
  }),
  timeoutMiddleware({ duration: 8000 }),
  retryMiddleware({ maxAttempts: 2 })
]);

const result = await aiPipeline(
  async (input: { prompt: string; provider: string }) => {
    return await callOpenAI(input.prompt);
  },
  { prompt: 'Explain quantum computing', provider: 'openai' }
);

console.log('Metrics:', metrics);
```

### Example 3: Input Validation and Sanitization

```typescript
import { compose, retryMiddleware } from 'ai-patterns/composition';
import type { Middleware } from 'ai-patterns/composition';

// Validation middleware
const validatePromptMiddleware: Middleware<string, string> = (next) => async (input) => {
  if (!input || input.trim().length === 0) {
    throw new Error('Prompt cannot be empty');
  }
  if (input.length > 1000) {
    throw new Error('Prompt too long (max 1000 characters)');
  }
  return await next(input);
};

// Sanitization middleware
const sanitizeMiddleware: Middleware<string, string> = (next) => async (input) => {
  const sanitized = input.trim().replace(/[<>]/g, '');
  return await next(sanitized);
};

const safeAI = compose<string, string>([
  validatePromptMiddleware,
  sanitizeMiddleware,
  retryMiddleware({ maxAttempts: 2 })
]);

const result = await safeAI(
  async (prompt: string) => callAI(prompt),
  '  What is quantum computing?  '
);
```

### Example 4: Reusable Configurations

```typescript
import { compose, retryMiddleware, timeoutMiddleware, fallbackMiddleware } from 'ai-patterns/composition';

// Create reusable configurations
const developmentConfig = compose([
  loggingMiddleware,
  timeoutMiddleware({ duration: 30000 })
]);

const productionConfig = compose([
  metricsMiddleware,
  fallbackMiddleware({ fallback: () => 'Service unavailable' }),
  timeoutMiddleware({ duration: 5000 }),
  retryMiddleware({ maxAttempts: 3, backoffStrategy: 'exponential' })
]);

// Use based on environment
const pipeline = process.env.NODE_ENV === 'production'
  ? productionConfig
  : developmentConfig;

const result = await pipeline(
  async (input: string) => callAI(input),
  'Explain quantum computing'
);
```

---

## Best Practices

### ✅ Do

1. **Write small, focused middleware**
   ```typescript
   // Good - single responsibility
   const loggingMiddleware: Middleware = (next) => async (input) => {
     console.log(input);
     return await next(input);
   };
   ```

2. **Compose middleware in logical order**
   ```typescript
   // Good - validation → metrics → retry → timeout
   compose([
     validationMiddleware,
     metricsMiddleware,
     retryMiddleware({ maxAttempts: 3 }),
     timeoutMiddleware({ duration: 5000 })
   ]);
   ```

3. **Make middleware reusable and configurable**
   ```typescript
   // Good - configurable
   const loggingMiddleware = (logger: Logger) => (next) => async (input) => {
     logger.log(input);
     return await next(input);
   };
   ```

4. **Use TypeScript generics for type safety**
   ```typescript
   // Good - type-safe
   const middleware = <TInput extends string, TOutput>(
     // ...
   ): Middleware<TInput, TOutput> => { ... };
   ```

5. **Handle errors properly**
   ```typescript
   // Good - catch and re-throw
   const middleware: Middleware = (next) => async (input) => {
     try {
       return await next(input);
     } catch (error) {
       // Handle or transform error
       throw error;
     }
   };
   ```

### ❌ Don't

1. **Don't create god middleware**
   ```typescript
   // Bad - doing too much
   const everythingMiddleware: Middleware = (next) => async (input) => {
     validate(input);
     const sanitized = sanitize(input);
     log(sanitized);
     const metrics = startMetrics();
     try {
       const result = await next(sanitized);
       metrics.success();
       cache(result);
       return transform(result);
     } catch (error) {
       metrics.error();
       throw transformError(error);
     }
   };
   ```

2. **Don't ignore errors silently**
   ```typescript
   // Bad - swallowing errors
   const middleware: Middleware = (next) => async (input) => {
     try {
       return await next(input);
     } catch (error) {
       return null; // Bad!
     }
   };
   ```

3. **Don't mutate input**
   ```typescript
   // Bad - mutating input
   const middleware: Middleware = (next) => async (input) => {
     input.processed = true; // Bad!
     return await next(input);
   };

   // Good - return new object
   const middleware: Middleware = (next) => async (input) => {
     const modified = { ...input, processed: true };
     return await next(modified);
   };
   ```

### Production Checklist

- [ ] Middleware composed in logical order
- [ ] Error handling in each middleware
- [ ] Timeout configured for external calls
- [ ] Retry with exponential backoff
- [ ] Fallback strategy defined
- [ ] Logging and metrics in place
- [ ] Input validation implemented
- [ ] Type safety maintained

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

---

## Examples

- [Basic Composition Example](../../examples/composition/basic-compose.ts)
- [Custom Middleware Example](../../examples/composition/custom-middleware.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
