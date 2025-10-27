# Idempotency Pattern

Ensure operations can be safely retried without duplicates or side effects.

## Overview

The **Idempotency** pattern guarantees that repeating the same operation multiple times produces the same result as executing it once. Perfect for:

- Payment processing (prevent double charges)
- Order creation (prevent duplicate orders)
- API requests (safe retries)
- Message processing (exactly-once semantics)
- Distributed systems (network failures)

### Key Features

- 🔑 **Keyed Operations** - Unique key per operation
- 💾 **Result Caching** - Store and reuse results
- ⏱️ **TTL Support** - Automatic expiration
- 🔄 **Concurrent Handling** - Wait or reject concurrent requests
- 🎯 **Type-Safe** - Full TypeScript generics
- 🗄️ **Pluggable Storage** - In-memory or custom stores
- 📊 **Cache Analytics** - Hit/miss tracking

---

## API Reference

### Basic Usage

```typescript
import { idempotent } from 'ai-patterns';

const result = await idempotent({
  execute: async () => {
    return await processPayment(paymentData);
  },
  key: `payment-${paymentData.id}`,
  ttl: 3600000 // 1 hour
});

console.log(result.transactionId);
```

### With Type Safety

```typescript
interface PaymentResult {
  transactionId: string;
  status: 'success' | 'failed';
  amount: number;
  timestamp: number;
}

const result = await idempotent<PaymentResult>({
  execute: async () => {
    return await stripe.charges.create({
      amount: 5000,
      currency: 'usd',
      source: token
    });
  },
  key: `payment-${orderId}`,
  ttl: 7200000, // 2 hours
  onCacheHit: (key, record) => {
    console.log(`Returning cached payment: ${key}`);
    console.log(`Cache hit count: ${record.hitCount}`);
  }
});

console.log(result.transactionId); // ✅ Fully typed
console.log(result.amount);        // ✅ Fully typed
```

### IdempotencyOptions<TResult>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `execute` | `() => Promise<TResult>` | ✅ Yes | - | Function to execute idempotently |
| `key` | `string` | ❌ No | `auto` | Idempotency key (recommended) |
| `keyGenerator` | `() => string` | ❌ No | `random` | Function to generate key |
| `ttl` | `number` | ❌ No | `3600000` | Cache TTL in milliseconds (1 hour) |
| `store` | `IdempotencyStore<TResult>` | ❌ No | `InMemoryStore` | Custom storage backend |
| `concurrentBehavior` | `ConcurrentBehavior` | ❌ No | `WAIT` | How to handle concurrent requests |
| `waitTimeout` | `number` | ❌ No | `30000` | Timeout when waiting (ms) |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for events |
| `onCacheHit` | `(key, record) => void` | ❌ No | `undefined` | Callback on cache hit |
| `onCacheMiss` | `(key) => void` | ❌ No | `undefined` | Callback on cache miss |

### IdempotencyStatus Enum

```typescript
enum IdempotencyStatus {
  IN_PROGRESS = 'IN_PROGRESS',  // Operation running
  COMPLETED = 'COMPLETED',      // Operation completed
  FAILED = 'FAILED'             // Operation failed
}
```

### ConcurrentBehavior Enum

```typescript
enum ConcurrentBehavior {
  WAIT = 'WAIT',      // Wait for concurrent request to complete
  REJECT = 'REJECT'   // Immediately reject concurrent request
}
```

### IdempotencyRecord<T>

```typescript
interface IdempotencyRecord<T> {
  key: string;
  result: T;
  createdAt: number;
  expiresAt: number;
  status: IdempotencyStatus;
  error?: Error;
  hitCount: number;
}
```

### IdempotencyStore Interface

```typescript
interface IdempotencyStore<T> {
  get(key: string): Promise<IdempotencyRecord<T> | null>;
  set(key: string, record: IdempotencyRecord<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

---

## Examples

### Example 1: Payment Processing

```typescript
import { idempotent } from 'ai-patterns';

interface PaymentResult {
  transactionId: string;
  status: 'success' | 'failed';
  amount: number;
}

