# Fan-Out Pattern

Process multiple items in parallel with concurrency control and progress tracking.

## Overview

The **Fan-Out** pattern distributes work across multiple parallel operations. Perfect for:

- Batch processing large datasets
- Parallel API calls
- Image/file processing
- Data transformation pipelines
- Concurrent database queries

### Key Features

- ⚡ **Parallel Processing** - Execute multiple operations concurrently
- 🎚️ **Concurrency Control** - Limit simultaneous operations
- 📊 **Progress Tracking** - Real-time progress callbacks
- 🔄 **Error Handling** - Continue on error or fail fast
- 🎯 **Type-Safe** - Full TypeScript generics for input/output
- 📈 **Statistics** - Success/error counts and duration

---

## API Reference

### Basic Usage

```typescript
import { fanOut } from 'ai-patterns';

const result = await fanOut({
  items: [1, 2, 3, 4, 5],
  execute: async (item) => {
    return await processItem(item);
  },
  concurrency: 3
});

console.log(result.results);      // All successful results
console.log(result.successCount); // Number of successes
```

### With Type Safety

```typescript
interface User {
  id: number;
  name: string;
}

interface EnrichedUser {
  id: number;
  name: string;
  email: string;
  profile: object;
}

const result = await fanOut<User, EnrichedUser>({
  items: users,
  execute: async (user) => {
    const email = await fetchEmail(user.id);
    const profile = await fetchProfile(user.id);
    return { ...user, email, profile };
  },
  concurrency: 5,
  onProgress: (completed, total) => {
    console.log(`${completed}/${total} users processed`);
  }
});

result.results.forEach(user => {
  console.log(user.email); // ✅ Fully typed
});
```

### FanOutOptions<TInput, TOutput>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `items` | `TInput[]` | ✅ Yes | - | Array of items to process |
| `execute` | `(item: TInput) => Promise<TOutput>` | ✅ Yes | - | Function to process each item |
| `concurrency` | `number` | ❌ No | `Infinity` | Max concurrent operations |
| `continueOnError` | `boolean` | ❌ No | `false` | Continue if items fail |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for events |
| `onProgress` | `(completed, total, item) => void` | ❌ No | `undefined` | Progress callback |
| `onError` | `(error, item, index) => void` | ❌ No | `undefined` | Error callback |

### FanOutResult<TOutput>

```typescript
interface FanOutResult<TOutput> {
  results: TOutput[];         // Successful results
  errors: Map<number, Error>; // Errors by index
  total: number;              // Total items processed
  successCount: number;       // Number of successes
  errorCount: number;         // Number of failures
  duration: number;           // Total duration (ms)
}
```

---

## Examples

### Example 1: Parallel API Calls

```typescript
import { fanOut } from 'ai-patterns';

interface UserData {
  id: string;
  name: string;
  email: string;
}

const userIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

const result = await fanOut<string, UserData>({
  items: userIds,
  execute: async (userId) => {
    const response = await fetch(`/api/users/${userId}`);
    return await response.json();
  },
  concurrency: 3, // Max 3 concurrent requests
  onProgress: (completed, total) => {
    console.log(`Fetched ${completed}/${total} users`);
  }
});

console.log(`Fetched ${result.successCount} users in ${result.duration}ms`);
result.results.forEach(user => {
  console.log(user.name);
});
```

### Example 2: Image Processing

```typescript
import { fanOut } from 'ai-patterns';

interface ImageJob {
  path: string;
  width: number;
  height: number;
}

interface ProcessedImage {
  path: string;
  size: number;
  thumbnail: string;
}

const images = [
  { path: 'img1.jpg', width: 1920, height: 1080 },
  { path: 'img2.jpg', width: 1920, height: 1080 },
  { path: 'img3.jpg', width: 1920, height: 1080 }
];

const result = await fanOut<ImageJob, ProcessedImage>({
  items: images,
  execute: async (image) => {
    const resized = await resizeImage(image.path, image.width, image.height);
    const thumbnail = await createThumbnail(image.path);
    return {
      path: resized.path,
      size: resized.size,
      thumbnail
    };
  },
  concurrency: 2, // Process 2 images at a time
  onProgress: (completed, total, image) => {
    console.log(`Processed ${image.path} (${completed}/${total})`);
  }
});

console.log(`Processed ${result.successCount} images`);
```

### Example 3: Database Batch Operations

