# Response Validation Pattern

Automatically validate AI responses against business rules, schemas, or quality criteria with automatic retry on validation failure.

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

The Response Validation pattern ensures AI-generated content meets your quality standards, business rules, and structural requirements before being used in production.

### Key Features

- **Automatic validation** - Validate responses against multiple criteria
- **Auto-retry** - Retry generation on validation failure
- **Priority-based** - Execute validators in priority order
- **Async validators** - Support for async validation (API calls, moderation)
- **Parallel or sequential** - Run validators concurrently or sequentially
- **Fallback support** - Provide fallback responses when all retries fail
- **Type-safe** - Full TypeScript support with generics

### Use Cases

- **Content moderation** - Check for inappropriate content
- **Business rules** - Enforce business logic constraints
- **Schema validation** - Ensure response structure
- **Quality assurance** - Check length, format, completeness
- **Price validation** - Validate pricing logic
- **Regulatory compliance** - Meet legal requirements

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

### Simple Validation

```typescript
import { validateResponse } from 'ai-patterns';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await validateResponse({
  execute: async () => {
    const { object } = await generateObject({
      model: openai('gpt-4-turbo'),
      schema: z.object({
        name: z.string(),
        description: z.string(),
        price: z.number()
      }),
      prompt: 'Generate a product description'
    });
    return object;
  },
  validators: [
    {
      name: 'price-range',
      validate: (response) => response.price > 0 && response.price < 10000,
      errorMessage: 'Price must be between $0 and $10,000'
    },
    {
      name: 'description-length',
      validate: (response) => response.description.length >= 50,
      errorMessage: 'Description must be at least 50 characters'
    }
  ],
  maxRetries: 3
});

console.log(result.value); // Validated product
console.log(result.validation.valid); // true
```

### With Retry and Fallback

```typescript
const result = await validateResponse({
  execute: async () => {
    return await generateProduct();
  },
  validators: [
    {
      name: 'required-fields',
      validate: (product) => {
        return product.name && product.description && product.price;
      },
      errorMessage: 'All fields are required'
    }
  ],
  maxRetries: 3,
  retryDelayMs: 1000,
  onValidationFailed: (validator, attempt) => {
    console.log(`❌ ${validator.name} failed on attempt ${attempt}`);
  },
  onAllRetriesFailed: async (failures) => {
    // Return safe default
    return {
      name: 'Product',
      description: 'Contact us for details',
      price: 0
    };
  }
});
```

---

## API Reference

### `validateResponse<TResponse>(config)`

Validate a response with automatic retry on failure.

#### Parameters

```typescript
interface ValidateResponseConfig<TResponse> {
  // Function that generates response to validate
  execute: () => Promise<TResponse> | TResponse;

  // List of validators
  validators: ResponseValidator<TResponse>[];

  // Maximum retries on validation failure
  maxRetries?: number; // Default: 0

  // Delay between retries (ms)
  retryDelayMs?: number; // Default: 0

  // Run validators in parallel
  parallel?: boolean; // Default: false

  // Callbacks
  onValidationFailed?: (validator: ResponseValidator<TResponse>, attempt: number, response: TResponse) => void | Promise<void>;
  onValidatorPassed?: (validator: ResponseValidator<TResponse>, response: TResponse) => void | Promise<void>;
  onValidationSuccess?: (response: TResponse, result: ValidationResult<TResponse>) => void | Promise<void>;
  onAllRetriesFailed?: (failures: ValidationFailure[]) => TResponse | Promise<TResponse>;

  // Logger instance
  logger?: Logger;
}

interface ResponseValidator<TResponse> {
  // Validator name
  name: string;

  // Validation function
  validate: (response: TResponse) => boolean | Promise<boolean>;

  // Error message
  errorMessage: string;

  // Priority (higher = runs first)
  priority?: number;

  // Stop validation chain on failure
  stopOnFailure?: boolean;
}
```

#### Returns

```typescript
interface ValidateResponseResult<TResponse> {
  value: TResponse;                    // Validated response
  validation: ValidationResult<TResponse>; // Validation details
  attempts: number;                    // Number of attempts
  isFallback: boolean;                 // Whether from fallback
  timestamp: number;                   // Completion timestamp
}

interface ValidationResult<TResponse> {
  valid: boolean;                      // Validation passed
  response?: TResponse;                // Validated response
  failures: ValidationFailure[];       // Failed validations
  passedCount: number;                 // Validators passed
  totalCount: number;                  // Total validators
}
```

