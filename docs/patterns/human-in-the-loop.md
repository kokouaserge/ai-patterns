# Human-in-the-Loop Pattern

Escalate AI decisions to humans when needed with built-in review workflows.

## Overview

The **Human-in-the-Loop** pattern enables seamless escalation from AI to human reviewers. Perfect for:

- Content moderation (AI → human moderator)
- Medical/legal AI decisions requiring human approval
- Low-confidence AI outputs
- Sensitive content detection
- Quality assurance for AI systems
- Compliance and regulatory requirements

### Key Features

- 🤖→👤 **Automatic Escalation** - Rule-based AI-to-human handoff
- 📋 **Escalation Rules** - Low confidence, keywords, errors, custom
- ⏱️ **Review Timeouts** - Configurable timeout with fallback
- 🎯 **Type-Safe** - Full TypeScript generics for input/output
- 📊 **Review Tracking** - Status, metadata, timestamps
- 🔔 **Callbacks** - Monitor escalations and reviews
- ⚡ **Flexible Fallback** - Use AI, throw, or retry on timeout

---

## API Reference

### Basic Usage

```typescript
import { humanInTheLoop, CommonEscalationRules } from 'ai-patterns';

const result = await humanInTheLoop({
  execute: async () => {
    return await aiModeration(content);
  },
  input: content,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.7)
  ],
  requestHumanReview: async (review) => {
    return await sendToModerator(review);
  }
});

console.log(result.value.decision); // AI or human decision
```

### With Type Safety

```typescript
interface ModerationInput {
  text: string;
  userId: string;
}

interface ModerationResult {
  decision: 'approved' | 'rejected';
  confidence: number;
  categories: string[];
}

const result = await humanInTheLoop<ModerationInput, ModerationResult>({
  execute: async () => {
    return await aiModeration(content.text);
  },
  input: content,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.7),
    CommonEscalationRules.sensitiveKeywords(['violence', 'illegal'])
  ],
  requestHumanReview: async (review) => {
    // Send to human moderator
    const humanDecision = await moderationQueue.add(review);
    return humanDecision;
  },
  onEscalate: (review) => {
    console.log(`Escalated: ${review.reason}`);
  }
});

console.log(result.value.decision);   // ✅ Fully typed
console.log(result.value.confidence); // ✅ Fully typed
```

### HumanInTheLoopOptions<TInput, TOutput>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `execute` | `() => Promise<TOutput>` | ✅ Yes | - | AI function to execute |
| `input` | `TInput` | ❌ No | `undefined` | Input for tracking/metadata |
| `escalationRules` | `EscalationRule[]` | ❌ No | `[]` | Rules to trigger escalation |
| `requestHumanReview` | `(review) => Promise<TOutput>` | ✅ Yes | - | Function to request human review |
| `reviewTimeout` | `number` | ❌ No | `300000` | Review timeout (5 min) |
| `timeoutFallback` | `TimeoutFallback` | ❌ No | `THROW` | Behavior on timeout |
| `onEscalate` | `(review) => void` | ❌ No | `undefined` | Callback on escalation |
| `onReviewComplete` | `(review) => void` | ❌ No | `undefined` | Callback after review |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for events |

### EscalationRule<TInput, TOutput>

```typescript
interface EscalationRule<TInput, TOutput> {
  name: string;
  shouldEscalate: (input: TInput, output?: TOutput, error?: Error) => boolean | Promise<boolean>;
  reason: EscalationReason;
  priority?: number;
}
```

### EscalationReason Enum

```typescript
enum EscalationReason {
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  TIMEOUT = 'TIMEOUT',
  ERROR = 'ERROR',
  SENSITIVE_CONTENT = 'SENSITIVE_CONTENT',
  KEYWORD_DETECTED = 'KEYWORD_DETECTED',
  MANUAL_REQUEST = 'MANUAL_REQUEST',
  CUSTOM = 'CUSTOM'
}
```

### ReviewStatus Enum

```typescript
enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MODIFIED = 'MODIFIED'
}
```

### TimeoutFallback Enum

```typescript
enum TimeoutFallback {
  USE_AI = 'USE_AI',      // Use AI output on timeout
  THROW = 'THROW',        // Throw error on timeout
  RETRY = 'RETRY'         // Retry escalation
}
```

### HumanReview<TInput, TOutput>

```typescript
interface HumanReview<TInput, TOutput> {
  id: string;
  input: TInput;
  aiOutput?: TOutput;
  reason: EscalationReason;
  metadata?: Record<string, any>;
  createdAt: number;
  status: ReviewStatus;
  humanOutput?: TOutput;
  notes?: string;
  resolvedAt?: number;
}
```