async function processPayment(orderId: string, amount: number): Promise<PaymentResult> {
  return await idempotent<PaymentResult>({
    execute: async () => {
      // This will only execute once per orderId
      const charge = await stripe.charges.create({
        amount: amount * 100, // Convert to cents
        currency: 'usd',
        description: `Order ${orderId}`
      });

      return {
        transactionId: charge.id,
        status: charge.status === 'succeeded' ? 'success' : 'failed',
        amount: charge.amount / 100
      };
    },
    key: `payment-${orderId}`,
    ttl: 7200000, // 2 hours
    onCacheHit: (key, record) => {
      logger.info('Payment already processed', {
        orderId,
        transactionId: record.result.transactionId,
        hitCount: record.hitCount
      });
      metrics.increment('payment.cache_hit');
    },
    onCacheMiss: (key) => {
      logger.info('Processing new payment', { orderId });
      metrics.increment('payment.cache_miss');
    }
  });
}

// Multiple calls with same orderId return same result
const payment1 = await processPayment('order-123', 99.99);
const payment2 = await processPayment('order-123', 99.99); // Returns cached result
console.log(payment1.transactionId === payment2.transactionId); // true
```

### Example 2: Order Creation

```typescript
import { idempotent } from 'ai-patterns';

interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed';
}

async function createOrder(userId: string, cartId: string): Promise<Order> {
  return await idempotent<Order>({
    execute: async () => {
      // Fetch cart
      const cart = await db.carts.findById(cartId);

      // Create order
      const order = await db.orders.create({
        userId,
        items: cart.items,
        total: cart.total,
        status: 'pending'
      });

      // Clear cart
      await db.carts.delete(cartId);

      return order;
    },
    key: `order-${userId}-${cartId}`,
    ttl: 86400000, // 24 hours
    onCacheHit: (key) => {
      logger.warn('Duplicate order creation attempt prevented', { userId, cartId });
    }
  });
}

// Prevents duplicate orders from double-clicks, retries, etc.
const order = await createOrder('user-123', 'cart-456');
```

### Example 3: API Webhook Processing

```typescript
import { idempotent } from 'ai-patterns';

interface WebhookResult {
  processed: boolean;
  updatedRecords: number;
}

async function processWebhook(webhookId: string, payload: any): Promise<WebhookResult> {
  return await idempotent<WebhookResult>({
    execute: async () => {
      logger.info('Processing webhook', { webhookId });

      // Process webhook data
      const updates = await processWebhookData(payload);

      // Update database
      const updated = await db.records.updateMany(updates);

      return {
        processed: true,
        updatedRecords: updated.count
      };
    },
    key: `webhook-${webhookId}`,
    ttl: 3600000, // 1 hour
    onCacheHit: (key) => {
      logger.info('Webhook already processed', { webhookId });
      metrics.increment('webhook.duplicate');
    }
  });
}

// Webhooks can be safely retried without double-processing
await processWebhook('webhook-123', payload);
await processWebhook('webhook-123', payload); // Safe - returns cached result
```

### Example 4: Concurrent Request Handling

```typescript
import { idempotent, ConcurrentBehavior } from 'ai-patterns';

// WAIT mode (default): concurrent requests wait for first to complete
const resultWait = await idempotent({
  execute: async () => {
    await delay(5000); // Slow operation
    return await processData();
  },
  key: 'data-123',
  concurrentBehavior: ConcurrentBehavior.WAIT,
  waitTimeout: 10000 // Wait up to 10s
});

// REJECT mode: concurrent requests are immediately rejected
try {
  const resultReject = await idempotent({
    execute: async () => {
      return await processData();
    },
    key: 'data-456',
    concurrentBehavior: ConcurrentBehavior.REJECT
  });
} catch (error) {
  if (error.code === 'CONCURRENT_REQUEST') {
    console.log('Operation already in progress');
  }
}
```

### Example 5: Custom Redis Store

```typescript
import { idempotent, IdempotencyStore, IdempotencyRecord } from 'ai-patterns';
import Redis from 'ioredis';

class RedisIdempotencyStore<T> implements IdempotencyStore<T> {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<IdempotencyRecord<T> | null> {
    const data = await this.redis.get(key);
    if (!data) return null;

    const record = JSON.parse(data);

    // Check expiration
    if (Date.now() > record.expiresAt) {
      await this.delete(key);
      return null;
    }

    return record;
  }

  async set(key: string, record: IdempotencyRecord<T>): Promise<void> {
    const ttl = Math.floor((record.expiresAt - Date.now()) / 1000);
    await this.redis.setex(key, ttl, JSON.stringify(record));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    // Warning: This clears ALL keys
    await this.redis.flushdb();
  }
}

