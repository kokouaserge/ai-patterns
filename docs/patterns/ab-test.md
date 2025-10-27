# A/B Testing Pattern

Test multiple variants simultaneously and measure their performance to continuously optimize AI applications.

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

The A/B Testing pattern enables you to test multiple variants (prompts, models, strategies) simultaneously and measure their performance to make data-driven optimization decisions.

### Key Features

- **Weighted selection** - Control traffic distribution across variants
- **Sticky assignments** - Consistent experience per user
- **Type-safe** - Full TypeScript support with generics
- **Observable** - Callbacks for tracking and analytics
- **Zero dependencies** - Lightweight implementation

### Use Cases

- **Prompt optimization** - Test different prompt variations
- **Model selection** - Compare GPT-4 vs GPT-3.5 vs Claude
- **Strategy testing** - Test different AI approaches
- **Cost optimization** - Balance quality vs cost
- **Performance tuning** - Optimize response time and quality

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Simple A/B Test

```typescript
import { abTest } from 'ai-patterns';

const result = await abTest({
  variants: [
    {
      name: 'Simple',
      weight: 0.5,
      execute: async () => generateText({ prompt: 'Explain quantum computing' })
    },
    {
      name: 'Detailed',
      weight: 0.5,
      execute: async () => generateText({
        prompt: 'Explain quantum computing with examples'
      })
    }
  ],
  userId: 'user-123',
  experimentId: 'prompt-optimization-v1'
});

console.log(`Selected variant: ${result.variant.name}`);
console.log(`Result: ${result.value}`);
```

### With Analytics Tracking

```typescript
const result = await abTest({
  variants: [
    { name: 'A', weight: 0.5, execute: () => variantA() },
    { name: 'B', weight: 0.5, execute: () => variantB() }
  ],
  userId: 'user-123',
  experimentId: 'test-v1',
  onVariantSelected: (variant, result) => {
    analytics.track('variant_selected', {
      variant: variant.name,
      experimentId: 'test-v1'
    });
  },
  onSuccess: (variant, result) => {
    analytics.track('variant_success', {
      variant: variant.name,
      result
    });
  }
});
```

---

## API Reference

### `abTest<TResult>(config: ABTestConfig<TResult>): Promise<ABTestResult<TResult>>`

Execute an A/B test with the given configuration.

#### Configuration Options

```typescript
interface ABTestConfig<TResult> {
  // Required
  variants: ABTestVariant<TResult>[];

  // Optional
  userId?: string;                      // For consistent assignments
  experimentId?: string;                // Track experiment
  strategy?: VariantAssignmentStrategy; // Assignment strategy (default: WEIGHTED)
  storage?: AssignmentStorage;          // Storage for sticky assignments
  metrics?: MetricsConfig;              // Metrics to track
  conversionTracking?: boolean;         // Enable conversion tracking

  // Callbacks
  onVariantSelected?: (variant, result) => void;
  onSuccess?: (variant, result, feedback) => void;
  onError?: (variant, error) => void;

  // Logger
  logger?: Logger;
}

enum VariantAssignmentStrategy {
  RANDOM = "random",      // Random selection without user consistency
  WEIGHTED = "weighted",  // Weighted selection with user consistency (default)
  STICKY = "sticky"       // Sticky assignments - same user always gets same variant
}

interface ABTestVariant<TResult> {
  name: string;                         // Unique variant name
  weight: number;                       // Selection weight (0-1)
  execute: () => Promise<TResult>;      // Variant function
}
```

#### Result

```typescript
interface ABTestResult<TResult> {
  variant: ABTestVariant<TResult>;      // Selected variant
  value: TResult;                       // Execution result
  timestamp: number;                    // Execution timestamp
  userId?: string;                      // User ID (if provided)
  experimentId?: string;                // Experiment ID (if provided)
}
```

---

## Advanced Features

### Sticky Assignments

Keep users in the same variant across sessions:

```typescript
import { abTest, InMemoryAssignmentStorage, VariantAssignmentStrategy } from 'ai-patterns';

const storage = new InMemoryAssignmentStorage();

const result = await abTest({
  variants: [...],
  userId: 'user-123',
  experimentId: 'test-v1',
  strategy: VariantAssignmentStrategy.STICKY,
  storage  // Users always see the same variant
});
```

### Assignment Strategies

```typescript
import { abTest, VariantAssignmentStrategy } from 'ai-patterns';

// WEIGHTED (default) - Consistent per user, weighted distribution
const result1 = await abTest({
  variants: [...],
  userId: 'user-123',
  strategy: VariantAssignmentStrategy.WEIGHTED
});

// STICKY - Persistent assignments across sessions
const result2 = await abTest({
  variants: [...],
  userId: 'user-123',
  strategy: VariantAssignmentStrategy.STICKY,
  storage: new InMemoryAssignmentStorage()
});

// RANDOM - Truly random, no user consistency
const result3 = await abTest({
  variants: [...],
  strategy: VariantAssignmentStrategy.RANDOM
});
```

### Custom Storage

Implement persistent storage:

```typescript
class RedisAssignmentStorage implements AssignmentStorage {
  async get(userId: string, experimentId: string): Promise<string | null> {
    return await redis.get(`ab:${experimentId}:${userId}`);
  }

  async set(userId: string, experimentId: string, variantName: string): Promise<void> {
    await redis.set(`ab:${experimentId}:${userId}`, variantName);
  }
}

const result = await abTest({
  variants: [...],
  strategy: VariantAssignmentStrategy.STICKY,
  storage: new RedisAssignmentStorage()
});
```

