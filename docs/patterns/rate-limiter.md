# Rate Limiter Pattern

Control request throughput with multiple strategies to prevent API abuse and protect resources.

## Overview

The **Rate Limiter** pattern controls how many operations can execute within a time window. Perfect for:

- API rate limiting (internal/external)
- Protecting database from overload
- Preventing abuse/spam
- Complying with third-party API limits
- Resource throttling

### Key Features

- 🚦 **3 Strategies** - Sliding Window, Fixed Window, Token Bucket
- 📊 **Request Tracking** - Remaining requests and reset time
- ⚡ **Low Overhead** - Efficient in-memory tracking
- 🎯 **Type-Safe** - Full TypeScript generics support
- 🔔 **Callbacks** - `onLimitReached` for monitoring
- 🔄 **Configurable** - Flexible limits and windows

---

## API Reference

### Basic Usage

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

// Vercel-style: callable function with attached methods
const apiCall = defineRateLimiter({
  execute: () => callAPI(),
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  strategy: RateLimitStrategy.SLIDING_WINDOW
});

// Direct call (Vercel-style)
const result = await apiCall();
console.log(`${result.remaining} requests remaining`);

// Utility methods
console.log(apiCall.getRemaining()); // Check remaining requests
apiCall.reset();                     // Reset limiter
```

### With Type Safety

```typescript
interface ApiResponse {
  data: string[];
  timestamp: number;
}

const apiCall = defineRateLimiter<ApiResponse>({
  execute: () => fetch('/api/data').then(r => r.json()),
  maxRequests: 10,
  windowMs: 60000
});

// Direct call (Vercel-style)
const result = await apiCall();
console.log(result.value.data);  // ✅ Fully typed
console.log(result.remaining);    // Requests left
console.log(result.resetAt);      // Reset timestamp

// Wait mode: automatically waits if limit reached
const result2 = await apiCall.wait(); // ✅ Waits for rate limit window
```

### CallableRateLimiter

Returns a **callable function** (Vercel-style) with attached utility methods.

```typescript
interface CallableRateLimiter<TResult> {
  // Direct callable (like Vercel's defineFlow)
  (): Promise<RateLimitResult<TResult>>;

  // Wait for rate limit if needed
  wait(): Promise<RateLimitResult<TResult>>;

  // Utility methods
  getRemaining(): number;
  reset(): void;
}
```

### RateLimiterOptions<TResult>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `execute` | `() => Promise<TResult>` | ✅ Yes | - | Function to execute with rate limiting |
| `maxRequests` | `number` | ❌ No | `100` | Maximum requests allowed in window |
| `windowMs` | `number` | ❌ No | `60000` | Time window in milliseconds (1 minute) |
| `strategy` | `RateLimitStrategy` | ❌ No | `SLIDING_WINDOW` | Rate limiting strategy |
| `refillRate` | `number` | ❌ No | `auto` | Token bucket: tokens per second |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for events |
| `onLimitReached` | `(retryAfter: number) => void` | ❌ No | `undefined` | Callback when limit is hit |

### RateLimitStrategy Enum

```typescript
enum RateLimitStrategy {
  SLIDING_WINDOW = 'SLIDING_WINDOW',  // Most accurate
  FIXED_WINDOW = 'FIXED_WINDOW',      // Simple, potential bursts
  TOKEN_BUCKET = 'TOKEN_BUCKET'       // Best for bursts
}
```

**Comparison:**

| Strategy | Accuracy | Memory | Burst Handling | Use Case |
|----------|----------|--------|----------------|----------|
| `SLIDING_WINDOW` | ⭐⭐⭐ Highest | Medium | Good | APIs with strict limits |
| `FIXED_WINDOW` | ⭐⭐ Medium | Low | Poor | Simple use cases |
| `TOKEN_BUCKET` | ⭐⭐ Good | Low | ⭐⭐⭐ Best | Handling traffic spikes |

### RateLimitResult<T>

```typescript
interface RateLimitResult<T> {
  value: T;         // Successful result
  remaining: number; // Requests left in window
  resetAt: number;   // Unix timestamp when limit resets
}
```

---

## Strategies Explained

### 1. Sliding Window (Recommended)

Most accurate - tracks exact request times within a rolling window.

```typescript
const limiter = defineRateLimiter({
  execute: () => callAPI(),
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  strategy: RateLimitStrategy.SLIDING_WINDOW
});
```

**How it works:**
- Tracks timestamp of each request
- Removes old requests outside the window
- Most accurate but uses more memory

**Use when:** You need precise rate limiting (e.g., external API compliance)

### 2. Fixed Window

Simple strategy - resets counter at fixed intervals.

```typescript
const limiter = defineRateLimiter({
  execute: () => callAPI(),
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.FIXED_WINDOW
});
```

**How it works:**
- Counter resets at fixed intervals (e.g., every minute)
- Allows bursts at window boundaries

**Use when:** Simplicity matters more than precision

### 3. Token Bucket

Best for handling bursts - refills tokens over time.

```typescript
const limiter = defineRateLimiter({
  execute: () => callAPI(),
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.TOKEN_BUCKET,
  refillRate: 10 // 10 tokens per second
});
```

**How it works:**
- Bucket holds tokens (max = maxRequests)
- Each request consumes 1 token
- Tokens refill at specified rate

**Use when:** You need to allow occasional bursts

---

## Examples

### Example 1: API Rate Limiting

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

interface ApiData {
  results: string[];
  total: number;
}

const limiter = defineRateLimiter<ApiData>({
  execute: () => fetch('https://api.example.com/data').then(r => r.json()),
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  onLimitReached: (retryAfter) => {
    console.log(`Rate limit hit. Retry after ${retryAfter}ms`);
  }
});

// Call API
const result = await limiter.execute();
console.log(result.value.results);
console.log(`${result.remaining} requests remaining`);
console.log(`Resets at ${new Date(result.resetAt)}`);
```

