# Throttle Pattern

Limit execution frequency to at most once per interval. Perfect for scroll events, resize handlers, and rate-limited AI operations.

## Overview

Throttling ensures a function is called at most once during a specified time interval, regardless of how many times it's invoked.

### Key Features

- **Fixed interval** - Maximum once per X milliseconds
- **Leading/trailing edge** - Execute at start, end, or both
- **Immediate first call** - No delay on first invocation

### Use Cases

- **Scroll/Resize events** - Limit expensive reflows
- **Analytics tracking** - Throttle event sends
- **API polling** - Control request frequency
- **Real-time AI** - Limit AI calls during continuous input

---

## Basic Usage

```typescript
import { defineThrottle } from 'ai-patterns';

const trackEvent = defineThrottle({
  execute: async (event: string) => {
    return await analytics.track(event);
  },
  interval: 1000  // Max once per second
});

// User scrolls rapidly
trackEvent('scroll'); // Executes immediately
trackEvent('scroll'); // Throttled (ignored)
trackEvent('scroll'); // Throttled (ignored)
// ... 1000ms passes ...
trackEvent('scroll'); // Executes
```

---

## API Reference

### `defineThrottle<TArgs, TResult>(options): ThrottledFunction<TArgs, TResult>`

#### Options

```typescript
interface ThrottleOptions<TArgs, TResult> {
  execute: (...args: TArgs) => Promise<TResult> | TResult;
  interval?: number;       // Default: 1000ms
  leading?: boolean;       // Default: true
  trailing?: boolean;      // Default: false
  logger?: Logger;
  onThrottled?: () => void;
  onExecute?: (...args: TArgs) => void;
}
```

---

## Examples

### AI Image Analysis on Scroll

```typescript
import { defineThrottle } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';

const analyzeVisibleImages = defineThrottle({
  execute: async () => {
    const images = getVisibleImages();
    const analyses = await Promise.all(
      images.map(img => openai.vision.analyze(img))
    );
    return analyses;
  },
  interval: 2000,  // Analyze at most every 2s
  leading: true    // Analyze immediately on first scroll
});

window.addEventListener('scroll', () => {
  analyzeVisibleImages();
});
```

### Throttled AI Suggestions

```typescript
const getSuggestions = defineThrottle({
  execute: async (text: string) => {
    const { suggestions } = await ai.complete({ text });
    return suggestions;
  },
  interval: 500,
  trailing: true  // Get suggestions after typing slows
});
```

---

## Debounce vs Throttle

| Feature | Debounce | Throttle |
|---------|----------|----------|
| **When executes** | After silence period | At fixed intervals |
| **Use case** | Search, form input | Scroll, resize events |
| **Guarantees** | Executes after quiet | Executes at regular intervals |

---

## Best Practices

### ✅ Do

1. **Use for high-frequency events** - Scroll, mousemove, resize
2. **Set appropriate interval** - Balance responsiveness vs performance
3. **Choose leading/trailing** - Leading for immediate feedback

### ❌ Don't

1. **Don't throttle user inputs** - Use debounce instead
2. **Don't set interval too high** - Poor responsiveness
3. **Don't throttle critical actions** - Form submits, payments

---

**[← Back to Documentation](../../README.md#patterns)**
