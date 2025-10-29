# Reflection Loop Pattern

Enable AI agents to self-critique and iteratively improve their responses through reflection.

## Overview

The **Reflection Loop** pattern allows AI to generate a response, reflect on its quality, and regenerate with improvements. This creates a feedback loop where the AI becomes its own critic, leading to higher quality outputs.

Perfect for:

- 📝 Content generation requiring high quality (articles, documentation, creative writing)
- 💻 Code generation with self-review
- 🎨 Creative tasks needing refinement
- 📊 Business plans, strategies, and proposals
- 🧪 Experimental prompt optimization
- 🎯 Tasks where quality is subjective and iterative improvement is valuable

### Key Features

- 🔄 **Iterative Improvement** - AI critiques and regenerates until target quality is reached
- 🤖 **Self-Critique** - AI reflects on its own output with detailed feedback
- 📊 **Score-Based** - Track quality scores across iterations
- 📈 **Full History** - Complete audit trail of all attempts and critiques
- 🎯 **Target-Driven** - Stop when quality threshold is met
- 💰 **Cost Tracking** - Monitor tokens and costs per iteration
- 🔍 **Observable** - 12 lifecycle hooks for monitoring
- 💾 **Persistent** - Optional storage for history
- 🎨 **Flexible** - User provides critique logic (simple rules or LLM)
- ⚡ **Zero Dependencies** - Pure TypeScript implementation

---

## API Reference

### Basic Usage

```typescript
import { reflectionLoop } from 'ai-patterns';

const result = await reflectionLoop({
  execute: async (ctx) => {
    const prompt = ctx.iteration === 1
      ? 'Write a blog post about TypeScript'
      : `Previous attempt: ${ctx.previousResponse}
         Critique: ${ctx.previousCritique?.feedback}
         Please improve based on this feedback.`;

    return await generateText({ model, prompt });
  },

  reflect: async (text) => {
    const critique = await generateText({
      model,
      prompt: `Rate this blog post (1-10) and suggest improvements:
               ${text}`
    });

    return {
      score: extractScore(critique),
      feedback: critique,
      shouldContinue: extractScore(critique) < 8
    };
  },

  maxIterations: 5,
  targetScore: 8
});

console.log(result.value); // Best response
console.log(result.finalScore); // Final quality score
console.log(result.iterations); // Number of iterations
console.log(result.history); // Complete history
```

### With Type Safety

```typescript
interface CodeOutput {
  code: string;
  language: string;
  tests: string[];
}

interface CodeCritique {
  correctness: number;
  performance: number;
  readability: number;
  testCoverage: number;
}

const result = await reflectionLoop<CodeOutput>({
  execute: async (ctx) => {
    const prompt = ctx.iteration === 1
      ? 'Write a TypeScript function for binary search with tests'
      : `Previous code: ${ctx.previousResponse?.code}
         Issues found: ${ctx.previousCritique?.feedback}
         Fix and improve the code.`;

    return await generateCode(prompt);
  },

  reflect: async (code, ctx) => {
    // AI reviews its own code
    const review = await generateText({
      model,
      prompt: `Review this code for:
               - Correctness
               - Performance
               - Readability
               - Test coverage

               Code: ${code.code}
               Tests: ${code.tests.join('\n')}

               Provide score (1-10) and specific issues.`
    });

    const critique = parseReview(review);
    const overallScore = (
      critique.correctness +
      critique.performance +
      critique.readability +
      critique.testCoverage
    ) / 4;

    return {
      score: overallScore,
      feedback: review,
      shouldContinue: overallScore < 8
    };
  },

  maxIterations: 5,
  targetScore: 8
});

console.log(result.value.code); // ✅ Fully typed
console.log(result.targetReached); // ✅ Whether quality goal was met
```

