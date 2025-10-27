# Timeout Pattern

Add time limits to async operations with AbortSignal support and automatic cleanup.

## Overview

The **Timeout** pattern prevents operations from running indefinitely by enforcing time limits. Perfect for:

- API calls that might hang
- Database queries
- Long-running computations
- External service calls
- User-facing operations (UX timeout)

### Key Features

- ⏱️ **Time Limits** - Enforce maximum duration for operations
- 🛑 **AbortSignal Support** - Native cancellation support
- 🔄 **Automatic Cleanup** - Cleans up resources on timeout
- 📊 **Duration Tracking** - Returns operation duration
- 🎯 **Type-Safe** - Full TypeScript generics support
- 🔔 **Callbacks** - `onTimeout` for custom handling

---

## API Reference

### Basic Usage

```typescript
import { timeout } from 'ai-patterns';

const result = await timeout({
  execute: () => longRunningTask(),
  timeoutMs: 5000
});

console.log(result.value);    // Task result
console.log(result.duration); // Time taken (ms)
```

### With Type Safety

```typescript
interface ApiResponse {
  data: string[];
  status: number;
}

const result = await timeout<ApiResponse>({
  execute: () => fetch('/api/data').then(r => r.json()),
  timeoutMs: 10000
});

console.log(result.value.data); // ✅ Fully typed
```

### TimeoutOptions<TResult>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `execute` | `() => Promise<TResult>` | ✅ Yes | - | Function to execute with timeout |
| `timeoutMs` | `number` | ✅ Yes | - | Timeout duration in milliseconds |
| `message` | `string` | ❌ No | `'Operation timed out'` | Custom error message |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for timeout events |
| `onTimeout` | `() => void` | ❌ No | `undefined` | Callback invoked on timeout |
| `signal` | `AbortSignal` | ❌ No | `undefined` | External abort signal |

### TimeoutResult<T>

```typescript
interface TimeoutResult<T> {
  value: T;         // Successful result
  duration: number; // Operation duration (ms)
  timedOut: false;  // Always false on success
}
```

### TimeoutError

```typescript
interface TimeoutError extends PatternError {
  duration: number; // Duration before timeout (ms)
  timedOut: true;   // Always true for timeout errors
  code: 'TIMEOUT_EXCEEDED';
}
```

### TimeoutDurations

Pre-defined timeout durations for common scenarios:

```typescript
const TimeoutDurations = {
  VERY_SHORT: 1000,   // 1 second
  SHORT: 5000,        // 5 seconds
  MEDIUM: 10000,      // 10 seconds
  LONG: 30000,        // 30 seconds
  VERY_LONG: 60000,   // 1 minute
  EXTENDED: 300000    // 5 minutes
};
```

---

## Examples

### Example 1: Basic Timeout

```typescript
import { timeout, TimeoutDurations } from 'ai-patterns';

const result = await timeout({
  execute: async () => {
    const response = await fetch('https://api.example.com/data');
    return await response.json();
  },
  timeoutMs: TimeoutDurations.SHORT // 5 seconds
});

console.log(result.value);
console.log(`Completed in ${result.duration}ms`);
```

### Example 2: Database Query with Timeout

```typescript
import { timeout, TimeoutDurations } from 'ai-patterns';

interface User {
  id: string;
  name: string;
  email: string;
}

try {
  const result = await timeout<User[]>({
    execute: () => db.users.findMany({ limit: 100 }),
    timeoutMs: TimeoutDurations.MEDIUM, // 10 seconds
    onTimeout: () => {
      console.log('Query exceeded 10s - investigate slow query');
    }
  });

  console.log(`Found ${result.value.length} users`);
} catch (error) {
  if (error.timedOut) {
    console.error('Database query timed out');
  }
}
```

### Example 3: AI Model Inference with Timeout

```typescript
import { timeout } from 'ai-patterns';

interface AIResponse {
  completion: string;
  tokensUsed: number;
}

const result = await timeout<AIResponse>({
  execute: () => openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  }),
  timeoutMs: 30000, // 30 seconds max
  message: 'AI model inference timed out',
  onTimeout: () => {
    metrics.increment('ai.timeout');
  }
});

console.log(result.value.completion);
```

### Example 4: External AbortSignal

```typescript
import { timeout } from 'ai-patterns';

// Create external abort controller
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const result = await timeout({
    execute: () => fetch('https://api.example.com', {
      signal: controller.signal
    }),
    timeoutMs: 10000,
    signal: controller.signal // Pass external signal
  });

  console.log(result.value);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Cancelled by external signal');
  } else if (error.timedOut) {
    console.log('Operation timed out');
  }
}
```

### Example 5: Timeout with Custom Error Handling

```typescript
import { timeout, TimeoutDurations } from 'ai-patterns';

interface TaskResult {
  processed: number;
  status: 'completed' | 'partial';
}

async function processWithTimeout(): Promise<TaskResult> {
  try {
    const result = await timeout<TaskResult>({
      execute: () => processLargeDataset(),
      timeoutMs: TimeoutDurations.LONG, // 30 seconds
      message: 'Data processing exceeded time limit',
      logger: customLogger
    });

    return result.value;
  } catch (error) {
    if (error.timedOut) {
      // Return partial results
      return {
        processed: error.duration,
        status: 'partial'
      };
    }
    throw error;
  }
}
```

