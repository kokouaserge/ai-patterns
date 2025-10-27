# Cost Tracking Pattern

Monitor and control AI spending in real-time, preventing budget overruns and optimizing costs across your application.

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

The Cost Tracking pattern provides real-time monitoring and control of AI spending, with budget limits, alerts, and detailed cost analytics.

### Key Features

- **Real-time tracking** - Monitor costs as they occur
- **Budget limits** - Monthly, daily, and hourly budgets
- **Multi-tier alerts** - Customizable spending thresholds
- **Cost tagging** - Categorize costs by feature, user, etc.
- **Automatic period reset** - Budget periods reset automatically
- **Type-safe** - Full TypeScript support
- **Zero dependencies** - Lightweight implementation

### Use Cases

- **Budget control** - Prevent unexpected AI bills
- **Cost optimization** - Identify expensive operations
- **Per-user limits** - Control spending per user/plan
- **Feature cost tracking** - Track costs per feature
- **Multi-tenant applications** - Separate costs by tenant

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Simple Cost Tracking

```typescript
import { costTracking, ModelCost } from 'ai-patterns';

const result = await costTracking({
  execute: async () => {
    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Explain quantum computing'
    });
    return { value: text, tokens: usage.totalTokens };
  },
  costPerToken: ModelCost.GPT4_TURBO,  // Predefined pricing
  monthlyBudget: 500,
  dailyLimit: 50
});

console.log(`Cost: $${result.cost.toFixed(4)}`);
console.log(`Remaining: $${result.remainingBudget?.toFixed(2)}`);
```

### With Budget Alerts

```typescript
const result = await costTracking({
  execute: async () => {
    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt
    });
    return { value: text, tokens: usage.totalTokens };
  },
  costPerToken: ModelCost.GPT4_TURBO,
  monthlyBudget: 1000,
  onBudgetWarning: (spent, limit) => {
    console.warn(`⚠️ Budget at 80%: $${spent}/$${limit}`);
    slack.send(`AI budget warning: ${(spent/limit*100).toFixed(0)}%`);
  },
  onBudgetExceeded: (spent, limit) => {
    console.error(`🚨 Budget exceeded: $${spent} > $${limit}`);
    pagerduty.alert('AI budget exceeded');
  }
});
```

---

## API Reference

### `costTracking<TResult>(config: CostTrackingConfig<TResult>): Promise<CostResult<TResult>>`

Execute an operation with cost tracking.

#### Configuration Options

```typescript
interface CostTrackingConfig<TResult> {
  // Required
  execute: () => Promise<{ value: TResult; tokens?: number }>;
  costPerToken: number;                 // Cost per token (use ModelCost enum)

  // Budget limits
  monthlyBudget?: number;               // Monthly limit in dollars
  dailyLimit?: number;                  // Daily limit in dollars
  hourlyLimit?: number;                 // Hourly limit in dollars
  budget?: {                            // Alternative format
    monthly?: number;
    daily?: number;
    hourly?: number;
  };

  // Alerts
  alerts?: AlertConfig[];               // Custom alert thresholds
  costThresholdWarning?: number;        // Per-operation warning

  // Tagging
  tags?: Record<string, string>;        // Cost categorization

  // Callbacks
  onCostCalculated?: (cost, tags) => void;
  onBudgetWarning?: (spent, limit) => void;
  onBudgetExceeded?: (spent, limit) => void;
  onExpensiveOperation?: (cost, tags) => void;

  // Storage and logging
  storage?: CostStorage;
  logger?: Logger;
}

interface AlertConfig {
  threshold: number;                    // 0.0 to 1.0 (percentage)
  action: (spent, limit) => void;       // Alert action
}

// Predefined costs per 1M tokens for popular AI models
// All prices are in dollars per million tokens (input pricing)
enum ModelCost {
  // OpenAI GPT-4 models
  GPT4_TURBO = 0.00001,      // $10 per 1M tokens
  GPT4 = 0.00003,            // $30 per 1M tokens
  GPT4_32K = 0.00006,        // $60 per 1M tokens

  // OpenAI GPT-3.5 models
  GPT35_TURBO = 0.0000005,   // $0.50 per 1M tokens
  GPT35_TURBO_16K = 0.000001, // $1.00 per 1M tokens

  // Anthropic Claude models
  CLAUDE_3_5_SONNET = 0.000003,  // $3 per 1M tokens
  CLAUDE_3_OPUS = 0.000015,      // $15 per 1M tokens
  CLAUDE_3_SONNET = 0.000003,    // $3 per 1M tokens
  CLAUDE_3_HAIKU = 0.00000025,   // $0.25 per 1M tokens

  // Google Gemini models
  GEMINI_1_5_PRO = 0.00000125,   // $1.25 per 1M tokens
  GEMINI_1_5_FLASH = 0.000000075, // $0.075 per 1M tokens
}
```