---

## Common Escalation Rules

### 1. Low Confidence

Escalate when AI confidence is below threshold:

```typescript
import { CommonEscalationRules } from 'ai-patterns';

const result = await humanInTheLoop({
  execute: () => aiClassify(text),
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.7) // Escalate if < 70% confident
  ],
  requestHumanReview: async (review) => {
    return await humanReview(review);
  }
});
```

### 2. Sensitive Keywords

Escalate when specific keywords are detected:

```typescript
const result = await humanInTheLoop({
  input: userMessage,
  execute: () => aiModeration(userMessage),
  escalationRules: [
    CommonEscalationRules.sensitiveKeywords(['violence', 'illegal', 'explicit'])
  ],
  requestHumanReview: async (review) => {
    return await moderator.review(review);
  }
});
```

### 3. On Error

Escalate when AI encounters an error:

```typescript
const result = await humanInTheLoop({
  execute: () => aiProcess(data),
  escalationRules: [
    CommonEscalationRules.onError()
  ],
  requestHumanReview: async (review) => {
    return await fallbackToHuman(review);
  }
});
```

### 4. Custom Rule

Create custom escalation logic:

```typescript
const result = await humanInTheLoop({
  execute: () => aiAnalyze(document),
  escalationRules: [
    CommonEscalationRules.custom(
      'complex-document',
      (input, output) => {
        // Escalate if document is too complex
        return output?.complexity > 0.8;
      },
      priority: 9
    )
  ],
  requestHumanReview: async (review) => {
    return await expertReview(review);
  }
});
```

---

## Examples

### Example 1: Content Moderation

```typescript
import { humanInTheLoop, CommonEscalationRules, EscalationReason } from 'ai-patterns';

interface ContentInput {
  text: string;
  userId: string;
  timestamp: number;
}

interface ModerationResult {
  decision: 'approved' | 'rejected' | 'flagged';
  confidence: number;
  violations: string[];
}

const result = await humanInTheLoop<ContentInput, ModerationResult>({
  execute: async () => {
    // AI moderation
    const aiResult = await openai.moderations.create({
      input: content.text
    });

    return {
      decision: aiResult.flagged ? 'flagged' : 'approved',
      confidence: aiResult.category_scores.max,
      violations: aiResult.categories.filter(c => c.flagged).map(c => c.name)
    };
  },
  input: content,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.8), // High confidence required
    CommonEscalationRules.sensitiveKeywords(['suicide', 'self-harm'])
  ],
  requestHumanReview: async (review) => {
    // Add to moderation queue
    const ticket = await moderationQueue.create({
      contentId: review.id,
      text: review.input.text,
      aiDecision: review.aiOutput,
      reason: review.reason
    });

    // Wait for human moderator
    return await moderationQueue.waitForReview(ticket.id);
  },
  onEscalate: (review) => {
    logger.warn('Content escalated to human moderator', {
      contentId: review.id,
      reason: review.reason,
      userId: review.input.userId
    });
    metrics.increment('moderation.escalated');
  },
  onReviewComplete: (review) => {
    logger.info('Moderation review complete', {
      contentId: review.id,
      decision: review.humanOutput?.decision,
      duration: review.resolvedAt - review.createdAt
    });
  }
});

console.log(result.value.decision);
```

### Example 2: Medical Diagnosis Support

```typescript
import { humanInTheLoop, CommonEscalationRules } from 'ai-patterns';

interface PatientData {
  symptoms: string[];
  history: string;
  age: number;
}

interface DiagnosisResult {
  diagnosis: string;
  confidence: number;
  recommendedTests: string[];
}

const result = await humanInTheLoop<PatientData, DiagnosisResult>({
  execute: async () => {
    return await aiDiagnosis(patientData);
  },
  input: patientData,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.85), // High bar for medical
    CommonEscalationRules.custom(
      'critical-symptoms',
      (input) => {
        // Escalate critical symptoms
        const critical = ['chest pain', 'stroke', 'seizure'];
        return input.symptoms.some(s => critical.includes(s.toLowerCase()));
      },
      priority: 10 // Highest priority
    )
  ],
  requestHumanReview: async (review) => {
    // Send to doctor for review
    const doctorReview = await medicalQueue.assignToDoctor(review);
    return doctorReview.diagnosis;
  },
  reviewTimeout: 1800000, // 30 minutes for doctor review
  timeoutFallback: TimeoutFallback.THROW, // Don't use AI on timeout
  onEscalate: (review) => {
    // Alert doctor
    notifications.sendUrgent(review.metadata.doctorId, {
      patientId: review.input.patientId,
      reason: review.reason
    });
  }
});
```

