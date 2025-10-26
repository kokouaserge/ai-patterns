# Examples

This directory contains practical examples demonstrating how to use ai-patterns in different scenarios.

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install

# Build the package
npm run build
```

### Running Examples

```bash
# Run with ts-node
npx ts-node examples/basic/retry-simple.ts

# Or compile and run
npm run build
node dist/examples/basic/retry-simple.js
```

## Basic Examples

Simple, focused examples for each pattern:

### Resilience Patterns

- **[retry-simple.ts](./basic/retry-simple.ts)** - Basic retry with exponential backoff
- **[timeout-simple.ts](./basic/timeout-simple.ts)** - Time-limited operations
- **[circuit-breaker-simple.ts](./basic/circuit-breaker-simple.ts)** - Protect against cascading failures

### Rate Limiting

- **[rate-limiter-simple.ts](./basic/rate-limiter-simple.ts)** - Control request throughput

### Orchestration

- **[fan-out-simple.ts](./basic/fan-out-simple.ts)** - Parallel processing with concurrency
- **[saga-simple.ts](./basic/saga-simple.ts)** - Distributed transactions with compensation

### AI Patterns

- **[human-in-loop-simple.ts](./basic/human-in-loop-simple.ts)** - AI → Human escalation

### Consistency

- **[idempotency-simple.ts](./basic/idempotency-simple.ts)** - Prevent duplicate operations

## Real-World Examples

Coming soon:

- **e-commerce/** - Order processing workflow
- **ai-agent/** - Chatbot with human escalation
- **microservices/** - API gateway with resilience patterns

## Example Structure

Each example follows this structure:

```typescript
/**
 * [Pattern Name] Example
 *
 * Brief description of what this example demonstrates.
 */

import { pattern } from '../../src';

async function main() {
  // Example code with console.log for visualization
}

main().catch(console.error);
```

## Tips

1. **Start with basic examples** - Understand each pattern individually
2. **Try modifying parameters** - See how different configurations behave
3. **Check the documentation** - Each example links to detailed docs
4. **Combine patterns** - Try composing multiple patterns together

## Learn More

- [Documentation](../docs/)
- [API Reference](../docs/api-reference.md)
- [Best Practices](../docs/guides/best-practices.md)
- [Pattern Composition](../docs/guides/composition.md)

## Contributing

Found an issue or want to add an example? See [CONTRIBUTING.md](../CONTRIBUTING.md).

---

**[← Back to Main README](../README.md)**
