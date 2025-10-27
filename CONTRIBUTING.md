# Contributing to ai-patterns

Thank you for your interest in contributing to **ai-patterns**! 🎉

We welcome contributions of all kinds: bug reports, feature requests, documentation improvements, and code contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

**Our Standards:**
- Be welcoming and inclusive
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

## Getting Started

### Prerequisites

- **Node.js**: >=16.0.0
- **npm**, **yarn**, or **pnpm**
- **TypeScript**: 5.3+ (installed as dev dependency)
- **Git**: For version control

### Forking the Repository

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-patterns.git
   cd ai-patterns
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/kokouaserge/ai-patterns.git
   ```

## Development Setup

### Installation

```bash
# Install dependencies
npm install

# Run tests to verify setup
npm test

# Build the project
npm run build
```

### Available Scripts

```bash
npm run build         # Compile TypeScript to dist/
npm run dev           # Watch mode for development
npm run clean         # Remove dist/ folder
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues automatically
```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout development
git merge upstream/development

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write code following our [coding guidelines](#coding-guidelines)
- Add tests for new features
- Update documentation if needed
- Run tests locally: `npm test`

### 3. Commit Your Changes

Follow our [commit guidelines](#commit-guidelines):

```bash
git add .
git commit -m "feat: add new retry strategy"
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Coding Guidelines

### TypeScript Best Practices

✅ **DO:**
- Use strict TypeScript mode
- Leverage generics for type safety
- Export types alongside implementations
- Use `async/await` over raw promises
- Document complex logic with comments

❌ **DON'T:**
- Use `any` type (use `unknown` if needed)
- Leave unused imports or variables
- Skip error handling
- Write functions longer than 50 lines

### Code Style

We use **ESLint** and **TypeScript** for code quality:

```typescript
// ✅ Good
export async function retry<TResult>(
  options: RetryOptions<TResult>
): Promise<RetryResult<TResult>> {
  const { execute, maxAttempts = 3 } = options;
  // Implementation...
}

// ❌ Bad
export async function retry(options: any): Promise<any> {
  let attempts = options.maxAttempts || 3; // Use destructuring
  // Implementation...
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `circuit-breaker.ts`)
- **Functions**: `camelCase` (e.g., `retry`, `defineCircuitBreaker`)
- **Interfaces/Types**: `PascalCase` (e.g., `RetryOptions`, `CircuitBreakerState`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_ATTEMPTS`, `DEFAULT_TIMEOUT`)

### Pattern Structure

Each pattern should follow this structure:

```
src/
  category/              # e.g., resilience/, orchestration/
    pattern-name.ts      # Implementation
    pattern-name.test.ts # Tests
  types/
    pattern-name.ts      # Type definitions
```

## Testing Guidelines

### Writing Tests

- Use **Vitest** for testing
- Aim for **>90% code coverage**
- Test happy paths AND edge cases
- Use descriptive test names

**Test Structure:**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from './retry';

describe('retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should retry failed operations', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('Success');

      const result = await retry({
        execute: fn,
        maxAttempts: 2
      });

      expect(result.value).toBe('Success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      await expect(
        retry({ execute: fn, maxAttempts: 3 })
      ).rejects.toThrow('Fail');

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- circuit-breaker.test.ts
```

## Commit Guidelines

We follow **Conventional Commits** specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples

```bash
# Feature
git commit -m "feat(retry): add exponential backoff strategy"

# Bug fix
git commit -m "fix(circuit-breaker): correct state transition logic"

# Documentation
git commit -m "docs: update README with new examples"

# Breaking change
git commit -m "feat(rate-limiter)!: change API to return result object

BREAKING CHANGE: rate limiter now returns { allowed, value } instead of throwing"
```

## Pull Request Process

### Before Submitting

✅ **Checklist:**
- [ ] Tests pass locally (`npm test`)
- [ ] Code builds without errors (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] New tests added for new features
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventions
- [ ] Branch is up-to-date with `development`

### PR Title Format

Follow conventional commits format:

```
feat(circuit-breaker): add half-open state support
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested this

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Follows coding guidelines
```

### Review Process

1. **Automated Checks**: CI must pass (tests, build, lint)
2. **Code Review**: At least one maintainer approval required
3. **Discussion**: Address review comments
4. **Merge**: Squash and merge to `development`

## Project Structure

```
ai-patterns/
├── src/
│   ├── resilience/          # Retry, Circuit Breaker, Timeout, Fallback, Bulkhead
│   ├── rate-limiting/       # Rate Limiter
│   ├── orchestration/       # Fan-Out, Saga, Conditional Branch
│   ├── ai/                  # Human-in-the-Loop
│   ├── consistency/         # Idempotency
│   ├── timing/              # Debounce, Throttle
│   ├── caching/             # Memoize
│   ├── queuing/             # Dead Letter Queue
│   ├── composition/         # Compose, Middleware
│   ├── types/               # Type definitions
│   └── index.ts             # Main export
├── docs/                    # Documentation
├── examples/                # Example code
├── dist/                    # Compiled output (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Questions?

- **Issues**: [GitHub Issues](https://github.com/kokouaserge/ai-patterns/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kokouaserge/ai-patterns/discussions)
- **Email**: [Add your email if you want]

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to ai-patterns!** 🚀

Every contribution, no matter how small, makes a difference. We appreciate your time and effort in making this project better.
