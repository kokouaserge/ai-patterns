# Bulkhead Pattern

Isolate resources with concurrency limits and queueing. Prevents resource exhaustion and protects critical AI operations.

## Overview

The bulkhead pattern limits concurrent executions and queues excess requests, preventing system overload. Named after ship bulkheads that contain flooding.

### Key Features

- **Concurrency control** - Limit simultaneous executions
- **Request queueing** - Queue excess requests
- **Queue timeout** - Prevent infinite waits
- **Resource isolation** - Protect critical operations

### Use Cases

- **AI API calls** - Limit concurrent OpenAI/Claude calls
- **Database connections** - Pool management
- **Heavy computations** - CPU-intensive tasks
- **External services** - Prevent overwhelming APIs

---

## Basic Usage

```typescript
import { defineBulkhead } from 'ai-patterns';

const protectedCall = defineBulkhead({
  execute: async () => {
    return await heavyComputation();
  },
  maxConcurrent: 5,   // Max 5 simultaneous
  maxQueue: 100       // Queue up to 100 requests
});

// Launch 200 requests - only 5 run at once
const promises = Array.from({ length: 200 }, () => protectedCall());
await Promise.all(promises);
```

---

## API Reference

### `defineBulkhead<TResult>(options): CallableBulkhead<TResult>`

#### Options

```typescript
interface BulkheadOptions<TResult> {
  execute: AsyncFunction<TResult>;
  maxConcurrent?: number;    // Default: 10
  maxQueue?: number;         // Default: 100
  queueTimeout?: number;     // Default: undefined
  logger?: Logger;
  onQueued?: (queueSize: number) => void;
  onQueueFull?: () => void;
  onExecute?: () => void;
}
```

#### Result

```typescript
interface BulkheadResult<T> {
  value: T;
  queueTime: number;      // Time spent waiting (ms)
  executionTime: number;  // Time spent executing (ms)
}
```

---

## Examples

### AI Batch Processing

```typescript
import { defineBulkhead } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const aiProcess = defineBulkhead({
  execute: async (item: string) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: `Process: ${item}`
    });
    return text;
  },
  maxConcurrent: 3,  // OpenAI rate limit
  maxQueue: 50,
  queueTimeout: 30000,

  onQueued: (size) => {
    console.log(`Queued (${size} waiting)`);
  }
});

// Process 100 items - max 3 at once
const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
const results = await Promise.all(
  items.map(item => aiProcess())
);
```

### Database Connection Pool

```typescript
const dbQuery = defineBulkhead({
  execute: async (sql: string) => {
    return await db.query(sql);
  },
  maxConcurrent: 20,  // Connection pool size
  maxQueue: 500,

  onQueueFull: () => {
    metrics.increment('db.queue.full');
  }
});
```

---

## Best Practices

### ✅ Do

1. **Set appropriate limits** - Based on service capacity
2. **Monitor queue size** - Alert if growing
3. **Set queue timeout** - Prevent infinite waits
4. **Use with circuit breaker** - Double protection

### ❌ Don't

1. **Don't set too low** - Poor throughput
2. **Don't forget timeouts** - Can cause deadlocks
3. **Don't share bulkheads** - Isolate different resources

---

## Related Patterns

- **[Circuit Breaker](./circuit-breaker.md)** - Fail fast protection
- **[Rate Limiter](./rate-limiter.md)** - Time-based limits

---

**[← Back to Documentation](../../README.md#patterns)**