```typescript
import { fanOut } from 'ai-patterns';

interface BatchUpdate {
  id: string;
  data: object;
}

const updates: BatchUpdate[] = [
  { id: '1', data: { name: 'John' } },
  { id: '2', data: { name: 'Jane' } },
  { id: '3', data: { name: 'Bob' } }
];

const result = await fanOut<BatchUpdate, void>({
  items: updates,
  execute: async (update) => {
    await db.users.update(update.id, update.data);
  },
  concurrency: 10, // 10 concurrent DB operations
  continueOnError: true, // Don't stop if one fails
  onError: (error, item, index) => {
    logger.error(`Failed to update ${item.id}`, { error, index });
  }
});

console.log(`Updated ${result.successCount}/${result.total} records`);
if (result.errorCount > 0) {
  console.log(`${result.errorCount} updates failed`);
  result.errors.forEach((error, index) => {
    console.log(`Index ${index}: ${error.message}`);
  });
}
```

### Example 4: AI Batch Inference

```typescript
import { fanOut } from 'ai-patterns';

interface TextInput {
  id: string;
  text: string;
}

interface AIResult {
  id: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

const texts: TextInput[] = [
  { id: '1', text: 'I love this product!' },
  { id: '2', text: 'This is terrible.' },
  { id: '3', text: 'It\'s okay, I guess.' }
];

const result = await fanOut<TextInput, AIResult>({
  items: texts,
  execute: async (input) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Analyze sentiment' },
        { role: 'user', content: input.text }
      ]
    });

    return {
      id: input.id,
      sentiment: parseSentiment(response),
      confidence: 0.95
    };
  },
  concurrency: 5, // 5 concurrent AI calls
  onProgress: (completed, total) => {
    console.log(`Analyzed ${completed}/${total} texts`);
  }
});

result.results.forEach(r => {
  console.log(`${r.id}: ${r.sentiment} (${r.confidence})`);
});
```

### Example 5: Error Handling with Continue

```typescript
import { fanOut } from 'ai-patterns';

const urls = [
  'https://api.example.com/1',
  'https://api.example.com/2',
  'https://invalid-url.com/3', // This will fail
  'https://api.example.com/4'
];

const result = await fanOut<string, any>({
  items: urls,
  execute: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  },
  concurrency: 2,
  continueOnError: true, // Don't stop on error
  onError: (error, url, index) => {
    logger.error(`Failed to fetch ${url}`, { error, index });
    metrics.increment('fanout.error');
  }
});

console.log(`Successfully fetched ${result.successCount}/${result.total} URLs`);
console.log(`Failed: ${result.errorCount}`);

// Process successful results
result.results.forEach(data => {
  console.log(data);
});

// Handle errors
result.errors.forEach((error, index) => {
  console.error(`Index ${index} failed: ${error.message}`);
});
```

---

## Error Handling

### Fail Fast (Default)

By default, fan-out stops on first error:

```typescript
const result = await fanOut({
  items: [1, 2, 3, 4, 5],
  execute: async (item) => {
    if (item === 3) throw new Error('Failed at item 3');
    return item * 2;
  },
  continueOnError: false // Default
});

// Throws error when item 3 fails
// Items 4 and 5 are not processed
```

### Continue on Error

Process all items regardless of failures:

```typescript
const result = await fanOut({
  items: [1, 2, 3, 4, 5],
  execute: async (item) => {
    if (item === 3) throw new Error('Failed at item 3');
    return item * 2;
  },
  continueOnError: true // Continue despite errors
});

console.log(result.results);      // [2, 4, 8, 10] (item 3 skipped)
console.log(result.successCount); // 4
console.log(result.errorCount);   // 1
console.log(result.errors.get(2)); // Error for index 2 (item 3)
```

### Custom Error Handling

```typescript
const result = await fanOut({
  items: urls,
  execute: async (url) => {
    return await fetchWithRetry(url);
  },
  continueOnError: true,
  onError: (error, url, index) => {
    // Custom error handling
    logger.error(`URL ${url} failed`, { error, index });
    metrics.increment('fetch.error', { url });

    // Send alert if too many errors
    if (result.errorCount > 10) {
      alerts.send('High fan-out error rate');
    }
  }
});
```

---

## Best Practices

### ✅ Do's

1. **Set Appropriate Concurrency**
   ```typescript
   // Good: Limit based on resource capacity
   const result = await fanOut({
     items: largeDataset,
     execute: processItem,
     concurrency: 10 // Don't overwhelm system
   });
   ```

2. **Use Progress Callbacks**
   ```typescript
   const result = await fanOut({
     items: items,
     execute: processItem,
     onProgress: (completed, total) => {
       const percent = (completed / total * 100).toFixed(1);
       console.log(`Progress: ${percent}%`);
     }
   });
   ```

