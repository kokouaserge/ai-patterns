# ai-patterns

[![npm version](https://img.shields.io/npm/v/ai-patterns.svg)](https://www.npmjs.com/package/ai-patterns)
[![Downloads](https://img.shields.io/npm/dm/ai-patterns.svg)](https://www.npmjs.com/package/ai-patterns)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Battle-tested TypeScript patterns for building rock-solid AI applications.**

We provide developers with battle-tested tools for resilient AI workflows: retry logic, circuit breakers, rate limiting, human-in-the-loop escalation, and more — all with complete type safety and composability. Inspired by Vercel AI SDK's developer experience.

## Features

✨ **15 Battle-Tested Patterns** - Retry, Circuit Breaker, Timeout, Rate Limiter, Fallback, Cache, Debounce, Throttle, Bulkhead, and more
🎨 **Elegant Composition** - Compose patterns together for complex workflows
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

### Simple Retry

```typescript
import { retry } from 'ai-patterns';

// Retry any async function
const result = await retry({
  execute: () => fetch('https://api.example.com/data'),
  maxAttempts: 3
});

console.log(result.value);
```

### With Vercel AI SDK

```typescript
import { retry } from 'ai-patterns';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await retry({
  execute: async () => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Explain quantum computing',
      maxRetries: 0 // Disable Vercel's built-in retry
    });
    return text;
  },
  maxAttempts: 3
});

console.log(result.value);
```

> **💡 Note:** While Vercel AI SDK has built-in retry (`maxRetries: 2`), `ai-patterns` gives you **more flexibility**:
> - 🎛️ Custom backoff strategies (exponential, linear, fixed)
> - 📊 Detailed observability (attempts, delays, errors)
> - 🔄 Cross-provider fallback (OpenAI → Claude → Gemini)
> - 🎯 Advanced retry logic (conditional, circuit breakers)

## Why ai-patterns?

Building AI applications? You're probably facing these challenges:

❌ **Copy-pasting retry logic** across every API call
❌ **No circuit breakers** — one API failure brings down your entire app
❌ **Constantly hitting rate limits** with no systematic handling
❌ **No human oversight** for edge cases that need review

**With ai-patterns:**

✅ **Battle-tested patterns** ready to use out of the box
✅ **Compose like Lego blocks** — combine patterns seamlessly
✅ **Full type safety** — catch errors at compile time
✅ **Zero dependencies** — lightweight and production-ready

**Before ai-patterns:**
```typescript
// 50+ lines of retry logic with exponential backoff,
// jitter, error classification, timeout handling...
let attempt = 0;
const maxAttempts = 3;
while (attempt < maxAttempts) {
  try {
    // ... complex retry logic
  } catch (error) {
    // ... backoff calculation
    // ... error handling
  }
}
```

**After ai-patterns:**
```typescript
const result = await retry({
  execute: () => callAPI(),
  maxAttempts: 3
});
```

**That's it.** Simple, reliable, production-ready.

## Advanced Usage

### Stateful Patterns

Use `defineCircuitBreaker` and `defineRateLimiter` for patterns that maintain state:

```typescript
const breaker = defineCircuitBreaker({
  execute: (prompt: string) => callAPI(prompt),
  failureThreshold: 5,
  resetTimeout: 60000
});

// Reuse the same instance across calls
await breaker('First call');
await breaker('Second call');
console.log(breaker.getState()); // Check circuit state
```

### Pattern Composition

Nest patterns together for robust workflows:

```typescript
const result = await retry({
  execute: async () => {
    return await timeout({
      execute: () => callAPI(),
      timeoutMs: 5000
    });
  },
  maxAttempts: 3
});
```

**For advanced composition strategies:**
- [Composition Guide →](./docs/guides/composition.md)
- [Production Examples →](./examples/advanced)

---
## Patterns

### Core Patterns

| Pattern | Description | Use Case | Docs |
|---------|-------------|----------|------|
| **[compose](#compose)** | Functional pattern composition | Complex AI pipelines | [📖](./docs/patterns/compose.md) |
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

### Robust API Call

```typescript
import { retry, timeout } from 'ai-patterns';

const result = await retry({
  execute: async () => {
    return await timeout({
      execute: () => fetch('https://api.example.com/data'),
      timeoutMs: 5000
    });
  },
  maxAttempts: 3
});
```

### AI Agent with Fallback

```typescript
import { fallback } from 'ai-patterns';
import { generateText } from 'ai';
import { openai, anthropic } from '@ai-sdk/openai';

const result = await fallback({
  execute: async () => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Explain quantum computing'
    });
    return text;
  },
  fallback: async () => {
    const { text} = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: 'Explain quantum computing'
    });
    return text;
  }
});
```

### Data Processing Pipeline

```typescript
import { fanOut } from 'ai-patterns';
import { embed } from 'ai';

const chunks = [
  { id: '1', text: 'Introduction to ML' },
  { id: '2', text: 'Deep learning basics' },
  // ... more chunks
];

const result = await fanOut({
  items: chunks,
  execute: async (chunk) => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: chunk.text
    });
    return { id: chunk.id, embedding };
  },
  concurrency: 5
});
```

### Composing Patterns with Middleware

```typescript
import { compose, retryMiddleware, timeoutMiddleware } from 'ai-patterns/composition';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Compose multiple patterns functionally
const robustAI = compose([
  timeoutMiddleware({ duration: 10000 }),
  retryMiddleware({ maxAttempts: 3, backoffStrategy: 'exponential' })
]);

// Use the composed function
const result = await robustAI(
  async (prompt: string) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt
    });
    return text;
  },
  'Explain quantum computing'
);
```

**For detailed pattern documentation:**

- [Compose Pattern →](./docs/patterns/compose.md)
- [Retry Pattern →](./docs/patterns/retry.md)
- [Timeout Pattern →](./docs/patterns/timeout.md)
- [Circuit Breaker →](./docs/patterns/circuit-breaker.md)
- [Rate Limiter →](./docs/patterns/rate-limiter.md)
- [Fan-Out →](./docs/patterns/fan-out.md)
- [Saga →](./docs/patterns/saga.md)
- [Human-in-the-Loop →](./docs/patterns/human-in-the-loop.md)
- [Idempotency →](./docs/patterns/idempotency.md)

**Runnable examples:**
- [View all examples →](./examples/basic)

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


## Acknowledgments

Inspired by:
- [Vercel AI SDK](https://sdk.vercel.ai) - Developer experience
- [Polly](https://github.com/App-vNext/Polly) - Resilience patterns
- [ts-retry](https://github.com/wankdanker/ts-retry) - TypeScript patterns

---

**Built with ❤️ by [Serge KOKOUA](https://github.com/sergekokoua)**

*Empowering developers to build solid and robust AI applications.*