### ReflectionLoopConfig<TResponse>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `execute` | `(ctx) => Promise<TResponse>` | ✅ Yes | - | Generate response |
| `reflect` | `(response, ctx) => Promise<ReflectionResult>` | ✅ Yes | - | Critique response |
| `maxIterations` | `number` | ❌ No | `5` | Maximum iterations |
| `targetScore` | `number` | ❌ No | `10` | Target quality score |
| `onMaxIterationsReached` | `'return-best' \| 'return-last' \| 'throw'` | ❌ No | `'return-best'` | Strategy when max iterations hit |
| `onStart` | `(config) => void \| Promise<void>` | ❌ No | `undefined` | Callback at start |
| `onBeforeExecute` | `(context) => void \| Promise<void>` | ❌ No | `undefined` | Callback before execute |
| `onAfterExecute` | `(response, context, time) => void \| Promise<void>` | ❌ No | `undefined` | Callback after execute |
| `onBeforeReflect` | `(response, context) => void \| Promise<void>` | ❌ No | `undefined` | Callback before reflect |
| `onAfterReflect` | `(critique, context, time) => void \| Promise<void>` | ❌ No | `undefined` | Callback after reflect |
| `onIterationComplete` | `(iteration) => void \| Promise<void>` | ❌ No | `undefined` | Callback after iteration |
| `onImprovement` | `(current, previous) => void \| Promise<void>` | ❌ No | `undefined` | Callback on score improvement |
| `onStagnation` | `(current, previous, iter) => void \| Promise<void>` | ❌ No | `undefined` | Callback on stagnation |
| `onTargetReached` | `(iteration, history) => void \| Promise<void>` | ❌ No | `undefined` | Callback on target reached |
| `onMaxIterations` | `(history) => void \| Promise<void>` | ❌ No | `undefined` | Callback on max iterations |
| `onError` | `(error, context, iter) => void \| Promise<void>` | ❌ No | `undefined` | Callback on error |
| `onComplete` | `(result, history) => void \| Promise<void>` | ❌ No | `undefined` | Callback on completion |
| `enableHistory` | `boolean` | ❌ No | `true` | Track history |
| `historyStorage` | `ReflectionHistoryStorage` | ❌ No | In-memory | Storage for history |
| `sessionId` | `string` | ❌ No | Auto-generated | Session identifier |
| `costPerToken` | `number` | ❌ No | `undefined` | Cost per token (e.g., 0.00002 for $0.02/1K) |
| `includeHistoryInContext` | `boolean` | ❌ No | `false` | Include history in context |
| `maxHistoryInContext` | `number` | ❌ No | `3` | Max history items in context |
| `logger` | `Logger` | ❌ No | Default logger | Logger instance |

### ReflectionContext<TResponse>

Context provided to `execute` and `reflect` functions:

```typescript
interface ReflectionContext<TResponse> {
  iteration: number;                    // Current iteration (1-indexed)
  previousResponse?: TResponse;         // Previous attempt
  previousCritique?: ReflectionResult;  // Previous critique
  history: Array<{                      // Full history (if enabled)
    response: TResponse;
    critique: ReflectionResult;
  }>;
  metadata?: Record<string, unknown>;   // Custom metadata
}
```

### ReflectionResult

Return value from `reflect` function:

```typescript
interface ReflectionResult<TResponse> {
  score: number;           // Quality score (any range, typically 0-10)
  feedback: string;        // Detailed feedback for improvement
  shouldContinue: boolean; // Whether to continue iterating
  metadata?: Record<string, unknown>;
}
```

### ReflectionLoopResult<TResponse>

```typescript
interface ReflectionLoopResult<TResponse> {
  value: TResponse;              // Best or final response
  finalScore: number;            // Final quality score
  iterations: number;            // Iterations performed
  targetReached: boolean;        // Whether target was reached
  history: ReflectionHistory;    // Complete history
  timestamp: number;             // Completion timestamp
  metrics: {
    totalTime: number;           // Total time (ms)
    totalCost?: number;          // Total cost (if tracked)
    totalTokens?: number;        // Total tokens (if tracked)
    averageIterationTime: number; // Avg time per iteration
    scoreProgression: number[];  // Score across iterations
  }
}
```

