# Conditional Branch Pattern

Execute different workflows based on conditions. Essential for building intelligent decision trees and adaptive AI workflows.

## Overview

The conditional branch pattern provides if/else logic for async workflows, enabling dynamic execution paths based on runtime conditions.

### Key Features

- **Async conditions** - Evaluate conditions asynchronously
- **Type-safe branches** - Both branches return same type
- **Observable** - Track which branch executed
- **Composable** - Nest conditions for complex logic

### Use Cases

- **Approval workflows** - Auto vs manual approval
- **AI routing** - Choose AI model based on complexity
- **Feature flags** - Dynamic feature enabling
- **Payment processing** - Different flows by amount

---

## Basic Usage

```typescript
import { conditionalBranch } from 'ai-patterns';

const result = await conditionalBranch({
  condition: (data) => data.amount > 1000,

  onTrue: async (data) => {
    return await manualApproval(data);
  },

  onFalse: async (data) => {
    return await autoApprove(data);
  }
}, { amount: 1500 });
```

---

## API Reference

### `conditionalBranch<TInput, TResult>(options, input): Promise<TResult>`

#### Options

```typescript
interface ConditionalBranchOptions<TInput, TResult> {
  condition: (input: TInput) => MaybePromise<boolean>;
  onTrue: AsyncFunction<TResult, [TInput]>;
  onFalse: AsyncFunction<TResult, [TInput]>;
  logger?: Logger;
  onBranchSelected?: (branch: "true" | "false") => void;
}
```

---

## Examples

### AI Model Selection by Complexity

```typescript
import { conditionalBranch } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

async function smartAI(prompt: string) {
  return await conditionalBranch({
    condition: async (p) => {
      // Use simple model to check complexity
      const complexity = await analyzeComplexity(p);
      return complexity > 0.7;
    },

    onTrue: async (p) => {
      // Complex query → GPT-4
      console.log('🧠 Using GPT-4 (complex query)');
      const { text } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt: p
      });
      return { text, model: 'GPT-4' };
    },

    onFalse: async (p) => {
      // Simple query → Claude Haiku (cheaper)
      console.log('⚡ Using Claude Haiku (simple query)');
      const { text } = await generateText({
        model: anthropic('claude-3-haiku-20240307'),
        prompt: p
      });
      return { text, model: 'Claude-Haiku' };
    }
  }, prompt);
}

const result = await smartAI('Explain quantum physics');
console.log(`Used ${result.model}`);
```

### Nested Conditions

```typescript
async function processPayment(payment: Payment) {
  return await conditionalBranch({
    condition: (p) => p.amount > 10000,

    onTrue: async (p) => {
      // High value → Additional verification
      return await conditionalBranch({
        condition: (p) => p.user.verified,
        onTrue: async (p) => approveHighValue(p),
        onFalse: async (p) => requestVerification(p)
      }, p);
    },

    onFalse: async (p) => {
      // Low value → Auto approve
      return await autoApprove(p);
    }
  }, payment);
}
```

### Feature Flag Branching

```typescript
const result = await conditionalBranch({
  condition: async () => {
    const flags = await getFeatureFlags();
    return flags.useNewAI;
  },

  onTrue: async (data) => {
    return await newAIService.process(data);
  },

  onFalse: async (data) => {
    return await legacyService.process(data);
  }
}, inputData);
```

---

## Best Practices

### ✅ Do

1. **Keep conditions simple** - Easy to understand and test
2. **Use async conditions** - For dynamic checks (DB, API)
3. **Track branch selection** - Monitor which paths are taken
4. **Type safety** - Ensure both branches return same type

### ❌ Don't

1. **Don't nest too deeply** - Max 2-3 levels
2. **Don't put side effects in condition** - Keep conditions pure
3. **Don't duplicate logic** - Extract common code

---

## Related Patterns

- **[Saga](./saga.md)** - Multi-step workflows
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Conditional escalation

---

**[← Back to Documentation](../../README.md#patterns)**