### Example 3: Financial Transaction Review

```typescript
import { humanInTheLoop, CommonEscalationRules, EscalationReason } from 'ai-patterns';

interface Transaction {
  id: string;
  amount: number;
  userId: string;
  type: string;
}

interface FraudCheckResult {
  isFraudulent: boolean;
  riskScore: number;
  reasons: string[];
}

const result = await humanInTheLoop<Transaction, FraudCheckResult>({
  execute: async () => {
    return await fraudDetection.analyze(transaction);
  },
  input: transaction,
  escalationRules: [
    CommonEscalationRules.custom(
      'high-amount',
      (txn) => txn.amount > 10000,
      priority: 8
    ),
    CommonEscalationRules.custom(
      'high-risk',
      (_, output) => output?.riskScore > 0.7,
      priority: 9
    ),
    {
      name: 'suspicious-pattern',
      shouldEscalate: async (txn) => {
        const history = await getUserHistory(txn.userId);
        return detectAnomalies(history, txn);
      },
      reason: EscalationReason.CUSTOM,
      priority: 7
    }
  ],
  requestHumanReview: async (review) => {
    // Assign to fraud analyst
    return await fraudAnalysts.review(review);
  },
  onEscalate: (review) => {
    // Temporarily hold transaction
    transactionService.hold(review.input.id);
    logger.warn('Transaction held for review', {
      txnId: review.input.id,
      amount: review.input.amount
    });
  }
});

if (result.value.isFraudulent) {
  transactionService.block(transaction.id);
} else {
  transactionService.approve(transaction.id);
}
```

### Example 4: AI-Generated Content Review

```typescript
import { humanInTheLoop, CommonEscalationRules } from 'ai-patterns';

interface ContentRequest {
  prompt: string;
  userId: string;
  category: string;
}

interface GeneratedContent {
  text: string;
  safety: {
    flagged: boolean;
    categories: string[];
  };
}

const result = await humanInTheLoop<ContentRequest, GeneratedContent>({
  execute: async () => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: request.prompt }]
    });

    const moderation = await openai.moderations.create({
      input: completion.choices[0].message.content
    });

    return {
      text: completion.choices[0].message.content,
      safety: {
        flagged: moderation.results[0].flagged,
        categories: moderation.results[0].categories.filter(c => c).map(c => c.category)
      }
    };
  },
  input: request,
  escalationRules: [
    CommonEscalationRules.custom(
      'flagged-content',
      (_, output) => output?.safety.flagged === true,
      priority: 10
    )
  ],
  requestHumanReview: async (review) => {
    // Human editor reviews
    return await contentEditors.review(review);
  },
  timeoutFallback: TimeoutFallback.THROW, // Don't publish unsafe content
  onEscalate: (review) => {
    logger.warn('Generated content flagged', {
      userId: review.input.userId,
      categories: review.aiOutput?.safety.categories
    });
  }
});

console.log(result.value.text);
```

### Example 5: Timeout Handling

```typescript
import { humanInTheLoop, CommonEscalationRules, TimeoutFallback } from 'ai-patterns';

// Fallback to AI output if human doesn't respond in time
const result = await humanInTheLoop({
  execute: () => aiDecision(input),
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.7)
  ],
  requestHumanReview: async (review) => {
    return await slowHumanReview(review);
  },
  reviewTimeout: 60000, // 1 minute
  timeoutFallback: TimeoutFallback.USE_AI, // Use AI if timeout
  onEscalate: (review) => {
    console.log('Waiting for human review...');
  }
});

// If timeout: result.value = AI output
// If reviewed: result.value = human output
```

---

## Best Practices

### ✅ Do's

1. **Set Appropriate Confidence Thresholds**
   ```typescript
   // Good: Based on use case criticality
   escalationRules: [
     CommonEscalationRules.lowConfidence(0.95) // Medical: very high
     // vs
     CommonEscalationRules.lowConfidence(0.70) // Content: moderate
   ]
   ```

2. **Handle Timeouts Gracefully**
   ```typescript
   const result = await humanInTheLoop({
     execute: () => aiTask(),
     requestHumanReview: async (review) => { ... },
     reviewTimeout: 300000, // 5 minutes
     timeoutFallback: TimeoutFallback.USE_AI, // Graceful degradation
   });
   ```

3. **Track Escalation Metrics**
   ```typescript
   onEscalate: (review) => {
     metrics.increment('escalation', {
       reason: review.reason,
       priority: review.metadata.priority
     });
   }
   ```