3. **Handle Errors Gracefully**
   ```typescript
   const result = await fanOut({
     items: items,
     execute: processItem,
     continueOnError: true, // Don't fail entire batch
     onError: (error, item, index) => {
       logger.error('Item failed', { item, index, error });
     }
   });
   ```

4. **Type Your Input/Output**
   ```typescript
   const result = await fanOut<InputType, OutputType>({
     items: typedItems,
     execute: async (item) => {
       // ✅ Full type safety
       return transformItem(item);
     }
   });
   ```

### ❌ Don'ts

1. **Don't Use Unlimited Concurrency on Large Datasets**
   ```typescript
   // Bad: Can overwhelm system
   const result = await fanOut({
     items: millionItems,
     execute: processItem
     // No concurrency limit - dangerous!
   });

   // Good: Set reasonable limit
   concurrency: 100
   ```

2. **Don't Ignore Errors**
   ```typescript
   // Bad: Silent failures
   const result = await fanOut({
     items: items,
     execute: processItem,
     continueOnError: true
     // No onError callback - errors are lost!
   });

   // Good: Log errors
   onError: (error, item, index) => {
     logger.error('Processing failed', { error, item, index });
   }
   ```

3. **Don't Process Items with Side Effects Without Error Handling**
   ```typescript
   // Bad: No error handling for critical operations
   await fanOut({
     items: payments,
     execute: (payment) => processPayment(payment)
     // If one fails, others continue without rollback
   });

   // Good: Use Saga pattern for transactions
   await executeSaga({ ... });
   ```

---

## Production Configuration

### API Batch Processing

```typescript
import { fanOut } from 'ai-patterns';

const result = await fanOut({
  items: userIds,
  execute: (id) => fetchUser(id),
  concurrency: 10, // Max 10 concurrent API calls
  continueOnError: true,
  onProgress: (completed, total) => {
    metrics.gauge('fanout.progress', completed / total);
  },
  onError: (error, id, index) => {
    logger.error('User fetch failed', { userId: id, index, error });
    metrics.increment('fanout.error');
  }
});
```

### Large Dataset Processing

```typescript
const result = await fanOut({
  items: largeDataset,
  execute: (item) => transformItem(item),
  concurrency: 50, // Balance throughput vs resources
  continueOnError: true,
  logger: customLogger
});
```

### Resource-Intensive Operations

```typescript
// Limit concurrency for CPU/memory intensive tasks
const result = await fanOut({
  items: images,
  execute: (image) => processImage(image),
  concurrency: 4, // Limited by CPU cores
  onProgress: (completed, total) => {
    console.log(`Processed ${completed}/${total} images`);
  }
});
```

---

## Pattern Composition

### Fan-Out + Retry

```typescript
import { fanOut, retry, BackoffStrategy } from 'ai-patterns';

const result = await fanOut({
  items: urls,
  execute: async (url) => {
    return await retry({
      execute: () => fetch(url).then(r => r.json()),
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    });
  },
  concurrency: 5
});
```

### Fan-Out + Timeout

```typescript
import { fanOut, timeout, TimeoutDurations } from 'ai-patterns';

const result = await fanOut({
  items: tasks,
  execute: async (task) => {
    return await timeout({
      execute: () => processTask(task),
      timeoutMs: TimeoutDurations.MEDIUM
    });
  },
  concurrency: 10
});
```

### Fan-Out + Rate Limiter

```typescript
import { fanOut, rateLimiter, RateLimitStrategy } from 'ai-patterns';

const limiter = rateLimiter({
  execute: (item) => callAPI(item),
  maxRequests: 100,
  windowMs: 60000,
  strategy: RateLimitStrategy.SLIDING_WINDOW
});

const result = await fanOut({
  items: items,
  execute: (item) => limiter.execute(),
  concurrency: 10 // Combined with rate limiting
});
```

---

## Related Patterns

- **[Retry](./retry.md)** - Retry failed items automatically
- **[Timeout](./timeout.md)** - Add time limits to each item
- **[Rate Limiter](./rate-limiter.md)** - Control throughput rate
- **[Circuit Breaker](./circuit-breaker.md)** - Protect against cascading failures

---

## Additional Resources

- [Concurrency vs Parallelism](https://en.wikipedia.org/wiki/Concurrency_(computer_science))
- [Fan-Out/Fan-In Pattern](https://en.wikipedia.org/wiki/Fan-out_(software))
- [Best Practices Guide](../guides/best-practices.md)