// Usage with Redis
const redis = new Redis();
const redisStore = new RedisIdempotencyStore(redis);

const result = await idempotent({
  execute: () => processPayment(),
  key: 'payment-123',
  store: redisStore, // Use Redis instead of in-memory
  ttl: 3600000
});
```

### Example 6: Message Queue Processing

```typescript
import { idempotent } from 'ai-patterns';

interface MessageResult {
  messageId: string;
  processed: boolean;
  retries: number;
}

async function processMessage(message: QueueMessage): Promise<MessageResult> {
  return await idempotent<MessageResult>({
    execute: async () => {
      logger.info('Processing message', { messageId: message.id });

      // Process message
      await handleMessage(message);

      // Mark as processed
      await db.messages.markProcessed(message.id);

      return {
        messageId: message.id,
        processed: true,
        retries: message.retryCount
      };
    },
    key: `message-${message.id}`,
    ttl: 86400000, // 24 hours
    onCacheHit: (key, record) => {
      logger.info('Message already processed', {
        messageId: message.id,
        originalTime: new Date(record.createdAt)
      });
    }
  });
}

// Safe to retry failed messages without duplicate processing
const result = await processMessage(message);
```

---

## Best Practices

### ✅ Do's

1. **Use Meaningful Keys**
   ```typescript
   // Good: Descriptive, unique keys
   key: `payment-${orderId}-${userId}`
   key: `webhook-${webhookId}`
   key: `order-${cartId}`

   // Bad: Generic keys
   key: 'request-123' // ❌ Not descriptive
   ```

2. **Set Appropriate TTL**
   ```typescript
   // Good: Based on operation type
   ttl: 7200000     // 2 hours for payments
   ttl: 3600000     // 1 hour for API calls
   ttl: 86400000    // 24 hours for orders

   // Bad: Too short or too long
   ttl: 1000        // ❌ 1 second - too short
   ttl: 31536000000 // ❌ 1 year - too long
   ```

3. **Handle Cache Hits**
   ```typescript
   const result = await idempotent({
     execute: () => processPayment(),
     key: `payment-${id}`,
     onCacheHit: (key, record) => {
       // ✅ Log for monitoring
       logger.info('Duplicate payment prevented', {
         key,
         originalTime: record.createdAt,
         hitCount: record.hitCount
       });
       metrics.increment('payment.duplicate_prevented');
     }
   });
   ```

4. **Use Custom Store for Production**
   ```typescript
   // ✅ Persist across restarts
   const redisStore = new RedisIdempotencyStore(redis);

   const result = await idempotent({
     execute: () => criticalOperation(),
     key: 'operation-123',
     store: redisStore // Shared across instances
   });
   ```

### ❌ Don'ts

1. **Don't Reuse Keys Across Different Operations**
   ```typescript
   // Bad: Same key for different operations
   await idempotent({
     execute: () => createOrder(),
     key: 'operation-123' // ❌ Generic
   });

   await idempotent({
     execute: () => processPayment(),
     key: 'operation-123' // ❌ Same key, different operation!
   });

   // Good: Unique keys per operation type
   key: `order-${orderId}`
   key: `payment-${paymentId}`
   ```

2. **Don't Skip the Key**
   ```typescript
   // Bad: No key specified
   const result = await idempotent({
     execute: () => processPayment()
     // ❌ No key - auto-generated (not idempotent across restarts)
   });

   // Good: Explicit key
   const result = await idempotent({
     execute: () => processPayment(),
     key: `payment-${orderId}` // ✅ Explicit key
   });
   ```

3. **Don't Use In-Memory Store in Distributed Systems**
   ```typescript
   // Bad: In-memory store with multiple instances
   const result = await idempotent({
     execute: () => processPayment(),
     key: 'payment-123'
     // ❌ Default in-memory store - not shared across instances
   });

   // Good: Shared store (Redis, DynamoDB, etc.)
   const result = await idempotent({
     execute: () => processPayment(),
     key: 'payment-123',
     store: redisStore // ✅ Shared across instances
   });
   ```

4. **Don't Ignore Concurrent Behavior**
   ```typescript
   // Bad: No consideration for concurrent requests
   const result = await idempotent({
     execute: () => slowOperation(),
     key: 'operation-123'
     // ❌ Default WAIT might cause timeouts
   });

   // Good: Configure based on use case
   const result = await idempotent({
     execute: () => slowOperation(),
     key: 'operation-123',
     concurrentBehavior: ConcurrentBehavior.REJECT, // ✅ Or WAIT with timeout
     waitTimeout: 60000 // 1 minute
   });
   ```

---

## Production Configuration

### Payment Processing

```typescript
import { idempotent } from 'ai-patterns';