---

## Use Cases

### 1. Content Generation with Quality Assurance

```typescript
const article = await reflectionLoop({
  execute: async (ctx) => {
    const prompt = ctx.iteration === 1
      ? 'Write a technical article about async/await in JavaScript'
      : `Previous article: ${ctx.previousResponse}

         Feedback: ${ctx.previousCritique?.feedback}

         Rewrite the article addressing these issues.`;

    return await generateText({ model, prompt });
  },

  reflect: async (article) => {
    const critique = await generateText({
      model,
      prompt: `Evaluate this article on:
               - Technical accuracy (1-10)
               - Clarity and structure (1-10)
               - Engagement and examples (1-10)
               - SEO and keywords (1-10)

               Article: ${article}

               Provide overall score and specific improvements.`
    });

    const parsed = parseCritique(critique);

    return {
      score: parsed.overallScore,
      feedback: parsed.improvements,
      shouldContinue: parsed.overallScore < 8
    };
  },

  maxIterations: 5,
  targetScore: 8
});
```

### 2. Code Generation with Self-Review

```typescript
const code = await reflectionLoop({
  execute: async (ctx) => {
    const prompt = ctx.iteration === 1
      ? 'Write a TypeScript function to merge sorted arrays'
      : `Previous code had these issues:
         ${ctx.previousCritique?.feedback}

         Previous code:
         ${ctx.previousResponse}

         Fix the issues and improve.`;

    return await generateCode({ model, prompt });
  },

  reflect: async (code) => {
    // AI reviews its own code
    const review = await generateText({
      model,
      prompt: `Review this code:
               ${code}

               Check for:
               - Correctness and edge cases
               - Time/space complexity
               - Code style and best practices
               - Test coverage

               Rate 1-10 and list specific issues.`
    });

    const score = extractScore(review);

    return {
      score,
      feedback: review,
      shouldContinue: score < 9
    };
  }
});
```

### 3. Business Plan Refinement

```typescript
const plan = await reflectionLoop({
  execute: async (ctx) => {
    const prompt = ctx.iteration === 1
      ? 'Create a business plan for a SaaS startup in the AI space'
      : `Previous plan: ${ctx.previousResponse}

         Analysis: ${ctx.previousCritique?.feedback}

         Revise the plan addressing these concerns.`;

    return await generateText({ model, prompt });
  },

  reflect: async (plan) => {
    const analysis = await generateText({
      model,
      prompt: `Analyze this business plan:
               ${plan}

               Evaluate:
               - Market analysis depth
               - Financial projections realism
               - Competitive advantage clarity
               - Risk assessment completeness
               - Overall viability

               Score 1-10 and suggest improvements.`
    });

    return {
      score: extractScore(analysis),
      feedback: analysis,
      shouldContinue: extractScore(analysis) < 7
    };
  },

  targetScore: 7
});
```

---

## Advanced Features

### Full Observability

```typescript
const result = await reflectionLoop({
  execute: async (ctx) => generateContent(ctx),
  reflect: async (content) => critiqueContent(content),

  // Lifecycle callbacks
  onStart: (config) => {
    console.log('Starting reflection loop...');
  },

  onIterationComplete: (iteration) => {
    console.log(`Iteration ${iteration.iteration}`);
    console.log(`  Score: ${iteration.critique.score}`);
    console.log(`  Time: ${iteration.metrics.totalTime}ms`);
    console.log(`  Cost: $${iteration.metrics.cost?.toFixed(4)}`);
  },

  onImprovement: (current, previous) => {
    const improvement = current.critique.score - previous.critique.score;
    console.log(`Score improved by ${improvement.toFixed(2)}!`);
  },

  onStagnation: (current, previous, iteration) => {
    console.warn(`Score stagnated at iteration ${iteration}`);
  },

  onTargetReached: (iteration, history) => {
    console.log(`Target reached in ${iteration.iteration} iterations!`);
    console.log(`Total cost: $${history.stats.totalCost?.toFixed(2)}`);
  },

  onComplete: (result, history) => {
    console.log('\nFinal Statistics:');
    console.log(`  Iterations: ${result.iterations}`);
    console.log(`  Final Score: ${result.finalScore}`);
    console.log(`  Improvement: ${history.stats.scoreImprovement}`);
    console.log(`  Total Cost: $${result.metrics.totalCost?.toFixed(2)}`);
  }
});
```