---

## Advanced Features

### Async Validators (Content Moderation)

```typescript
async function moderateContent(text: string): Promise<boolean> {
  const result = await openai.moderations.create({ input: text });
  return !result.results[0].flagged;
}

const result = await validateResponse({
  execute: async () => {
    return await generateText({ model, prompt });
  },
  validators: [
    {
      name: 'content-moderation',
      priority: 10, // Check first
      validate: async (response) => {
        const isSafe = await moderateContent(response.text);
        return isSafe;
      },
      errorMessage: 'Content contains inappropriate material',
      stopOnFailure: true // Stop if flagged
    },
    {
      name: 'length-check',
      priority: 5,
      validate: (response) => response.text.length >= 100,
      errorMessage: 'Content too short'
    }
  ],
  maxRetries: 3
});
```

### Priority-Based Validation

```typescript
const result = await validateResponse({
  execute: generateContent,
  validators: [
    {
      name: 'critical-check',
      priority: 100, // Runs first
      validate: (r) => r.status === 'valid',
      errorMessage: 'Critical validation failed',
      stopOnFailure: true // Stop chain if fails
    },
    {
      name: 'high-priority',
      priority: 75,
      validate: (r) => r.score > 0.8,
      errorMessage: 'High priority check failed'
    },
    {
      name: 'low-priority',
      priority: 25, // Runs last
      validate: (r) => r.metadata.complete,
      errorMessage: 'Low priority check failed'
    }
  ]
});
```

### Business Rules Validation

```typescript
interface ProductResponse {
  name: string;
  price: number;
  category: string;
  discount?: number;
}

const result = await validateResponse({
  execute: async () => generateProduct(),
  validators: [
    {
      name: 'pricing-logic',
      validate: (product) => {
        // Free products must have price = 0
        if (product.name.toLowerCase().includes('free')) {
          return product.price === 0;
        }
        return true;
      },
      errorMessage: 'Products labeled "free" must have price $0'
    },
    {
      name: 'discount-validation',
      validate: (product) => {
        if (product.discount) {
          // Discount can't exceed price
          return product.discount <= product.price;
        }
        return true;
      },
      errorMessage: 'Discount cannot exceed product price'
    },
    {
      name: 'category-consistency',
      validate: (product) => {
        const validCategories = ['Electronics', 'Clothing', 'Books'];
        return validCategories.includes(product.category);
      },
      errorMessage: 'Invalid product category'
    }
  ],
  maxRetries: 3,
  retryDelayMs: 500
});
```

### Parallel Validation for Performance

```typescript
const result = await validateResponse({
  execute: generateContent,
  validators: [
    {
      name: 'length',
      validate: async (content) => {
        await delay(100); // Simulate async check
        return content.length >= 50;
      },
      errorMessage: 'Too short'
    },
    {
      name: 'keyword',
      validate: async (content) => {
        await delay(100); // Simulate async check
        return content.includes('important');
      },
      errorMessage: 'Missing keywords'
    },
    {
      name: 'format',
      validate: async (content) => {
        await delay(100); // Simulate async check
        return /^[A-Z]/.test(content);
      },
      errorMessage: 'Wrong format'
    }
  ],
  parallel: true, // Run all validators concurrently
  maxRetries: 2
});
```

---

## Examples

### Complete E-commerce Example