4. **Provide Context to Reviewers**
   ```typescript
   const result = await humanInTheLoop({
     input: { text, userId, timestamp },
     execute: () => aiProcess(),
     requestHumanReview: async (review) => {
       // ✅ Rich context for reviewer
       return await reviewQueue.add({
         ...review,
         userHistory: await fetchHistory(review.input.userId)
       });
     }
   });
   ```

### ❌ Don'ts

1. **Don't Use Low Confidence Thresholds for Critical Tasks**
   ```typescript
   // Bad: Too low for medical/financial
   escalationRules: [
     CommonEscalationRules.lowConfidence(0.5) // ❌ 50% is too low!
   ]

   // Good: High threshold for critical
   escalationRules: [
     CommonEscalationRules.lowConfidence(0.90) // ✅ 90% for important decisions
   ]
   ```

2. **Don't Ignore Timeout Behavior**
   ```typescript
   // Bad: No timeout handling
   const result = await humanInTheLoop({
     execute: () => ai(),
     requestHumanReview: async (review) => { ... }
     // ❌ Default THROW might break user flow
   });

   // Good: Define timeout behavior
   timeoutFallback: TimeoutFallback.USE_AI // ✅ Graceful fallback
   ```

3. **Don't Escalate Everything**
   ```typescript
   // Bad: Too many escalations
   escalationRules: [
     CommonEscalationRules.lowConfidence(0.95), // Very strict
     CommonEscalationRules.sensitiveKeywords([...100keywords]),
     CommonEscalationRules.custom(...), // Many rules
   ]
   // ❌ Overwhelms human reviewers

   // Good: Balanced escalation
   escalationRules: [
     CommonEscalationRules.lowConfidence(0.80), // Reasonable
     CommonEscalationRules.sensitiveKeywords(['critical', 'words'])
   ]
   ```

---

## Production Configuration

### Content Moderation Platform

```typescript
const result = await humanInTheLoop({
  execute: () => aiModeration(content),
  input: content,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.75),
    CommonEscalationRules.sensitiveKeywords(BANNED_WORDS)
  ],
  requestHumanReview: async (review) => {
    return await moderationQueue.add(review);
  },
  reviewTimeout: 300000, // 5 min SLA
  timeoutFallback: TimeoutFallback.THROW,
  logger: productionLogger,
  onEscalate: (review) => {
    metrics.increment('moderation.escalated');
    if (review.reason === EscalationReason.SENSITIVE_CONTENT) {
      alerts.sendUrgent('Sensitive content detected');
    }
  }
});
```

### Medical AI System

```typescript
const result = await humanInTheLoop({
  execute: () => aiDiagnosis(patient),
  input: patient,
  escalationRules: [
    CommonEscalationRules.lowConfidence(0.90), // High bar
    criticalSymptomsRule,
    rareDiseaseRule
  ],
  requestHumanReview: async (review) => {
    return await doctorQueue.assign(review);
  },
  reviewTimeout: 1800000, // 30 min
  timeoutFallback: TimeoutFallback.THROW, // Never use AI on timeout
  logger: medicalLogger
});
```

---

## Pattern Composition

### Human-in-the-Loop + Retry

```typescript
import { humanInTheLoop, retry, BackoffStrategy } from 'ai-patterns';

const result = await humanInTheLoop({
  execute: async () => {
    return await retry({
      execute: () => unstableAI(),
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    });
  },
  escalationRules: [
    CommonEscalationRules.onError() // Escalate if retry fails
  ],
  requestHumanReview: async (review) => {
    return await humanFallback(review);
  }
});
```

### Human-in-the-Loop + Timeout

```typescript
import { humanInTheLoop, timeout, TimeoutDurations } from 'ai-patterns';

const result = await humanInTheLoop({
  execute: async () => {
    return await timeout({
      execute: () => slowAI(),
      timeoutMs: TimeoutDurations.LONG
    });
  },
  escalationRules: [
    CommonEscalationRules.custom(
      'timeout',
      (_, __, error) => error?.code === 'TIMEOUT_EXCEEDED',
      priority: 8
    )
  ],
  requestHumanReview: async (review) => {
    return await humanReview(review);
  }
});
```

---

## Related Patterns

- **[Circuit Breaker](./circuit-breaker.md)** - Fail fast when AI is consistently escalating
- **[Retry](./retry.md)** - Retry AI before escalating to human
- **[Timeout](./timeout.md)** - Time limits for both AI and human review

---

## Additional Resources

- [Human-in-the-Loop AI](https://en.wikipedia.org/wiki/Human-in-the-loop)
- [AI Safety and Human Oversight](https://www.anthropic.com/index/human-feedback)
- [Best Practices Guide](../guides/best-practices.md)