### Cost and Token Tracking

```typescript
const result = await reflectionLoop({
  execute: async (ctx) => {
    const response = await generateText({ model, prompt });

    // Return response with tokens (similar to costTracking pattern)
    return {
      text: response.text,
      tokens: response.usage.total_tokens  // User provides tokens
    };
  },

  reflect: async (output) => critiqueText(output.text),

  costPerToken: 0.00002  // $0.02 per 1K tokens - we calculate cost automatically
});

console.log(`Total tokens: ${result.metrics.totalTokens}`);
console.log(`Total cost: $${result.metrics.totalCost?.toFixed(2)}`);
console.log(`Cost per iteration: $${(result.metrics.totalCost! / result.iterations).toFixed(4)}`);
```

### History Persistence

```typescript
import { reflectionLoop, InMemoryReflectionStorage } from 'ai-patterns';

// Custom storage (database, file system, etc.)
class DatabaseStorage<TResponse> {
  async save(sessionId: string, iteration: ReflectionIteration<TResponse>) {
    await db.reflectionHistory.create({
      sessionId,
      iteration: iteration.iteration,
      data: JSON.stringify(iteration)
    });
  }

  async load(sessionId: string): Promise<ReflectionIteration<TResponse>[]> {
    const records = await db.reflectionHistory.findMany({
      where: { sessionId },
      orderBy: { iteration: 'asc' }
    });
    return records.map(r => JSON.parse(r.data));
  }

  async delete(sessionId: string) {
    await db.reflectionHistory.deleteMany({ where: { sessionId } });
  }
}

// Use with persistence
const result = await reflectionLoop({
  execute: async (ctx) => generateContent(ctx),
  reflect: async (content) => critiqueContent(content),

  enableHistory: true,
  historyStorage: new DatabaseStorage(),
  sessionId: `user-${userId}-${Date.now()}`
});

// Later, retrieve history
const storage = new DatabaseStorage();
const history = await storage.load(`user-${userId}-${timestamp}`);
console.log('Previous attempts:', history);
```

### History in Context

```typescript
const result = await reflectionLoop({
  execute: async (ctx) => {
    // Access full history in prompt
    const historyText = ctx.history.map((h, i) => `
      Attempt ${i + 1}:
      ${h.response}

      Critique (score ${h.critique.score}/10):
      ${h.critique.feedback}
    `).join('\n\n');

    const prompt = ctx.iteration === 1
      ? 'Write a story about AI'
      : `You've made ${ctx.iteration - 1} previous attempts.

         History of your attempts:
         ${historyText}

         Based on ALL this feedback, write an improved version.`;

    return await generateText({ model, prompt });
  },

  reflect: async (story) => critiqueStory(story),

  // Enable history in context
  includeHistoryInContext: true,
  maxHistoryInContext: 3 // Last 3 iterations
});
```

---

## Comparison with Response Validation

| Aspect | Reflection Loop | Response Validation |
|--------|----------------|---------------------|
| **Approach** | AI self-critique | External rules |
| **Feedback** | Qualitative (score + suggestions) | Binary (pass/fail) |
| **Improvement** | Guided by feedback | Blind retry |
| **Cost** | Higher (multiple LLM calls) | Lower (1 LLM call + validators) |
| **Use Case** | Subjective quality | Hard constraints |
| **Example** | Style, clarity, creativity | Price range, format, schema |

