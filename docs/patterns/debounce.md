# Debounce Pattern

Execute function after a period of silence. Perfect for search autocomplete, form inputs, and AI-powered features that respond to user input.

## Overview

Debouncing delays function execution until after a specified wait time has passed since the last invocation. Essential for optimizing expensive operations triggered by frequent events.

### Key Features

- **Silence period** - Wait for user to stop typing/clicking
- **Max wait** - Force execution after maximum time
- **Leading/trailing edge** - Execute at start or end of silence
- **Cancelable** - Cancel pending execution

### Use Cases

- **AI Autocomplete** - Search suggestions as user types
- **Form validation** - Validate after user stops typing
- **Auto-save** - Save document after editing pauses
- **API calls** - Reduce unnecessary requests

---

## Basic Usage

```typescript
import { defineDebounce } from 'ai-patterns';

const saveData = defineDebounce({
  execute: async (text: string) => {
    return await api.save(text);
  },
  wait: 500,      // Wait 500ms after last call
  maxWait: 2000   // Force execution after 2s max
});

// User types "Hello"
await saveData('H');     // Pending...
await saveData('He');    // Pending...
await saveData('Hel');   // Pending...
await saveData('Hell');  // Pending...
await saveData('Hello'); // Executes after 500ms silence
```

---

## API Reference

### `defineDebounce<TArgs, TResult>(options): DebouncedFunction<TArgs, TResult>`

#### Options

```typescript
interface DebounceOptions<TArgs, TResult> {
  execute: (...args: TArgs) => Promise<TResult> | TResult;
  wait?: number;           // Default: 300ms
  maxWait?: number;        // Default: undefined
  leading?: boolean;       // Default: false
  logger?: Logger;
  onDebounced?: () => void;
  onExecute?: (...args: TArgs) => void;
}
```

#### Debounced Function

```typescript
interface DebouncedFunction<TArgs, TResult> {
  (...args: TArgs): Promise<TResult>;
  cancel(): void;                      // Cancel pending execution
  flush(): Promise<TResult | undefined>; // Execute immediately
  pending(): boolean;                  // Check if pending
}
```

---

## Examples

### AI-Powered Search Autocomplete

```typescript
import { defineDebounce } from 'ai-patterns';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const aiAutocomplete = defineDebounce({
  execute: async (query: string) => {
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: `Suggest completions for: "${query}"`
    });

    return text.split('\n').filter(Boolean);
  },
  wait: 300,
  maxWait: 1000,

  onDebounced: () => {
    console.log('Waiting for user to finish typing...');
  }
});

// User types "machine learn"
await aiAutocomplete('m');
await aiAutocomplete('ma');
await aiAutocomplete('mac');
// ... 300ms silence ...
// AI generates suggestions: ["machine learning", "machine vision", ...]
```

### Auto-Save Editor

```typescript
const autoSave = defineDebounce({
  execute: async (content: string) => {
    await db.documents.update({ content });
    return { saved: true, timestamp: Date.now() };
  },
  wait: 2000,     // Save 2s after typing stops
  maxWait: 10000  // Force save every 10s
});

editor.onChange((content) => {
  autoSave(content);
});

// Cancel auto-save on close
window.onbeforeunload = () => {
  autoSave.cancel();
};
```

---

## Best Practices

### ✅ Do

1. **Choose appropriate wait time** - 300-500ms for search, 1-2s for save
2. **Use maxWait** - Prevent indefinite delays
3. **Provide feedback** - Show "Saving..." indicator
4. **Cancel on unmount** - Prevent memory leaks in React/Vue

### ❌ Don't

1. **Don't debounce critical actions** - Payment buttons, etc.
2. **Don't set wait too high** - Poor UX if >2s
3. **Don't forget error handling** - Debounced calls can still fail

---

## Related Patterns

- **[Throttle](./throttle.md)** - Limit frequency instead of delaying
- **[Rate Limiter](./rate-limiter.md)** - Control request throughput

---

**[← Back to Documentation](../../README.md#patterns)**
