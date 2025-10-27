# ai-patterns

[![npm version](https://img.shields.io/npm/v/ai-patterns.svg)](https://www.npmjs.com/package/ai-patterns)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Production-ready TypeScript patterns to build solid and robust AI applications.**

We provide developers with battle-tested tools for resilient AI workflows: retry logic, circuit breakers, rate limiting, human-in-the-loop escalation, and more — all with complete type safety and composability. Inspired by Vercel AI SDK's developer experience.

## Features

✨ **15 Battle-Tested Patterns** - Retry, Circuit Breaker, Timeout, Rate Limiter, Fallback, Cache, Debounce, Throttle, Bulkhead, and more
🎨 **Elegant Composition** - Functional middleware-based composition for complex workflows
🔒 **Type-Safe** - Full TypeScript support with generics and strict mode
🧩 **Composable** - Patterns work together seamlessly for robust workflows
📊 **Observable** - Built-in lifecycle callbacks for monitoring and debugging
🪶 **Lightweight** - Zero dependencies, minimal overhead
⚡ **Production-Ready** - Build solid AI applications with confidence
🎯 **Developer-Friendly** - Inspired by Vercel AI SDK's excellent DX

## Installation

```bash
npm install ai-patterns
# or
yarn add ai-patterns
# or
pnpm add ai-patterns
```

## Quick Start

```typescript
import { retry, timeout, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Simple retry with timeout protection
const result = await retry({
  execute: async () => {
    return await timeout({
      execute: async () => {
        const { text } = await generateText({
          model: openai('gpt-4-turbo'),
          prompt: 'Explain quantum computing',
          maxRetries: 0
        });
        return text;
      },
      timeoutMs: 10000
    });
  },
  maxAttempts: 3,
  backoffStrategy: BackoffStrategy.EXPONENTIAL
});

console.log(result.value);
```

## Advanced Usage

### Stateful Patterns

Use `defineCircuitBreaker` and `defineRateLimiter` for patterns that maintain state:

```typescript
import { defineCircuitBreaker, retry, timeout } from 'ai-patterns';

// Circuit breaker maintains state across calls
const breaker = defineCircuitBreaker({
  execute: async (prompt: string) => {
    return await timeout({
      execute: async () => {
        const { text } = await generateText({
          model: openai('gpt-4-turbo'),
          prompt,
          maxRetries: 0
        });
        return text;
      },
      timeoutMs: 10000
    });
  },
  failureThreshold: 5,
  resetTimeout: 60000
});

// Reuse the same instance
const result1 = await breaker('First prompt');
const result2 = await breaker('Second prompt');
console.log(breaker.getState()); // Check circuit state
```

### Middleware Composition

For complex workflows, use the `compose()` function with middleware:

```typescript
import { compose, retryMiddleware, timeoutMiddleware } from 'ai-patterns';

const pipeline = compose([
  timeoutMiddleware({ duration: 10000 }),
  retryMiddleware({ maxAttempts: 3 })
]);

const result = await pipeline(
  async (input) => generateText({ model: openai('gpt-4-turbo'), prompt: input }),
  'Your prompt here'
);
```

## Patterns

### Core Patterns

| Pattern | Description | Use Case | Docs |
|---------|-------------|----------|------|
| **[compose](#compose)** | Functional middleware-based composition | Complex AI pipelines | - |
| **[retry](#retry)** | Automatic retry with exponential backoff | Unstable APIs, network issues | [📖](./docs/patterns/retry.md) |
| **[timeout](#timeout)** | Time limits with AbortSignal support | Long-running operations | [📖](./docs/patterns/timeout.md) |
| **[fallback](#fallback)** | Execute alternatives on failure | Multi-provider failover | [📖](./docs/patterns/fallback.md) |
| **[defineCircuitBreaker](#definecircuitbreaker)** | Protect against failing services | External API calls | [📖](./docs/patterns/circuit-breaker.md) |
| **[defineRateLimiter](#defineratelimiter)** | Control request throughput | API rate limiting | [📖](./docs/patterns/rate-limiter.md) |

### Advanced Patterns

| Pattern | Description | Use Case | Docs |
|---------|-------------|----------|------|
| **[memoize](#memoize)** | Cache function results with TTL | Response caching | [📖](./docs/patterns/memoize.md) |
| **[defineDebounce](#debounce)** | Delay execution until silence period | User input handling | [📖](./docs/patterns/debounce.md) |
| **[defineThrottle](#throttle)** | Limit execution frequency | API call throttling | [📖](./docs/patterns/throttle.md) |
| **[defineBulkhead](#bulkhead)** | Isolate resources with concurrency limits | Resource isolation | [📖](./docs/patterns/bulkhead.md) |
| **[deadLetterQueue](#dead-letter-queue)** | Handle failed operations | Error recovery | [📖](./docs/patterns/dead-letter-queue.md) |

### Orchestration Patterns

| Pattern | Description | Use Case | Docs |
|---------|-------------|----------|------|
| **[fanOut](#fan-out)** | Parallel processing with concurrency control | Batch operations | [📖](./docs/patterns/fan-out.md) |
| **[saga](#saga)** | Distributed transactions with compensation | Multi-step workflows | [📖](./docs/patterns/saga.md) |
| **[conditionalBranch](#conditional-branch)** | Route based on conditions | Dynamic workflow routing | [📖](./docs/patterns/conditional-branch.md) |

### AI-Specific Patterns

| Pattern | Description | Use Case | Docs |
|---------|-------------|----------|------|
| **[humanInTheLoop](#human-in-the-loop)** | AI → Human escalation | Content moderation | [📖](./docs/patterns/human-in-the-loop.md) |
| **[idempotency](#idempotency)** | Prevent duplicate operations | Payment processing | [📖](./docs/patterns/idempotency.md) |

---

## Pattern Examples

### retry

Automatically retry failed operations with intelligent backoff strategies.

> **Note:** Vercel AI SDK's `generateText` and `generateObject` have built-in retry (`maxRetries: 2` by default). Use our `retry` pattern for:
> - **Advanced control**: Custom backoff strategies, detailed callbacks
> - **Cross-provider fallback**: Retry across OpenAI → Claude → Gemini
> - **More attempts**: Beyond Vercel's 2 retries
> - **Observability**: Detailed metrics (`attempts`, `totalDelay`)

```typescript
import { retry, BackoffStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

interface AIResponse {
  text: string;
  provider: string;
}

// Advanced retry: Cross-provider fallback with exponential backoff
const result = await retry<AIResponse>({
  execute: async () => {
    try {
      // Try OpenAI first (disable its built-in retry)
      const response = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: 'Explain quantum computing',
        maxRetries: 0 // ← Disable Vercel retry
      });
      return { text: response.text, provider: 'OpenAI' };
    } catch (error) {
      // Fallback to Claude
      const response = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        prompt: 'Explain quantum computing',
        maxRetries: 0
      });
      return { text: response.text, provider: 'Claude' };
    }
  },
  maxAttempts: 5,
  initialDelay: 1000,
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  onRetry: (error, attempt, delay) => {
    console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
  }
});

console.log(`✅ Success with ${result.value.provider}`); // ✅ Fully typed
console.log(`📊 Took ${result.attempts} attempts`);      // Detailed metrics
console.log(`⏱️  Total delay: ${result.totalDelay}ms`);
```

**[📖 Full retry documentation](./docs/patterns/retry.md)**

---

### timeout

Add time limits to async operations with AbortSignal support.

```typescript
import { timeout } from 'ai-patterns';
import { generateText } from 'ai';

const result = await timeout({
  execute: async () => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Write a detailed essay'
    });
    return text;
  },
  timeoutMs: 30000 // 30 seconds max
});

console.log(result);
```

**[📖 Full timeout documentation](./docs/patterns/timeout.md)**

---

### defineCircuitBreaker

Protect your system from cascading failures when calling external services.

```typescript
import { defineCircuitBreaker, CircuitState } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

interface AIResponse {
  text: string;
  usage: { totalTokens: number };
}

// Protect against OpenAI outages with circuit breaker
const generateWithGPT4 = defineCircuitBreaker<AIResponse>({
  execute: async () => {
    const response = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Summarize the latest AI research trends'
    });

    return {
      text: response.text,
      usage: response.usage
    };
  },
  failureThreshold: 5,      // Open after 5 failures
  openDuration: 60000,      // Try again after 1 minute
  onStateChange: (oldState, newState) => {
    console.log(`OpenAI Circuit: ${oldState} → ${newState}`);
    if (newState === CircuitState.OPEN) {
      // Fallback to Claude or cached response
      console.log('Switching to fallback AI provider');
    }
  }
});

const result = await generateWithGPT4(); // ✅ Direct call (Vercel-style)
console.log(result.text);                 // ✅ Fully typed
console.log(generateWithGPT4.getState()); // Check circuit state
```

**[📖 Full circuit breaker documentation](./docs/patterns/circuit-breaker.md)**

---

### defineRateLimiter

Control request throughput with multiple strategies.

```typescript
import { defineRateLimiter, RateLimitStrategy } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string())
});

type Recipe = z.infer<typeof recipeSchema>;

// Respect OpenAI rate limits (60 requests/minute on free tier)
const generateRecipe = defineRateLimiter<Recipe>({
  execute: async () => {
    const { object } = await generateObject({
      model: openai('gpt-4-turbo'),
      schema: recipeSchema,
      prompt: 'Generate a random recipe'
    });
    return object;
  },
  maxRequests: 60,
  windowMs: 60000, // 1 minute
  strategy: RateLimitStrategy.SLIDING_WINDOW
});

const result = await generateRecipe(); // ✅ Direct call (Vercel-style)
console.log(result.value.name);              // ✅ Fully typed
console.log(`${result.remaining}/60 requests remaining`);
console.log(generateRecipe.getRemaining()); // ✅ Check remaining
```

**[📖 Full rate limiter documentation](./docs/patterns/rate-limiter.md)**

---

### fanOut

Process multiple items in parallel with concurrency control.

```typescript
import { fanOut } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

interface DocumentChunk {
  id: string;
  text: string;
}

interface EmbeddedChunk {
  id: string;
  embedding: number[];
}

const chunks: DocumentChunk[] = [
  { id: '1', text: 'Introduction to machine learning' },
  { id: '2', text: 'Deep learning fundamentals' },
  { id: '3', text: 'Natural language processing basics' },
  { id: '4', text: 'Computer vision applications' },
  { id: '5', text: 'Reinforcement learning concepts' }
];

// Generate embeddings in parallel for RAG system
const result = await fanOut<DocumentChunk, EmbeddedChunk>({
  items: chunks,
  execute: async (chunk) => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: chunk.text
    });

    return {
      id: chunk.id,
      embedding
    };
  },
  concurrency: 5, // Process 5 embeddings at once
  onProgress: (completed, total) => {
    console.log(`Embedded ${completed}/${total} chunks`);
  }
});

// Store in vector database (Pinecone, Weaviate, etc.)
result.results.forEach(chunk => {
  console.log(`Chunk ${chunk.id}: ${chunk.embedding.length} dimensions`); // ✅ Fully typed
});
console.log(`Successfully embedded ${result.successCount} documents`);
```

**[📖 Full fan-out documentation](./docs/patterns/fan-out.md)**

---

### saga

Implement distributed transactions with automatic compensation.

```typescript
import { executeSaga } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

interface AIAgentContext {
  userId: string;
  query: string;
  researchData?: string;
  analysis?: { summary: string; insights: string[] };
  reportId?: string;
}

// Multi-step AI workflow with automatic rollback
const result = await executeSaga<AIAgentContext>({
  context: {
    userId: 'user-123',
    query: 'Analyze recent AI developments in healthcare'
  },
  steps: [
    {
      name: 'Research Phase',
      execute: async (ctx) => {
        const { text } = await generateText({
          model: openai('gpt-4-turbo'),
          prompt: `Research this topic: ${ctx.query}`
        });
        ctx.researchData = text;
        return text;
      },
      compensate: async (ctx) => {
        console.log('Clearing research data');
        delete ctx.researchData;
      }
    },
    {
      name: 'Analysis Phase',
      execute: async (ctx) => {
        const { object } = await generateObject({
          model: openai('gpt-4-turbo'),
          schema: z.object({
            summary: z.string(),
            insights: z.array(z.string())
          }),
          prompt: `Analyze this research: ${ctx.researchData}`
        });
        ctx.analysis = object;
        return object;
      },
      compensate: async (ctx) => {
        console.log('Clearing analysis');
        delete ctx.analysis;
      }
    },
    {
      name: 'Save Report',
      execute: async (ctx) => {
        const reportId = await saveToDatabase({
          userId: ctx.userId,
          analysis: ctx.analysis
        });
        ctx.reportId = reportId;
        return reportId;
      },
      compensate: async (ctx) => {
        if (ctx.reportId) {
          await deleteFromDatabase(ctx.reportId);
        }
      }
    }
  ]
});

if (result.success) {
  console.log('AI workflow completed');
  console.log(result.context.analysis?.summary); // ✅ Fully typed
} else {
  console.log(`Workflow failed - all steps rolled back`);
}
```

**[📖 Full saga documentation](./docs/patterns/saga.md)**

---

### humanInTheLoop

Escalate AI decisions to humans when needed.

```typescript
import { humanInTheLoop, CommonEscalationRules } from 'ai-patterns';
import OpenAI from 'openai';

const openai = new OpenAI();

interface ModerationResult {
  decision: 'approved' | 'rejected' | 'review';
  confidence: number;
  flaggedCategories: string[];
}

const userContent = "User-generated content to moderate";

// AI moderation with human escalation for edge cases
const result = await humanInTheLoop<string, ModerationResult>({
  execute: async () => {
    const moderation = await openai.moderations.create({
      input: userContent
    });

    const flagged = moderation.results[0].flagged;
    const categories = Object.entries(moderation.results[0].categories)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    // Calculate max confidence score
    const scores = Object.values(moderation.results[0].category_scores);
    const maxConfidence = Math.max(...scores);

    return {
      decision: flagged ? 'rejected' : 'approved',
      confidence: maxConfidence,
      flaggedCategories: categories
    };
  },
  input: userContent,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.8), // Escalate if confidence < 80%
    CommonEscalationRules.sensitiveKeywords(['self-harm', 'violence'])
  ],
  requestHumanReview: async (review) => {
    // Send to moderation queue
    return await moderationQueue.addReview(review);
  },
  onEscalate: (review) => {
    console.log(`Escalated to human: ${review.reason}`);
  }
});

console.log(result.value.decision);   // ✅ Fully typed
console.log(result.value.confidence); // ✅ Fully typed
```

**[📖 Full human-in-the-loop documentation](./docs/patterns/human-in-the-loop.md)**

---

### idempotency

Ensure operations can be safely retried without duplicates.

```typescript
import { idempotent } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

interface BlogPostResult {
  title: string;
  content: string;
  tokensUsed: number;
}

const topic = "The future of quantum computing";

// Prevent duplicate AI generations - save tokens and cost
const result = await idempotent<BlogPostResult>({
  execute: async () => {
    console.log('Generating new content (costs tokens)...');

    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: `Write a detailed blog post about: ${topic}`
    });

    const [title, ...contentLines] = text.split('\n');

    return {
      title: title.replace(/^#\s*/, ''),
      content: contentLines.join('\n'),
      tokensUsed: usage.totalTokens
    };
  },
  key: `blog-post:${topic}`,
  ttl: 86400000, // Cache for 24 hours
  onCacheHit: (key) => {
    console.log(`Returning cached content - saved API call!`);
  }
});

console.log(result.title);       // ✅ Fully typed
console.log(result.tokensUsed);  // ✅ Fully typed

// Second call with same topic returns cached result (no API call)
const cached = await idempotent({...}); // ✅ Instant, free
```

**[📖 Full idempotency documentation](./docs/patterns/idempotency.md)**

---

## Pattern Composition

Combine patterns for powerful, production-ready AI workflows:

```typescript
import {
  retry,
  timeout,
  defineCircuitBreaker,
  defineRateLimiter,
  idempotent,
  BackoffStrategy,
  RateLimitStrategy,
  TimeoutDurations
} from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

interface AIResponse {
  text: string;
  usage: { totalTokens: number };
}

// Production-ready AI agent: Circuit Breaker + Rate Limiter + Retry + Timeout + Idempotency
const productionAICall = defineCircuitBreaker<AIResponse>({
  execute: async () => {
    // Rate limiting (respect OpenAI limits)
    const limiter = defineRateLimiter<AIResponse>({
      execute: async () => {
        // Idempotency (cache results)
        return await idempotent<AIResponse>({
          execute: async () => {
            // Retry with exponential backoff
            return await retry<AIResponse>({
              execute: async () => {
                // Timeout protection
                return await timeout<AIResponse>({
                  execute: async () => {
                    const response = await generateText({
                      model: openai('gpt-4-turbo'),
                      prompt: 'Explain TypeScript generics'
                    });

                    return {
                      text: response.text,
                      usage: response.usage
                    };
                  },
                  timeoutMs: TimeoutDurations.LONG // 30s max
                });
              },
              maxAttempts: 3,
              backoffStrategy: BackoffStrategy.EXPONENTIAL
            });
          },
          key: 'ai-query:typescript-generics',
          ttl: 3600000 // 1 hour cache
        });
      },
      maxRequests: 60,
      windowMs: 60000, // 60 req/min
      strategy: RateLimitStrategy.SLIDING_WINDOW
    });

    return await limiter();
  },
  failureThreshold: 5, // Open circuit after 5 failures
  openDuration: 60000  // Try again after 1 minute
});

// Ultra-reliable AI call
const result = await productionAICall(); // ✅ Vercel-style callable
console.log(result.text);                 // ✅ Fully typed through ALL layers
console.log(productionAICall.getState()); // Monitor circuit state
```

**[📖 Pattern Composition Guide](./docs/guides/composition.md)**

---

## Examples

### Basic Examples

Each pattern has a simple runnable example:

- [retry-simple.ts](./examples/basic/retry-simple.ts)
- [timeout-simple.ts](./examples/basic/timeout-simple.ts)
- [circuit-breaker-simple.ts](./examples/basic/circuit-breaker-simple.ts)
- [rate-limiter-simple.ts](./examples/basic/rate-limiter-simple.ts)
- [fan-out-simple.ts](./examples/basic/fan-out-simple.ts)
- [saga-simple.ts](./examples/basic/saga-simple.ts)
- [human-in-loop-simple.ts](./examples/basic/human-in-loop-simple.ts)
- [idempotency-simple.ts](./examples/basic/idempotency-simple.ts)

### Real-World Examples

Coming soon:

- **E-commerce** - Order processing with saga, retry, and idempotency
- **AI Agent** - Chatbot with human escalation and circuit breakers
- **Microservices** - API gateway with rate limiting and retries

---

## Documentation

### Pattern Documentation

- [Retry Pattern](./docs/patterns/retry.md)
- [Timeout Pattern](./docs/patterns/timeout.md)
- [Circuit Breaker Pattern](./docs/patterns/circuit-breaker.md)
- [Rate Limiter Pattern](./docs/patterns/rate-limiter.md)
- [Fan-Out Pattern](./docs/patterns/fan-out.md)
- [Saga Pattern](./docs/patterns/saga.md)
- [Human-in-the-Loop Pattern](./docs/patterns/human-in-the-loop.md)
- [Idempotency Pattern](./docs/patterns/idempotency.md)

### Guides

- [Getting Started](./docs/guides/getting-started.md)
- [Pattern Composition](./docs/guides/composition.md)
- [Error Handling](./docs/guides/error-handling.md)
- [Best Practices](./docs/guides/best-practices.md)

---

## API Reference

All patterns follow a consistent API design:

```typescript
const result = await pattern({
  execute: () => yourFunction(),
  // pattern-specific options...
});
```

See the [API Reference](./docs/api-reference.md) for complete details.

---

## Type Safety

Built with TypeScript strict mode for maximum type safety:

```typescript
// Full type inference with generics
interface User {
  id: string;
  name: string;
  email: string;
}

const result = await retry<User>({
  execute: async () => {
    return await fetchUser();
  }
});

// result.value is typed as User
const user: User = result.value;
console.log(user.email); // ✅ Full autocomplete
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

---

## License

MIT © [Serge KOKOUA](https://github.com/sergekokoua)

---

## Why ai-patterns?

Building production-grade AI applications requires more than just calling APIs. You need:

- ✅ **Resilience** - Handle transient failures gracefully
- ✅ **Reliability** - Ensure critical operations succeed
- ✅ **Observability** - Monitor and debug AI workflows
- ✅ **Cost Control** - Prevent duplicate operations, manage rate limits
- ✅ **Human Oversight** - Escalate edge cases appropriately

**ai-patterns provides all of this out of the box**, so you can focus on building great AI features.

---

## Acknowledgments

Inspired by:
- [Vercel AI SDK](https://sdk.vercel.ai) - Developer experience
- [Polly](https://github.com/App-vNext/Polly) - Resilience patterns
- [ts-retry](https://github.com/wankdanker/ts-retry) - TypeScript patterns

---

**Built with ❤️ by [Serge KOKOUA](https://github.com/sergekokoua)**

*Empowering developers to build solid and robust AI applications.*