**They are complementary!** You can even combine them:

```typescript
const result = await reflectionLoop({
  execute: async (ctx) => generateProduct(ctx),

  reflect: async (product) => {
    // 1. External validation (hard constraints)
    const validation = await validateResponse({
      execute: () => product,
      validators: [
        { validate: (p) => p.price > 0, errorMessage: 'Invalid price' },
        { validate: (p) => p.name.length > 0, errorMessage: 'Missing name' }
      ]
  );

    if (!validation.validation.valid) {
      return {
        score: 0,
        feedback: validation.validation.failures.map(f => f.errorMessage).join(', '),
        shouldContinue: true
      };
    }

    // 2. AI critique (soft quality)
    const critique = await aiCritique(product);
    return critique;
  }
});
```

---

## Best Practices

### 1. Set Realistic Target Scores
```typescript
// ❌ Too high - may never reach
targetScore: 10

// ✅ Achievable goal
targetScore: 8
```

### 2. Limit Iterations to Control Cost
```typescript
// ✅ Reasonable limits
maxIterations: 5,
targetScore: 8,
onMaxIterationsReached: 'return-best'
```

### 3. Use Specific Feedback
```typescript
// ❌ Vague feedback
feedback: "This needs improvement"

// ✅ Specific, actionable feedback
feedback: `Issues:
  - Add more code examples in section 2
  - Clarify the explanation of async behavior
  - Fix typo in line 15: 'thier' -> 'their'`
```

### 4. Track Costs
```typescript
// ✅ Always track in production
costPerToken: 0.00002,  // $0.02 per 1K tokens

// Lifecycle callbacks
  onComplete: (result) => {
    if (result.metrics.totalCost! > 1.0) {
      alert(`High cost: $${result.metrics.totalCost}`);
    }
  }
}
```

### 5. Implement Early Stopping
```typescript
reflect: async (response) => {
  const score = evaluateQuality(response);

  // Stop early if "good enough"
  return {
    score,
    feedback: getFeedback(score),
    shouldContinue: score < 7 // Stop at 7, even if target is 8
  };
}
```

---

## TypeScript Tips

### Generic Type Inference

```typescript
// Types are automatically inferred
const result = await reflectionLoop({
  execute: async () => ({ text: "hello", score: 5 }),
  reflect: async (response) => ({
    score: response.score, // ✅ response is typed
    feedback: "Good",
    shouldContinue: false
  })
});

result.value.text; // ✅ Fully typed
```

### Custom Response Types

```typescript
interface BlogPost {
  title: string;
  content: string;
  tags: string[];
  seoScore: number;
}

const result = await reflectionLoop<BlogPost>({
  execute: async (ctx): Promise<BlogPost> => {
    // Implementation
  },
  reflect: async (post: BlogPost) => {
    // Critique
  }
});
```

---

## Error Handling

The pattern throws `PatternError` with specific error codes:

```typescript
try {
  const result = await reflectionLoop({
    execute: async (ctx) => generateContent(ctx),
    reflect: async (content) => critiqueContent(content),
    maxIterations: 5,
    targetScore: 10,
    onMaxIterationsReached: 'throw' // Throw on failure
  });
} catch (error) {
  if (error instanceof PatternError) {
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Details:`, error.details);

    if (error.code === ErrorCode.ALL_RETRIES_FAILED) {
      console.error(`Best score achieved: ${error.details.bestScore}`);
      console.error(`Target score: ${error.details.targetScore}`);
    }
  }

}
```

---

## Related Patterns

- **[Response Validation](./response-validation.md)** - Validate with external rules (complementary)
- **[Retry](./retry.md)** - Retry with exponential backoff
- **[Cost Tracking](./cost-tracking.md)** - Monitor AI spending
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Escalate to humans when needed

---

## License

MIT © [Serge KOKOUA](https://github.com/kokouaserge)