const result = await idempotent({
  execute: () => stripe.charges.create(chargeData),
  key: `payment-${orderId}`,
  ttl: 7200000, // 2 hours
  store: redisStore, // Shared store
  concurrentBehavior: ConcurrentBehavior.WAIT,
  waitTimeout: 30000, // 30 seconds
  logger: productionLogger,
  onCacheHit: (key, record) => {
    logger.warn('Duplicate payment attempt', { key, hitCount: record.hitCount });
    metrics.increment('payment.duplicate');
    alerts.send('Duplicate payment detected', { key });
  }
});
```

### Order Creation

```typescript
const result = await idempotent({
  execute: () => createOrderInDB(orderData),
  key: `order-${userId}-${cartId}`,
  ttl: 86400000, // 24 hours
  store: dynamoDBStore, // DynamoDB for persistence
  logger: orderLogger,
  onCacheHit: (key) => {
    logger.info('Duplicate order prevented', { key });
    metrics.increment('order.duplicate_prevented');
  }
});
```

### Webhook Processing

```typescript
const result = await idempotent({
  execute: () => processWebhookPayload(payload),
  key: `webhook-${webhookId}`,
  ttl: 3600000, // 1 hour
  store: redisStore,
  concurrentBehavior: ConcurrentBehavior.REJECT, // Reject duplicates
  logger: webhookLogger
});
```

---

## Pattern Composition

### Idempotency + Retry

```typescript
import { idempotent, retry, BackoffStrategy } from 'ai-patterns';

const result = await idempotent({
  execute: async () => {
    return await retry({
      execute: () => unstablePaymentAPI(),
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    });
  },
  key: `payment-${orderId}`,
  ttl: 7200000
});
```

### Idempotency + Circuit Breaker

```typescript
import { idempotent, circuitBreaker } from 'ai-patterns';

const breaker = circuitBreaker({
  execute: () => externalAPI(),
  failureThreshold: 5
});

const result = await idempotent({
  execute: () => breaker.execute(),
  key: `api-call-${requestId}`,
  ttl: 3600000
});
```

### Idempotency + Timeout

```typescript
import { idempotent, timeout, TimeoutDurations } from 'ai-patterns';

const result = await idempotent({
  execute: async () => {
    return await timeout({
      execute: () => longOperation(),
      timeoutMs: TimeoutDurations.LONG
    });
  },
  key: `operation-${id}`,
  ttl: 3600000
});
```

---

## Storage Backends

### In-Memory (Default)

```typescript
import { InMemoryStore } from 'ai-patterns';

const store = new InMemoryStore();
store.startCleanup(60000); // Clean expired entries every minute

const result = await idempotent({
  execute: () => operation(),
  key: 'operation-123',
  store
});
```

**Pros:** Fast, zero dependencies
**Cons:** Not persistent, not shared across instances

### Redis

```typescript
import Redis from 'ioredis';

const redis = new Redis();
const redisStore = new RedisIdempotencyStore(redis);

const result = await idempotent({
  execute: () => operation(),
  key: 'operation-123',
  store: redisStore
});
```

**Pros:** Persistent, shared across instances, TTL support
**Cons:** Requires Redis

### DynamoDB

```typescript
import { DynamoDB } from 'aws-sdk';

const dynamoDB = new DynamoDB.DocumentClient();
const dynamoStore = new DynamoDBIdempotencyStore(dynamoDB, 'idempotency-table');

const result = await idempotent({
  execute: () => operation(),
  key: 'operation-123',
  store: dynamoStore
});
```

**Pros:** Serverless, auto-scaling, persistent
**Cons:** Requires AWS, higher latency than Redis

---

## Related Patterns

- **[Retry](./retry.md)** - Safely retry idempotent operations
- **[Saga](./saga.md)** - Combine with saga for transactional idempotency
- **[Circuit Breaker](./circuit-breaker.md)** - Protect idempotency store from failures

---

## Additional Resources

- [Idempotency (Wikipedia)](https://en.wikipedia.org/wiki/Idempotence)
- [Stripe Idempotency Guide](https://stripe.com/docs/api/idempotent_requests)
- [Best Practices Guide](../guides/best-practices.md)