### Example 2: Database Query Throttling

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

interface QueryResult {
  rows: any[];
  count: number;
}

// Limit to 50 queries per second
const dbLimiter = defineRateLimiter<QueryResult>({
  execute: () => db.query(expensiveQuery),
  maxRequests: 50,
  windowMs: 1000, // 1 second
  strategy: RateLimitStrategy.TOKEN_BUCKET,
  logger: dbLogger
});

const result = await dbLimiter.execute();
console.log(`Query returned ${result.value.count} rows`);
```

### Example 3: Third-Party API Compliance

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

// OpenAI: 3 requests per minute on free tier
const openaiLimiter = defineRateLimiter({
  execute: () => openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  }),
  maxRequests: 3,
  windowMs: 60000,
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  onLimitReached: (retryAfter) => {
    console.log(`OpenAI limit reached. Wait ${retryAfter}ms`);
    metrics.increment('openai.rate_limit');
  }
});

const result = await openaiLimiter.execute();
console.log(result.value.choices[0].message.content);
```

### Example 4: User Action Throttling

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

// Prevent spam: 10 actions per minute per user
const userLimiters = new Map();

function getUserLimiter(userId: string) {
  if (!userLimiters.has(userId)) {
    userLimiters.set(userId, defineRateLimiter({
      execute: () => performUserAction(userId),
      maxRequests: 10,
      windowMs: 60000,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      onLimitReached: () => {
        logger.warn(`User ${userId} hit rate limit`);
      }
    }));
  }
  return userLimiters.get(userId);
}

// Usage
const limiter = getUserLimiter('user-123');
try {
  const result = await limiter.execute();
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return { error: 'Too many requests. Please slow down.' };
  }
}
```

### Example 5: Burst Traffic with Token Bucket

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

// Allow bursts but limit average rate
const limiter = defineRateLimiter({
  execute: () => processRequest(),
  maxRequests: 100,      // Bucket capacity
  windowMs: 60000,       // 1 minute
  strategy: RateLimitStrategy.TOKEN_BUCKET,
  refillRate: 10,        // 10 tokens/second (600/minute average)
  logger: customLogger
});

// Can handle bursts up to 100 requests
// But sustained rate is 600/minute
const result = await limiter.execute();
```

---

## Error Handling

### Rate Limit Exceeded

```typescript
import { defineRateLimiter } from 'ai-patterns';

const limiter = defineRateLimiter({
  execute: () => callAPI(),
  maxRequests: 10,
  windowMs: 60000
});

try {
  const result = await limiter.execute();
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.error('Rate limit exceeded');
    console.error('Retry after:', error.retryAfter, 'ms');
    console.error('Reset at:', new Date(error.resetAt));

    // Wait and retry
    await new Promise(r => setTimeout(r, error.retryAfter));
    return await limiter.execute();
  }
}
```

### Rate Limit Error Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'RATE_LIMIT_EXCEEDED'` | Error code |
| `retryAfter` | `number` | Milliseconds until retry allowed |
| `resetAt` | `number` | Unix timestamp when limit resets |
| `message` | `string` | Error message |

---

## Best Practices

### ✅ Do's