### Multi-Variant Testing

Test more than two variants:

```typescript
const result = await abTest({
  variants: [
    { name: 'Control', weight: 0.25, execute: () => controlVariant() },
    { name: 'Variant A', weight: 0.25, execute: () => variantA() },
    { name: 'Variant B', weight: 0.25, execute: () => variantB() },
    { name: 'Variant C', weight: 0.25, execute: () => variantC() }
  ],
  userId: 'user-123'
});
```

---

## Examples

### Model Selection

```typescript
const result = await abTest({
  variants: [
    {
      name: 'GPT-4 Turbo',
      weight: 0.3,
      execute: async () => {
        const { text, usage } = await generateText({
          model: openai('gpt-4-turbo'),
          prompt
        });
        return { text, tokens: usage.totalTokens, model: 'gpt-4' };
      }
    },
    {
      name: 'GPT-3.5 Turbo',
      weight: 0.7,
      execute: async () => {
        const { text, usage } = await generateText({
          model: openai('gpt-3.5-turbo'),
          prompt
        });
        return { text, tokens: usage.totalTokens, model: 'gpt-3.5' };
      }
    }
  ],
  userId: 'user-123',
  experimentId: 'model-selection-v1'
});
```

### Prompt Optimization

```typescript
const result = await abTest({
  variants: [
    {
      name: 'Direct',
      weight: 0.33,
      execute: () => generateText({ prompt: 'Summarize this text' })
    },
    {
      name: 'Step-by-step',
      weight: 0.33,
      execute: () => generateText({
        prompt: 'Summarize this text step by step'
      })
    },
    {
      name: 'With examples',
      weight: 0.34,
      execute: () => generateText({
        prompt: 'Summarize this text with key examples'
      })
    }
  ],
  userId: 'user-123',
  onSuccess: (variant, result) => {
    // Track which prompt performed best
    analytics.track('prompt_test', {
      variant: variant.name,
      satisfaction: calculateSatisfaction(result)
    });
  }
});
```

---

## Error Handling

### Built-in Error Codes

The pattern uses `PatternError` with specific error codes:

```typescript
import { PatternError, ErrorCode } from 'ai-patterns';

try {
  const result = await abTest({
    variants: []  // Empty variants
  });
} catch (error) {
  if (error instanceof PatternError) {
    switch (error.code) {
      case ErrorCode.NO_VARIANTS:
        console.error('No variants provided');
        break;
      case ErrorCode.VARIANT_EXECUTION_FAILED:
        console.error(`Variant failed: ${error.metadata?.variantName}`);
        break;
    }
  }
}
```

### Error Callbacks

```typescript
const result = await abTest({
  variants: [...],
  onError: async (variant, error) => {
    console.error(`Variant ${variant.name} failed:`, error);

    // Log to monitoring
    await logger.error('variant_failed', {
      variant: variant.name,
      error: error.message
    });

    // Alert team
    await slack.send(`Variant ${variant.name} is failing`);
  }
});
```

---

## Best Practices

### 1. Use Meaningful Variant Names

```typescript
// ✅ Good
variants: [
  { name: 'gpt4-detailed-prompt', ... },
  { name: 'gpt35-concise-prompt', ... }
]

// ❌ Bad
variants: [
  { name: 'a', ... },
  { name: 'b', ... }
]
```

### 2. Track Comprehensive Metrics

```typescript
const result = await abTest({
  variants: [...],
  onSuccess: async (variant, result) => {
    await analytics.track({
      experiment: 'model-test',
      variant: variant.name,

      // Quality metrics
      responseLength: result.text.length,
      userSatisfaction: await getUserFeedback(),

      // Performance metrics
      latency: result.latency,
      tokens: result.tokens,

      // Cost metrics
      cost: result.tokens * costPerToken
    });
  }
});
```

### 3. Start with Equal Weights

```typescript
// Start 50/50, then adjust based on data
variants: [
  { name: 'Control', weight: 0.5, ... },
  { name: 'Variant', weight: 0.5, ... }
]
```

### 4. Use Sticky Assignments for UX

```typescript
import { abTest, VariantAssignmentStrategy, InMemoryAssignmentStorage } from 'ai-patterns';

// Ensure users see consistent experience
const result = await abTest({
  variants: [...],
  userId: 'user-123',
  strategy: VariantAssignmentStrategy.STICKY,
  storage: new InMemoryAssignmentStorage()
});
```

### 5. Set Clear Success Metrics

```typescript
const result = await abTest({
  variants: [...],
  onSuccess: async (variant, result) => {
    // Define what success means
    const metrics = {
      quality: calculateQuality(result),
      speed: result.latency,
      cost: result.cost,
      userSatisfaction: await getUserRating()
    };

    // Track for analysis
    await db.saveMetrics(variant.name, metrics);
  }
});
```

---

## Related Patterns

- **[Cost Tracking](./cost-tracking.md)** - Track costs per variant
- **[Retry](./retry.md)** - Handle variant failures
- **[Fallback](./fallback.md)** - Fallback when variants fail
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Escalate variant decisions

---

## See Also

- [API Reference](../api-reference.md)
- [Examples](../../examples/basic/ab-test-simple.ts)
- [Combined with Cost Tracking](../../examples/composition/ab-test-with-cost-tracking.ts)
