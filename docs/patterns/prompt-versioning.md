# Prompt Versioning & Experimentation Pattern

Manage prompt versions with rollback, gradual rollout, and performance comparison for safe prompt experimentation.

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

The Prompt Versioning pattern enables you to manage multiple versions of prompts with safe rollback capabilities, gradual rollout, and automatic performance tracking.

### Key Features

- **Version management** - Track and manage multiple prompt versions
- **Gradual rollout** - Roll out new prompts to a percentage of traffic
- **Auto-rollback** - Automatically revert to stable versions on performance degradation
- **Performance tracking** - Monitor satisfaction, tokens, error rates
- **Type-safe** - Full TypeScript support with generics
- **Observable** - Rich callbacks for monitoring and analytics

### Use Cases

- **Prompt experimentation** - Test new prompt formulations safely
- **A/B testing prompts** - Compare prompt performance
- **Production rollouts** - Gradually deploy new prompts
- **Quality assurance** - Ensure prompt quality before full deployment
- **Cost optimization** - Track token usage across versions

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Simple Version Management

```typescript
import { versionedPrompt } from 'ai-patterns';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await versionedPrompt({
  promptId: 'product-summary',
  versions: {
    'v1.0': {
      prompt: 'Summarize this product in 2 sentences',
      active: false,
      performance: {
        satisfaction: 0.75,
        avgTokens: 50
      }
    },
    'v2.0': {
      prompt: 'Create engaging 2-sentence product summary',
      active: true,
      rolloutPercentage: 100
    }
  },
  execute: async (prompt, version) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: prompt + '\n\n' + productData
    });
    return text;
  }
});

console.log(result.value); // Generated text
console.log(result.version); // 'v2.0'
```

### Gradual Rollout

```typescript
const result = await versionedPrompt({
  promptId: 'user-greeting',
  versions: {
    'v1.0-stable': {
      prompt: 'Greet the user professionally',
      active: true,
      rolloutPercentage: 70, // 70% of traffic
      performance: { satisfaction: 0.82 }
    },
    'v2.0-experimental': {
      prompt: 'Greet the user warmly and mention their name',
      active: true,
      rolloutPercentage: 30, // 30% of traffic (testing)
      performance: { satisfaction: 0.88 }
    }
  },
  execute: async (prompt) => {
    return await generateGreeting(prompt);
  },
  onVersionUsed: (version, result) => {
    analytics.track('prompt_version', {
      version,
      tokens: result.tokens
    });
  }
});
```

---

## API Reference

### `versionedPrompt<TResult>(config)`

Execute a prompt with version management.

#### Parameters

```typescript
interface PromptVersioningConfig<TResult> {
  // Unique identifier for this prompt
  promptId: string;

  // Map of version names to version configurations
  versions: Record<string, PromptVersion>;

  // Function to execute a prompt
  execute: (prompt: string, version: string) => Promise<TResult> | TResult;

  // Callback when version is used
  onVersionUsed?: (version: string, result: ExecutionResult<TResult>) => void | Promise<void>;

  // Callback on success
  onSuccess?: (version: string, result: ExecutionResult<TResult>) => void | Promise<void>;

  // Callback on error
  onError?: (version: string, error: Error) => void | Promise<void>;

  // Auto-rollback configuration
  autoRollback?: AutoRollbackConfig;

  // Logger instance
  logger?: Logger;

  // Storage for metrics
  storage?: PromptVersionStorage;
}

interface PromptVersion {
  // The actual prompt text
  prompt: string;

  // Whether this version is active
  active: boolean;

  // Performance metrics
  performance?: PromptVersionMetrics;

  // Percentage of traffic (0-100)
  rolloutPercentage?: number;

  // Version metadata
  metadata?: Record<string, any>;
}

interface PromptVersionMetrics {
  satisfaction?: number;      // User satisfaction (0-1)
  avgTokens?: number;          // Average tokens used
  errorRate?: number;          // Error rate (0-1)
  avgResponseTime?: number;    // Average response time (ms)
  usageCount?: number;         // Number of uses
  [key: string]: number | undefined;
}
```