```typescript
import { validateResponse } from 'ai-patterns';

interface ProductDescription {
  title: string;
  description: string;
  price: number;
  features: string[];
}

async function generateProductDescription(productData: any) {
  return await validateResponse({
    execute: async () => {
      const { object } = await generateObject({
        model: openai('gpt-4-turbo'),
        schema: productSchema,
        prompt: `Generate product description for: ${productData.name}`
      });
      return object;
    },
    validators: [
      // Critical validations (run first)
      {
        name: 'required-fields',
        priority: 100,
        validate: (p) => !!(p.title && p.description && p.price),
        errorMessage: 'Missing required fields',
        stopOnFailure: true
      },
      {
        name: 'content-moderation',
        priority: 90,
        validate: async (p) => {
          const titleSafe = await moderateContent(p.title);
          const descSafe = await moderateContent(p.description);
          return titleSafe && descSafe;
        },
        errorMessage: 'Content flagged by moderation',
        stopOnFailure: true
      },

      // Business rules
      {
        name: 'price-validation',
        priority: 80,
        validate: (p) => p.price > 0 && p.price < 100000,
        errorMessage: 'Price must be between $0 and $100,000'
      },
      {
        name: 'title-length',
        priority: 70,
        validate: (p) => p.title.length >= 10 && p.title.length <= 100,
        errorMessage: 'Title must be 10-100 characters'
      },
      {
        name: 'description-length',
        priority: 60,
        validate: (p) => p.description.length >= 100 && p.description.length <= 1000,
        errorMessage: 'Description must be 100-1000 characters'
      },
      {
        name: 'features-count',
        priority: 50,
        validate: (p) => p.features && p.features.length >= 3 && p.features.length <= 10,
        errorMessage: 'Must have 3-10 features'
      },

      // Quality checks
      {
        name: 'no-placeholder-text',
        priority: 40,
        validate: (p) => {
          const text = (p.title + p.description).toLowerCase();
          return !text.includes('lorem ipsum') && !text.includes('todo');
        },
        errorMessage: 'Contains placeholder text'
      }
    ],
    parallel: false, // Sequential for stopOnFailure support
    maxRetries: 3,
    retryDelayMs: 1000,

    onValidationFailed: (validator, attempt, response) => {
      logger.warn(`Validation failed: ${validator.name}`, {
        attempt,
        errorMessage: validator.errorMessage
      });
    },

    onValidationSuccess: (response, result) => {
      logger.info('Validation successful', {
        passedCount: result.passedCount,
        totalCount: result.totalCount
      });
    },

    onAllRetriesFailed: async (failures) => {
      // Return safe fallback
      logger.error('All validation attempts failed', { failures });

      return {
        title: 'Product Information',
        description: 'Please contact us for detailed product information.',
        price: 0,
        features: ['Information available upon request']
      };
    }
  });
}
```

---

## Error Handling

### Handling Validation Errors

```typescript
try {
  const result = await validateResponse({
    execute: generateContent,
    validators,
    maxRetries: 3
  });

  if (result.isFallback) {
    console.warn('Using fallback response due to validation failures');
  }
} catch (error) {
  if (error instanceof PatternError) {
    console.error('Validation pattern error:', error.message);
    console.error('Failed validators:', error.context.failedValidators);
  }
}
```

---

## Best Practices

### 1. Use Priority Levels

```typescript
validators: [
  { name: 'critical', priority: 100, stopOnFailure: true },
  { name: 'important', priority: 75 },
  { name: 'nice-to-have', priority: 25 }
]
```

### 2. Implement Content Moderation

```typescript
{
  name: 'moderation',
  priority: 90,
  validate: async (response) => {
    return await moderationAPI.check(response.content);
  },
  stopOnFailure: true
}
```

### 3. Provide Meaningful Error Messages

```typescript
{
  name: 'price-range',
  validate: (r) => r.price > 0 && r.price < 10000,
  errorMessage: 'Price must be between $0 and $10,000 for this product category'
}
```

### 4. Use Fallbacks in Production

```typescript
onAllRetriesFailed: async (failures) => {
  // Log for monitoring
  await logger.error('Validation failed', { failures });

  // Return safe default
  return getSafeDefaultResponse();
}
```

### 5. Monitor Validation Failures

```typescript
onValidationFailed: (validator, attempt, response) => {
  analytics.track('validation_failed', {
    validator: validator.name,
    attempt,
    timestamp: Date.now()
  });
}
```

---

## Related Patterns

- **[Retry](./retry.md)** - Retry execution on failure
- **[Prompt Versioning](./prompt-versioning.md)** - Version prompts for better results
- **[Human-in-the-Loop](./human-in-the-loop.md)** - Escalate validation failures to humans
- **[Cost Tracking](./cost-tracking.md)** - Track costs of retries

---

## See Also

- [Basic Example](../../examples/basic/response-validation-simple.ts)
- [Advanced Example](../../examples/composition/response-validation-with-retry.ts)
- [API Documentation](../../README.md)
