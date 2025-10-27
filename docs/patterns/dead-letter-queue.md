# Dead Letter Queue Pattern

Handle failed messages after exhausting retries. Essential for reliable message processing and error recovery.

## Overview

Dead Letter Queue (DLQ) pattern retries failed operations and routes persistent failures to a separate queue for manual intervention or analysis.

### Key Features

- **Automatic retries** - Configurable retry attempts
- **Exponential backoff** - Increasing delays between retries
- **Failure handling** - Custom dead letter handler
- **Error tracking** - Collect all failure errors

### Use Cases

- **Message processing** - Queue systems (SQS, RabbitMQ)
- **AI workflows** - Handle AI API failures
- **Payment processing** - Retry failed transactions
- **Data pipelines** - ETL error handling

---

## Basic Usage

```typescript
import { deadLetterQueue } from 'ai-patterns';

await deadLetterQueue({
  execute: async (message) => {
    return await processMessage(message);
  },
  maxRetries: 3,
  retryDelay: 1000,
  onDeadLetter: async (item, errors) => {
    await dlqStorage.save({ item, errors });
    await alertSupport(item);
  }
}, message);
```

---

## API Reference

### `deadLetterQueue<TInput, TResult>(options, item): Promise<TResult>`

#### Options

```typescript
interface DeadLetterQueueOptions<TInput, TResult> {
  execute: AsyncFunction<TResult, [TInput]>;
  maxRetries?: number;      // Default: 3
  retryDelay?: number;      // Default: 1000ms
  onDeadLetter: (item: TInput, errors: Error[]) => void | Promise<void>;
  logger?: Logger;
}
```

---

## Examples

### AI Message Processing with DLQ

```typescript
import { deadLetterQueue } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const deadLetters = [];

async function processAIMessage(message: string) {
  return await deadLetterQueue({
    execute: async (msg) => {
      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: `Process: ${msg}`
      });
      return text;
    },

    maxRetries: 3,
    retryDelay: 2000,

    onDeadLetter: async (item, errors) => {
      // Store in database for manual review
      await db.deadLetters.create({
        message: item,
        errors: errors.map(e => e.message),
        timestamp: Date.now()
      });

      // Alert team
      await slack.send({
        channel: '#ai-failures',
        text: `DLQ: Message failed after 3 retries: ${item}`
      });

      deadLetters.push(item);
    }
  }, message);
}

try {
  await processAIMessage('Analyze sentiment');
} catch (error) {
  console.log('Message sent to DLQ');
}
```

### Queue Processing with DLQ

```typescript
const processQueue = async (messages: Message[]) => {
  for (const msg of messages) {
    try {
      await deadLetterQueue({
        execute: async (m) => await processMessage(m),
        maxRetries: 5,
        retryDelay: 1000,
        onDeadLetter: async (item, errors) => {
          // Move to DLQ table
          await moveToDeadLetterQueue(item, errors);
        }
      }, msg);
    } catch (error) {
      // Already in DLQ
      console.log(`Message ${msg.id} failed permanently`);
    }
  }
};
```

---

## Best Practices

### ✅ Do

1. **Monitor DLQ size** - Alert if growing
2. **Review dead letters** - Regular analysis of failures
3. **Set appropriate retries** - Balance speed vs success rate
4. **Store error context** - Full error messages and timestamps

### ❌ Don't

1. **Don't retry infinitely** - Set reasonable max retries
2. **Don't ignore DLQ** - Review and fix issues
3. **Don't lose messages** - Ensure DLQ storage is reliable

---

## Related Patterns

- **[Retry](./retry.md)** - Simpler retry without DLQ
- **[Fallback](./fallback.md)** - Alternative approaches

---

**[← Back to Documentation](../../README.md#patterns)**