#### Returns

```typescript
interface PromptVersionExecutionResult<TResult> {
  value: TResult;              // Execution result
  version: string;             // Version used
  timestamp: number;           // Execution timestamp
  responseTime?: number;       // Response time (ms)
  tokens?: number;             // Token usage
  userFeedback?: any;          // User feedback
  metrics?: Record<string, number>;
}
```

---

## Advanced Features

### Auto-Rollback on Performance Degradation

```typescript
const result = await versionedPrompt({
  promptId: 'critical-prompt',
  versions: {
    'v2.0': {
      prompt: 'New experimental prompt',
      active: true,
      rolloutPercentage: 50
    },
    'v1.0': {
      prompt: 'Stable production prompt',
      active: false,
      performance: { satisfaction: 0.85 }
    }
  },
  execute: async (prompt) => {
    return await generateText({ model, prompt });
  },
  autoRollback: {
    enabled: true,
    conditions: [
      {
        metric: 'satisfaction',
        threshold: 0.7,
        window: '1h',
        operator: 'lt' // Less than
      },
      {
        metric: 'errorRate',
        threshold: 0.05,
        window: '30m',
        operator: 'gt' // Greater than
      }
    ]
  },
  onVersionUsed: async (version, result) => {
    // Track user feedback
    const rating = await getUserFeedback(result.value);
    await storage.updateMetrics(promptId, version, {
      satisfaction: rating
    });
  }
});
```

### Custom Storage Backend

```typescript
import { InMemoryPromptVersionStorage } from 'ai-patterns';

class RedisPromptVersionStorage implements PromptVersionStorage {
  async getMetrics(promptId: string, version: string) {
    const data = await redis.get(`metrics:${promptId}:${version}`);
    return data ? JSON.parse(data) : null;
  }

  async updateMetrics(promptId: string, version: string, metrics: Partial<PromptVersionMetrics>) {
    const key = `metrics:${promptId}:${version}`;
    const existing = await this.getMetrics(promptId, version);
    await redis.set(key, JSON.stringify({ ...existing, ...metrics }));
  }

  async getActiveVersion(promptId: string) {
    return await redis.get(`active:${promptId}`);
  }

  async setActiveVersion(promptId: string, version: string) {
    await redis.set(`active:${promptId}`, version);
  }

  async getVersionHistory(promptId: string) {
    const data = await redis.lrange(`history:${promptId}`, 0, -1);
    return data;
  }
}

const storage = new RedisPromptVersionStorage();

const result = await versionedPrompt({
  promptId: 'product-summary',
  versions,
  execute,
  storage // Use Redis storage
});
```

### Version Comparison Analytics

```typescript
const analytics = {
  versionMetrics: new Map<string, PromptVersionMetrics>()
};

const result = await versionedPrompt({
  promptId: 'email-subject',
  versions: {
    'v1.0': { prompt: 'Create subject line', active: true, rolloutPercentage: 50 },
    'v2.0': { prompt: 'Create catchy subject line', active: true, rolloutPercentage: 50 }
  },
  execute: async (prompt) => {
    return await generateSubject(prompt);
  },
  onVersionUsed: async (version, result) => {
    const metrics = analytics.versionMetrics.get(version) || {
      usageCount: 0,
      avgTokens: 0,
      satisfaction: 0
    };

    metrics.usageCount++;
    metrics.avgTokens = (metrics.avgTokens * (metrics.usageCount - 1) + result.tokens!) / metrics.usageCount;

    analytics.versionMetrics.set(version, metrics);
  }
});

// Compare versions
console.log('Version Performance:');
analytics.versionMetrics.forEach((metrics, version) => {
  console.log(`${version}: ${metrics.usageCount} uses, ${metrics.avgTokens} avg tokens`);
});
```

---

## Examples

### Complete Production Example

