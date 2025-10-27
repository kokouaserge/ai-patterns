# Smart Context Window Management Pattern

Automatically manage context token limits by truncating, summarizing, or chunking content to prevent `context_length_exceeded` errors.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
- [Advanced Features](#advanced-features)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The Smart Context Window Management pattern prevents context overflow errors by intelligently managing conversation history and message content to fit within model token limits.

### Key Features

- **Automatic optimization** - Transparently manage context size
- **Multiple strategies** - Sliding window, summarization, prioritization, truncation
- **AI summarization** - Condense old messages while preserving context
- **Custom strategies** - Implement your own optimization logic
- **Token counting** - Built-in estimation with custom counter support
- **Type-safe** - Full TypeScript support with message types
- **Observable** - Callbacks for monitoring optimization

### Use Cases

- **Long conversations** - Chat applications with extensive history
- **Document processing** - Large documents exceeding context limits
- **Multi-turn dialogues** - Maintaining context in extended conversations
- **Cost optimization** - Reduce token usage and API costs
- **Context preservation** - Keep important information while trimming excess

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Sliding Window Strategy

```typescript
import { smartContextWindow, ContextStrategy } from 'ai-patterns';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const conversation = [
  { role: 'system', content: 'You are a helpful assistant' },
  // ... 100+ messages
  { role: 'user', content: 'What did we discuss earlier?' }
];

const result = await smartContextWindow({
  execute: async (messages) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages
    });
    return text;
  },
  messages: conversation,
  maxTokens: 120000, // Leave margin for response
  strategy: ContextStrategy.SLIDING_WINDOW,
  keepRecentCount: 50, // Keep last 50 messages
  onTruncation: (origCount, optCount, origTokens, optTokens) => {
    console.log(`Optimized: ${origCount} → ${optCount} messages`);
    console.log(`Tokens saved: ${origTokens - optTokens}`);
  }
});

console.log(result.value); // AI response
console.log(`Was optimized: ${result.wasOptimized}`);
```

### Prioritize Important Messages

```typescript
const conversation = [
  { role: 'system', content: 'System prompt' },
  { role: 'user', content: 'Regular message' },
  { role: 'user', content: '@admin urgent issue', metadata: { important: true } },
  { role: 'user', content: '/reset' }, // Command
  // ... more messages
];

const result = await smartContextWindow({
  execute: async (messages) => {
    return await generateText({ model, messages });
  },
  messages: conversation,
  maxTokens: 8000,
  strategy: ContextStrategy.PRIORITIZE_IMPORTANT
  // Keeps: system messages, @mentions, /commands, metadata.important
});
```

---

## API Reference

### `smartContextWindow<TResult>(config)`

Manage context window automatically.

#### Parameters

```typescript
interface SmartContextWindowConfig<TResult> {
  // Function to execute with optimized messages
  execute: (messages: Message[]) => Promise<TResult> | TResult;

  // Input messages
  messages: Message[];

  // Maximum tokens (leave margin for response)
  maxTokens: number;

  // Optimization strategy
  strategy?: ContextStrategy;

  // Custom strategies
  strategies?: OptimizationStrategies;

  // Token counter function
  tokenCounter?: (messages: Message[]) => number | Promise<number>;

  // Number of recent messages to keep (sliding window)
  keepRecentCount?: number; // Default: 50

  // Number of old messages to summarize
  summarizeOldCount?: number; // Default: 20

  // Summarizer function (for SUMMARIZE_OLD strategy)
  summarizer?: (messages: Message[]) => Promise<string>;

  // Callbacks
  onTruncation?: (originalCount: number, optimizedCount: number, originalTokens: number, optimizedTokens: number) => void | Promise<void>;
  onOptimization?: (strategy: ContextStrategy, messages: Message[]) => void | Promise<void>;

  // Logger
  logger?: Logger;
}

enum ContextStrategy {
  SLIDING_WINDOW = 'sliding-window',       // Keep recent messages
  SUMMARIZE_OLD = 'summarize-old',         // Summarize old, keep recent
  PRIORITIZE_IMPORTANT = 'prioritize-important', // Keep important messages
  TRUNCATE_MIDDLE = 'truncate-middle',     // Keep first & last, remove middle
  CUSTOM = 'custom'                        // Custom strategy
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  metadata?: Record<string, any>;
}
```

#### Returns

```typescript
interface SmartContextWindowResult<TResult> {
  value: TResult;                    // Execution result
  originalMessageCount: number;      // Original message count
  optimizedMessageCount: number;     // Optimized message count
  originalTokens: number;            // Original token count
  optimizedTokens: number;           // Optimized token count
  wasOptimized: boolean;             // Whether optimization occurred
  strategyUsed?: ContextStrategy;    // Strategy used
  timestamp: number;                 // Completion timestamp
}
```

---

## Advanced Features

### AI Summarization Strategy

```typescript
import { smartContextWindow, createAISummarizer, ContextStrategy } from 'ai-patterns';

const summarizer = createAISummarizer(async (messages) => {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const { text } = await generateText({
    model: openai('gpt-3.5-turbo'), // Use cheaper model for summarization
    prompt: `Summarize this conversation concisely:\n\n${conversationText}`
  });

  return text;
});

const result = await smartContextWindow({
  execute: async (messages) => {
    return await generateText({
      model: openai('gpt-4-turbo'),
      messages
    });
  },
  messages: longConversation,
  maxTokens: 100000,
  strategy: ContextStrategy.SUMMARIZE_OLD,
  summarizeOldCount: 30, // Summarize all except last 30 messages
  summarizer,
  onOptimization: (strategy, messages) => {
    console.log(`Applied ${strategy} - ${messages.length} messages kept`);
  }
});
```

### Custom Strategy

```typescript
const result = await smartContextWindow({
  execute: async (messages) => {
    return await generateText({ model, messages });
  },
  messages: conversation,
  maxTokens: 50000,
  strategy: ContextStrategy.CUSTOM,
  strategies: {
    custom: (messages, currentTokens, maxTokens) => {
      // Hybrid strategy: important + recent + sampling
      const systemMessages = messages.filter(m => m.role === 'system');
      const importantMessages = messages.filter(m => m.metadata?.important);
      const otherMessages = messages.filter(
        m => m.role !== 'system' && !m.metadata?.important
      );

      // Keep every 5th message for context + last 20
      const sampledMessages = otherMessages.filter((_, idx) => idx % 5 === 0);
      const recentMessages = otherMessages.slice(-20);

      return [
        ...systemMessages,
        ...importantMessages,
        ...sampledMessages,
        ...recentMessages
      ];
    }
  }
});
```

### Custom Token Counter (tiktoken)

```typescript
import { encoding_for_model } from 'tiktoken';

const tokenCounter = (messages: Message[]): number => {
  const enc = encoding_for_model('gpt-4');

  let totalTokens = 0;
  for (const message of messages) {
    totalTokens += enc.encode(message.content).length;
    totalTokens += enc.encode(message.role).length;
    if (message.name) {
      totalTokens += enc.encode(message.name).length;
    }
  }

  enc.free();
  return totalTokens;
};

const result = await smartContextWindow({
  execute,
  messages,
  maxTokens: 120000,
  strategy: ContextStrategy.SLIDING_WINDOW,
  tokenCounter // Use accurate token counting
});
```

### Truncate Middle Strategy

```typescript
const result = await smartContextWindow({
  execute: async (messages) => {
    return await generateText({ model, messages });
  },
  messages: conversation,
  maxTokens: 50000,
  strategy: ContextStrategy.TRUNCATE_MIDDLE,
  onOptimization: (strategy, messages) => {
    // Result includes marker message
    const hasMarker = messages.some(m =>
      m.content.includes('messages omitted')
    );
    console.log(`Truncated middle, marker added: ${hasMarker}`);
  }
});
// Keeps: system + first 10 + [... N omitted ...] + last 30
```

---

## Examples

### Complete Chat Application

```typescript
import { smartContextWindow, createAISummarizer, ContextStrategy } from 'ai-patterns';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

class ChatSession {
  private messages: Message[] = [];

  constructor(systemPrompt: string) {
    this.messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  async sendMessage(userMessage: string) {
    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage
    });

    // Generate response with context management
    const result = await smartContextWindow({
      execute: async (messages) => {
        const { text } = await generateText({
          model: openai('gpt-4-turbo'),
          messages
        });
        return text;
      },
      messages: this.messages,
      maxTokens: 120000, // GPT-4 Turbo limit with margin

      // Use summarization for long conversations
      strategy: ContextStrategy.SUMMARIZE_OLD,
      summarizeOldCount: 20,
      summarizer: createAISummarizer(async (oldMessages) => {
        const { text } = await generateText({
          model: openai('gpt-3.5-turbo'),
          prompt: `Summarize key points from this conversation:\n${
            oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
          }`
        });
        return text;
      }),

      onTruncation: (origCount, optCount, origTokens, optTokens) => {
        console.log(`📉 Context optimized:`);
        console.log(`   Messages: ${origCount} → ${optCount}`);
        console.log(`   Tokens: ${origTokens} → ${optTokens}`);
        console.log(`   Saved: ${origTokens - optTokens} tokens`);
      }
    });

    // Add assistant response
    this.messages.push({
      role: 'assistant',
      content: result.value
    });

    return {
      response: result.value,
      wasOptimized: result.wasOptimized,
      messageCount: result.optimizedMessageCount
    };
  }
}

// Usage
const chat = new ChatSession('You are a helpful coding assistant');

for (let i = 0; i < 100; i++) {
  const result = await chat.sendMessage(`Question ${i}: How do I...?`);
  console.log(result.response);
}
```

### Multi-Strategy with Monitoring

```typescript
const analytics = {
  totalOptimizations: 0,
  totalTokensSaved: 0,
  strategyUsage: new Map<string, number>()
};

async function generateWithContextManagement(messages: Message[]) {
  return await smartContextWindow({
    execute: async (messages) => {
      return await generateText({ model: openai('gpt-4-turbo'), messages });
    },
    messages,
    maxTokens: 100000,

    // Dynamic strategy based on conversation type
    strategy: messages.length > 100
      ? ContextStrategy.SUMMARIZE_OLD
      : ContextStrategy.SLIDING_WINDOW,

    summarizer: createAISummarizer(async (msgs) => {
      return await summarizeMessages(msgs);
    }),

    onTruncation: (origCount, optCount, origTokens, optTokens) => {
      analytics.totalOptimizations++;
      analytics.totalTokensSaved += (origTokens - optTokens);
    },

    onOptimization: (strategy, messages) => {
      const count = analytics.strategyUsage.get(strategy) || 0;
      analytics.strategyUsage.set(strategy, count + 1);
    }
  });
}

// Later: view analytics
console.log('Context Management Analytics:');
console.log(`Total optimizations: ${analytics.totalOptimizations}`);
console.log(`Tokens saved: ${analytics.totalTokensSaved.toLocaleString()}`);
console.log(`Cost saved: $${(analytics.totalTokensSaved / 1_000_000 * 10).toFixed(2)}`);
```

---

## Error Handling

### Handling Context Errors

```typescript
try {
  const result = await smartContextWindow({
    execute: async (messages) => {
      return await generateText({ model, messages });
    },
    messages,
    maxTokens: 100000,
    strategy: ContextStrategy.SLIDING_WINDOW
  });

  if (result.wasOptimized) {
    logger.info('Context was optimized', {
      saved: result.originalTokens - result.optimizedTokens
    });
  }
} catch (error) {
  if (error instanceof PatternError) {
    console.error('Context management failed:', error.message);
    console.error('Context:', error.context);
  }
}
```

---

## Best Practices

### 1. Choose the Right Strategy

```typescript
// Short conversations: Sliding Window
strategy: ContextStrategy.SLIDING_WINDOW

// Long conversations: Summarization
strategy: ContextStrategy.SUMMARIZE_OLD

// Important context: Prioritization
strategy: ContextStrategy.PRIORITIZE_IMPORTANT

// Debugging: Truncate Middle (keeps beginning for context)
strategy: ContextStrategy.TRUNCATE_MIDDLE
```

### 2. Leave Margin for Response

```typescript
// Bad: Using full context limit
maxTokens: 128000 // GPT-4 Turbo limit

// Good: Leave margin for response
maxTokens: 120000 // Leaves 8k tokens for response
```

### 3. Mark Important Messages

```typescript
messages.push({
  role: 'user',
  content: 'Critical information',
  metadata: { important: true } // Preserved in PRIORITIZE_IMPORTANT
});
```

### 4. Use Cheaper Models for Summarization

```typescript
summarizer: createAISummarizer(async (messages) => {
  // Use GPT-3.5 instead of GPT-4 for cost savings
  return await generateText({
    model: openai('gpt-3.5-turbo'),
    prompt: `Summarize: ${formatMessages(messages)}`
  });
})
```

### 5. Monitor Context Usage

```typescript
onTruncation: (origCount, optCount, origTokens, optTokens) => {
  const saved = origTokens - optTokens;
  const costSaved = (saved / 1_000_000) * 10; // $10 per 1M tokens

  analytics.track('context_optimized', {
    messagesSaved: origCount - optCount,
    tokensSaved: saved,
    costSaved: costSaved,
    strategy: 'sliding-window'
  });
}
```

### 6. Implement Graceful Degradation

```typescript
// Try summarization, fallback to truncation
strategy: ContextStrategy.SUMMARIZE_OLD,
summarizer: createAISummarizer(async (messages) => {
  try {
    return await summarizeWithAI(messages);
  } catch (error) {
    // Fallback to simple truncation
    logger.warn('Summarization failed, using truncation');
    return 'Previous conversation context unavailable';
  }
})
```

---

## Related Patterns

- **[Retry](./retry.md)** - Retry on context errors
- **[Cost Tracking](./cost-tracking.md)** - Monitor token costs
- **[Prompt Versioning](./prompt-versioning.md)** - Test different prompt lengths
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Escalate when context is critical

---

## See Also

- [Basic Example](../../examples/basic/context-window-simple.ts)
- [Advanced Example](../../examples/composition/context-window-with-summarization.ts)
- [API Documentation](../../README.md)