---

## Error Handling

### Timeout Errors

```typescript
import { timeout } from 'ai-patterns';

try {
  const result = await timeout({
    execute: () => verySlowOperation(),
    timeoutMs: 5000
  });
} catch (error) {
  if (error.timedOut) {
    console.error('Operation timed out after', error.duration, 'ms');
    console.error('Error code:', error.code); // 'TIMEOUT_EXCEEDED'
    console.error('Message:', error.message);
    console.error('Solution:', error.solution);
  }
}
```

### Timeout Error Properties

| Property | Type | Description |
|----------|------|-------------|
| `timedOut` | `true` | Indicates timeout error |
| `duration` | `number` | Duration before timeout (ms) |
| `code` | `'TIMEOUT_EXCEEDED'` | Error code |
| `message` | `string` | Error message |
| `solution` | `string` | Suggested fix |

---

## Best Practices

### ✅ Do's

1. **Set Realistic Timeouts**
   ```typescript
   // Good: Based on expected duration
   const result = await timeout({
     execute: () => fetchUser(),
     timeoutMs: 5000 // 5s is reasonable for API call
   });
   ```

2. **Use Pre-defined Durations**
   ```typescript
   import { TimeoutDurations } from 'ai-patterns';

   const result = await timeout({
     execute: () => task(),
     timeoutMs: TimeoutDurations.MEDIUM // Clear intent
   });
   ```

3. **Handle Timeout Gracefully**
   ```typescript
   try {
     const result = await timeout({ execute, timeoutMs: 5000 });
     return result.value;
   } catch (error) {
     if (error.timedOut) {
       return fallbackValue; // Graceful degradation
     }
     throw error;
   }
   ```

4. **Log Timeouts for Monitoring**
   ```typescript
   const result = await timeout({
     execute: () => task(),
     timeoutMs: 10000,
     onTimeout: () => {
       logger.warn('Task timeout', { operation: 'task' });
       metrics.increment('timeout.task');
     }
   });
   ```

### ❌ Don'ts

1. **Don't Use Too Short Timeouts**
   ```typescript
   // Bad: Too aggressive
   const result = await timeout({
     execute: () => fetch('/api/data'),
     timeoutMs: 100 // 100ms is too short for API
   });
   ```

2. **Don't Ignore Timeout Errors**
   ```typescript
   // Bad: Silent failure
   try {
     await timeout({ execute, timeoutMs: 5000 });
   } catch (error) {
     // No handling - user gets no feedback
   }
   ```

3. **Don't Set Arbitrary Timeouts**
   ```typescript
   // Bad: Magic number
   const result = await timeout({
     execute: () => task(),
     timeoutMs: 7349 // Why 7349ms?
   });

   // Good: Clear reasoning
   const result = await timeout({
     execute: () => task(),
     timeoutMs: TimeoutDurations.SHORT // 5s - standard API timeout
   });
   ```

---

## Production Configuration

### API Calls

```typescript
import { timeout, TimeoutDurations } from 'ai-patterns';

const result = await timeout({
  execute: () => fetch('/api/endpoint'),
  timeoutMs: TimeoutDurations.SHORT, // 5s
  onTimeout: () => {
    metrics.increment('api.timeout');
    logger.error('API timeout exceeded');
  }
});
```

### Database Queries

```typescript
const result = await timeout({
  execute: () => db.query(complexQuery),
  timeoutMs: TimeoutDurations.MEDIUM, // 10s
  message: 'Database query timeout - query may need optimization',
  logger: dbLogger
});
```

### AI/ML Inference

```typescript
const result = await timeout({
  execute: () => model.predict(input),
  timeoutMs: TimeoutDurations.LONG, // 30s
  onTimeout: () => {
    metrics.increment('ml.timeout');
    alerts.send('ML inference timeout');
  }
});
```

---

## Pattern Composition

### Timeout + Retry

```typescript
import { retry, timeout, BackoffStrategy, TimeoutDurations } from 'ai-patterns';

const result = await retry({
  execute: async () => {
    return await timeout({
      execute: () => unstableAPI(),
      timeoutMs: TimeoutDurations.SHORT
    });
  },
  maxAttempts: 3,
  backoffStrategy: BackoffStrategy.EXPONENTIAL
});
```

### Timeout + Circuit Breaker

```typescript
import { circuitBreaker, timeout, TimeoutDurations } from 'ai-patterns';

const breaker = circuitBreaker({
  execute: async () => {
    return await timeout({
      execute: () => externalService(),
      timeoutMs: TimeoutDurations.MEDIUM
    });
  },
  failureThreshold: 5,
  openDuration: 60000
});
```

---

## Related Patterns

- **[Retry](./retry.md)** - Combine with retry for timeout + automatic retry
- **[Circuit Breaker](./circuit-breaker.md)** - Prevent cascading failures from timeouts
- **[Rate Limiter](./rate-limiter.md)** - Control request rate before timeout occurs

---

## Additional Resources

- [AbortSignal API](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [Timeout Best Practices](../guides/best-practices.md)
- [Error Handling Guide](../guides/error-handling.md)