```typescript
import { versionedPrompt, InMemoryPromptVersionStorage } from 'ai-patterns';

const storage = new InMemoryPromptVersionStorage();

async function generateProductDescription(productData: any) {
  return await versionedPrompt({
    promptId: 'product-description',
    versions: {
      'v1.0-basic': {
        prompt: 'Write a product description',
        active: false,
        performance: {
          satisfaction: 0.72,
          avgTokens: 80,
          usageCount: 10000
        }
      },
      'v2.0-seo': {
        prompt: 'Write an SEO-optimized product description with key benefits',
        active: true,
        rolloutPercentage: 80,
        performance: {
          satisfaction: 0.85,
          avgTokens: 95,
          usageCount: 5000
        }
      },
      'v3.0-experimental': {
        prompt: 'Create compelling product story highlighting unique value',
        active: true,
        rolloutPercentage: 20,
        performance: {
          satisfaction: 0.88,
          avgTokens: 110,
          usageCount: 500
        }
      }
    },
    execute: async (prompt, version) => {
      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: `${prompt}\n\nProduct: ${JSON.stringify(productData)}`
      });
      return text;
    },
    storage,
    autoRollback: {
      enabled: true,
      conditions: [
        { metric: 'satisfaction', threshold: 0.75, window: '2h', operator: 'lt' },
        { metric: 'errorRate', threshold: 0.1, window: '1h', operator: 'gt' }
      ]
    },
    onVersionUsed: async (version, result) => {
      // Track in analytics
      await analytics.track('prompt_version_used', {
        version,
        promptId: 'product-description',
        tokens: result.tokens,
        responseTime: result.responseTime
      });

      // Update metrics based on user interaction
      setTimeout(async () => {
        const userRating = await getUserFeedback(result.value);
        await storage.updateMetrics('product-description', version, {
          satisfaction: userRating
        });
      }, 5000);
    }
  });
}
```

---

## Error Handling

### Handling Version Errors

```typescript
try {
  const result = await versionedPrompt({
    promptId: 'test',
    versions,
    execute,
    onError: async (version, error) => {
      // Log error with version context
      logger.error(`Version ${version} failed`, { error });

      // Update error metrics
      await storage.updateMetrics(promptId, version, {
        errorRate: 1.0
      });
    }
  });
} catch (error) {
  if (error instanceof PatternError) {
    console.error('Prompt versioning failed:', error.message);
    console.error('Context:', error.context);
  }
}
```

---

## Best Practices

### 1. Start with Small Rollouts

```typescript
// Roll out new versions gradually
'v2.0-new': {
  active: true,
  rolloutPercentage: 10, // Start with 10%
  // Increase to 25%, 50%, 100% as confidence grows
}
```

### 2. Monitor Key Metrics

```typescript
onVersionUsed: async (version, result) => {
  // Track multiple metrics
  await storage.updateMetrics(promptId, version, {
    satisfaction: await getUserRating(result),
    avgTokens: result.tokens,
    avgResponseTime: result.responseTime
  });
}
```

### 3. Use Auto-Rollback in Production

```typescript
autoRollback: {
  enabled: true,
  conditions: [
    { metric: 'satisfaction', threshold: 0.7, window: '1h' },
    { metric: 'errorRate', threshold: 0.05, window: '30m' }
  ]
}
```

### 4. Version Naming Convention

```typescript
versions: {
  'v1.0-stable': { /* ... */ },      // Production version
  'v2.0-beta': { /* ... */ },        // Beta testing
  'v2.1-experimental': { /* ... */ } // Experimental features
}
```

---

## Related Patterns

- **[A/B Testing](./ab-test.md)** - For testing multiple variants
- **[Cost Tracking](./cost-tracking.md)** - Monitor token costs per version
- **[Response Validation](./response-validation.md)** - Validate version outputs
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Add human review for new versions

---

## See Also

- [Basic Example](../../examples/basic/prompt-versioning-simple.ts)
- [Advanced Example](../../examples/composition/prompt-versioning-with-monitoring.ts)
- [API Documentation](../../README.md)