#### Result

```typescript
interface CostResult<TResult> {
  value: TResult;                       // Operation result
  cost: number;                         // Operation cost
  tokens?: number;                      // Tokens used
  remainingBudget?: number;             // Remaining monthly budget
  tags?: Record<string, string>;        // Cost tags
  timestamp: number;                    // Execution timestamp
}
```

### `createCostTracker<TResult>(baseConfig): (execute) => Promise<CostResult<TResult>>`

Create a reusable cost tracker with shared configuration.

```typescript
const tracker = createCostTracker({
  costPerToken: 0.00003,
  monthlyBudget: 500,
  tags: { feature: 'chatbot' }
});

// Reuse for multiple operations
const result1 = await tracker(async () => operation1());
const result2 = await tracker(async () => operation2());
```

---

## Advanced Features

### Multi-Level Alerts

Set up alerts at different spending thresholds:

```typescript
const result = await costTracking({
  execute: async () => { ... },
  monthlyBudget: 1000,
  alerts: [
    {
      threshold: 0.5,  // 50%
      action: async (spent) => {
        console.log(`💡 Budget at 50%: $${spent}`);
      }
    },
    {
      threshold: 0.8,  // 80%
      action: async (spent) => {
        console.log(`⚠️ Budget at 80%: $${spent}`);
        await slack.send('AI budget warning');
      }
    },
    {
      threshold: 0.95,  // 95%
      action: async (spent) => {
        console.log(`🚨 Budget at 95%: $${spent}`);
        await pagerduty.alert('Critical budget alert');
        // Switch to cheaper model
        switchToGPT35();
      }
    }
  ]
});
```

### Cost Tagging

Categorize costs for detailed analytics:

```typescript
const result = await costTracking({
  execute: async () => { ... },
  costPerToken: 0.00003,
  tags: {
    feature: 'chatbot',
    userId: 'user-123',
    plan: 'premium',
    environment: 'production'
  },
  onCostCalculated: async (cost, tags) => {
    // Store for analytics
    await db.costs.insert({
      cost,
      ...tags,
      timestamp: Date.now()
    });
  }
});

// Later: Analyze costs
const costsByFeature = await db.costs.groupBy('feature');
const costsByUser = await db.costs.groupBy('userId');
```

### Per-User Budget Limits

Implement per-user or per-plan limits:

```typescript
const userBudgets = {
  free: { monthly: 5, daily: 0.5 },
  pro: { monthly: 100, daily: 10 },
  enterprise: { monthly: 10000, daily: 1000 }
};

const result = await costTracking({
  execute: async () => { ... },
  costPerToken: 0.00003,
  budget: userBudgets[user.plan],
  tags: { userId: user.id, plan: user.plan }
});
```

### Custom Storage

Implement persistent cost tracking:

```typescript
class RedisCostStorage implements CostStorage {
  async getSpent(period: 'monthly' | 'daily' | 'hourly'): Promise<number> {
    const key = `costs:${period}:${this.getPeriodKey(period)}`;
    const spent = await redis.get(key);
    return spent ? parseFloat(spent) : 0;
  }

  async addSpent(period: 'monthly' | 'daily' | 'hourly', amount: number): Promise<void> {
    const key = `costs:${period}:${this.getPeriodKey(period)}`;
    await redis.incrByFloat(key, amount);
    await redis.expire(key, this.getTTL(period));
  }

  async resetSpent(period: 'monthly' | 'daily' | 'hourly'): Promise<void> {
    const key = `costs:${period}:${this.getPeriodKey(period)}`;
    await redis.del(key);
  }

  private getPeriodKey(period: string): string {
    const now = new Date();
    switch (period) {
      case 'monthly': return `${now.getFullYear()}-${now.getMonth() + 1}`;
      case 'daily': return now.toISOString().split('T')[0];
      case 'hourly': return `${now.toISOString().split(':')[0]}:00`;
    }
  }

  private getTTL(period: string): number {
    switch (period) {
      case 'monthly': return 32 * 24 * 60 * 60;  // 32 days
      case 'daily': return 26 * 60 * 60;         // 26 hours
      case 'hourly': return 2 * 60 * 60;         // 2 hours
    }
  }
}

const result = await costTracking({
  execute: async () => { ... },
  storage: new RedisCostStorage()
});
```

---

## Examples

### Basic Cost Tracking

```typescript
const result = await costTracking({
  execute: async () => {
    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Summarize this article'
    });
    return { value: text, tokens: usage.totalTokens };
  },
  costPerToken: 0.00003,
  monthlyBudget: 500
});

console.log(`Cost: $${result.cost.toFixed(4)}`);
console.log(`Tokens: ${result.tokens}`);
console.log(`Remaining: $${result.remainingBudget?.toFixed(2)}`);
```

### Expensive Operation Detection

```typescript
const result = await costTracking({
  execute: async () => {
    const { text, usage } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: longDocument  // Could be expensive
    });
    return { value: text, tokens: usage.totalTokens };
  },
  costPerToken: 0.00003,
  costThresholdWarning: 0.5,  // Alert if > $0.50
  onExpensiveOperation: async (cost, tags) => {
    console.log(`🔥 Expensive operation: $${cost.toFixed(4)}`);

    // Suggest optimization
    if (cost > 1.0) {
      console.log('💡 Consider using GPT-3.5 or chunking');
    }

    // Log for review
    await db.expensiveOps.insert({
      cost,
      tags,
      timestamp: Date.now()
    });
  }
});
```

### Multi-Tenant Cost Tracking

```typescript
async function handleRequest(tenant: Tenant, request: Request) {
  const result = await costTracking({
    execute: async () => {
      const { text, usage } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: request.prompt
      });
      return { value: text, tokens: usage.totalTokens };
    },
    costPerToken: 0.00003,
    budget: tenant.budget,
    tags: {
      tenantId: tenant.id,
      tenantPlan: tenant.plan,
      feature: request.feature
    },
    onCostCalculated: async (cost, tags) => {
      // Bill the tenant
      await billing.addCharge({
        tenantId: tags.tenantId,
        amount: cost * 1.3,  // 30% markup
        description: 'AI API Usage',
        metadata: tags
      });
    }
  });

  return result;
}
```

### Model Pricing Reference

```typescript
// Common model pricing (as of 2024)
const MODEL_PRICING = {
  'gpt-4-turbo': 0.00003,           // $0.03/1K tokens
  'gpt-3.5-turbo': 0.000001,        // $0.001/1K tokens
  'claude-3-5-sonnet': 0.000015,    // $0.015/1K tokens
  'claude-3-haiku': 0.00000025,     // $0.00025/1K tokens
  'gemini-1.5-pro': 0.0000035,      // $0.0035/1K tokens
};

const result = await costTracking({
  execute: async () => { ... },
  costPerToken: MODEL_PRICING['gpt-4-turbo']
});
```

---

## Error Handling

### Built-in Error Codes

The pattern uses `PatternError` with specific error codes:

```typescript
import { PatternError, ErrorCode } from 'ai-patterns';

try {
  const result = await costTracking({
    execute: async () => { ... },
    costPerToken: 0.00003,
    monthlyBudget: 100
  });
} catch (error) {
  if (error instanceof PatternError) {
    switch (error.code) {
      case ErrorCode.BUDGET_EXCEEDED:
        console.error(`Budget exceeded: ${error.metadata?.period}`);
        console.error(`Spent: $${error.metadata?.spent}`);
        console.error(`Limit: $${error.metadata?.limit}`);

        // Notify user
        await notifyUser('Budget limit reached');
        break;

      case ErrorCode.INVALID_COST_CONFIG:
        console.error('Invalid configuration');
        break;
    }
  }
}
```

### Graceful Degradation

```typescript
try {
  const result = await costTracking({
    execute: async () => {
      const { text, usage } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt
      });
      return { value: text, tokens: usage.totalTokens };
    },
    costPerToken: 0.00003,
    monthlyBudget: 500
  });
} catch (error) {
  if (error instanceof PatternError && error.code === ErrorCode.BUDGET_EXCEEDED) {
    // Fallback to cheaper model
    console.log('Budget exceeded, switching to GPT-3.5');

    const fallbackResult = await costTracking({
      execute: async () => {
        const { text, usage } = await generateText({
          model: openai('gpt-3.5-turbo'),
          prompt
        });
        return { value: text, tokens: usage.totalTokens };
      },
      costPerToken: 0.000001,
      monthlyBudget: 500
    });

    return fallbackResult;
  }

  throw error;
}
```

---

## Best Practices

### 1. Set Realistic Budgets

```typescript
// Start with generous limits, then optimize
const result = await costTracking({
  execute: async () => { ... },
  monthlyBudget: 1000,  // Start here
  dailyLimit: 50,       // Prevent daily spikes
  hourlyLimit: 5        // Prevent runaway costs
});

// After monitoring, adjust based on actual usage
```

### 2. Use Tagging for Analytics

```typescript
const result = await costTracking({
  execute: async () => { ... },
  tags: {
    feature: 'chatbot',
    userId: user.id,
    plan: user.plan,
    model: 'gpt-4',
    environment: process.env.NODE_ENV
  }
});

// Analyze costs by any dimension
```

### 3. Implement Multi-Tier Alerts

```typescript
const result = await costTracking({
  execute: async () => { ... },
  monthlyBudget: 1000,
  alerts: [
    { threshold: 0.5, action: () => console.log('50% used') },
    { threshold: 0.8, action: () => slack.warn('80% used') },
    { threshold: 0.95, action: () => pagerduty.alert('95% used') }
  ]
});
```

### 4. Track Expensive Operations

```typescript
const result = await costTracking({
  execute: async () => { ... },
  costThresholdWarning: 0.5,
  onExpensiveOperation: async (cost, tags) => {
    // Log for review
    await db.expensiveOps.insert({ cost, tags });

    // Alert if very expensive
    if (cost > 2.0) {
      await slack.send(`Very expensive operation: $${cost}`);
    }
  }
});
```

### 5. Combine with A/B Testing

```typescript
import { abTest, costTracking } from 'ai-patterns';

// Test models and track costs simultaneously
const result = await costTracking({
  execute: async () => {
    const testResult = await abTest({
      variants: [
        { name: 'GPT-4', weight: 0.3, execute: () => gpt4Call() },
        { name: 'GPT-3.5', weight: 0.7, execute: () => gpt35Call() }
      ]
    });
    return testResult;
  },
  costPerToken: 0.00003,
  monthlyBudget: 500
});

// Measure: Quality × Cost = ROI
```

---

## Related Patterns

- **[A/B Testing](./ab-test.md)** - Test models with cost tracking
- **[Retry](./retry.md)** - Handle cost-conscious retries
- **[Fallback](./fallback.md)** - Fallback to cheaper models
- **[Rate Limiter](./rate-limiter.md)** - Control request rate and costs

---

## See Also

- [API Reference](../api-reference.md)
- [Examples](../../examples/basic/cost-tracking-simple.ts)
- [Combined with A/B Testing](../../examples/composition/ab-test-with-cost-tracking.ts)