1. **Choose Appropriate Strategy**
   ```typescript
   // For strict API compliance
   strategy: RateLimitStrategy.SLIDING_WINDOW

   // For handling traffic spikes
   strategy: RateLimitStrategy.TOKEN_BUCKET

   // For simple cases
   strategy: RateLimitStrategy.FIXED_WINDOW
   ```

2. **Set Realistic Limits**
   ```typescript
   // Good: Based on actual API limits
   const limiter = defineRateLimiter({
     execute: () => callThirdPartyAPI(),
     maxRequests: 100, // Provider allows 100/min
     windowMs: 60000
   });
   ```

3. **Monitor Rate Limits**
   ```typescript
   const limiter = defineRateLimiter({
     execute: () => task(),
     maxRequests: 100,
     windowMs: 60000,
     onLimitReached: (retryAfter) => {
       metrics.increment('rate_limit.hit');
       logger.warn('Rate limit hit', { retryAfter });
     }
   });
   ```

4. **Return Limit Info to Clients**
   ```typescript
   const result = await limiter.execute();

   // Include in API response headers
   res.set('X-RateLimit-Remaining', result.remaining);
   res.set('X-RateLimit-Reset', result.resetAt);
   ```

### ❌ Don'ts

1. **Don't Use Same Limiter for Different Resources**
   ```typescript
   // Bad: One limiter for all APIs
   const limiter = defineRateLimiter({ ... });
   await limiter.execute(() => callAPIv1());
   await limiter.execute(() => callAPIv2()); // Wrong!

   // Good: Separate limiters
   const v1Limiter = defineRateLimiter({ ... });
   const v2Limiter = defineRateLimiter({ ... });
   ```

2. **Don't Ignore Limit Errors**
   ```typescript
   // Bad: Silent failure
   try {
     await limiter.execute();
   } catch (error) {
     // Ignored - user gets no feedback
   }

   // Good: Proper error handling
   try {
     await limiter.execute();
   } catch (error) {
     if (error.code === 'RATE_LIMIT_EXCEEDED') {
       return { error: `Rate limit. Retry in ${error.retryAfter}ms` };
     }
   }
   ```

3. **Don't Set Limits Too Low**
   ```typescript
   // Bad: Too restrictive
   maxRequests: 1,
   windowMs: 60000 // 1 request per minute - too strict!

   // Good: Reasonable limit
   maxRequests: 100,
   windowMs: 60000 // 100 requests per minute
   ```

---

## Production Configuration

### External API Compliance

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

const limiter = defineRateLimiter({
  execute: () => fetch('https://api.provider.com'),
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.SLIDING_WINDOW, // Most accurate
  onLimitReached: (retryAfter) => {
    metrics.increment('api.rate_limit');
    logger.warn('External API rate limit', { retryAfter });
  }
});
```

### Database Protection

```typescript
const dbLimiter = defineRateLimiter({
  execute: () => db.query(query),
  maxRequests: 1000,
  windowMs: 1000, // 1000 queries per second
  strategy: RateLimitStrategy.TOKEN_BUCKET, // Allow bursts
  logger: dbLogger
});
```

### User-Facing API

```typescript
// Per-user rate limiting
function createUserLimiter(userId: string) {
  return defineRateLimiter({
    execute: () => handleUserRequest(userId),
    maxRequests: 60,
    windowMs: 60000, // 60 requests per minute
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    onLimitReached: (retryAfter) => {
      logger.warn(`User ${userId} rate limited`, { retryAfter });
    }
  });
}
```

---

## Pattern Composition

### Rate Limiter + Retry

```typescript
import { retry, rateLimiter, BackoffStrategy, RateLimitStrategy } from 'ai-patterns';

const limiter = defineRateLimiter({
  execute: async () => {
    return await retry({
      execute: () => unstableAPI(),
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    });
  },
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.SLIDING_WINDOW
});
```

### Rate Limiter + Circuit Breaker

```typescript
import { defineCircuitBreaker, defineRateLimiter, RateLimitStrategy } from 'ai-patterns';

const limiter = defineRateLimiter({
  execute: async () => {
    const breaker = defineCircuitBreaker({
      execute: () => externalAPI(),
      failureThreshold: 5
    });
    return await breaker.execute();
  },
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.SLIDING_WINDOW
});
```

---

## Related Patterns

- **[Circuit Breaker](./circuit-breaker.md)** - Prevent failures when rate limits are hit
- **[Retry](./retry.md)** - Retry after rate limit resets
- **[Timeout](./timeout.md)** - Add time limits to rate-limited operations

---

## Additional Resources

- [Rate Limiting Strategies](https://en.wikipedia.org/wiki/Rate_limiting)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Best Practices Guide](../guides/best-practices.md)
