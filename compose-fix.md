# Fixes nécessaires pour compose

## 1. Corriger l'exemple dans src/composition/compose.ts

**Actuellement (INCORRECT):**
```typescript
import { compose, retry, timeout, circuitBreaker } from 'ai-patterns';

const robustAPI = compose([
  timeout({ duration: 5000 }),
  retry({ maxAttempts: 3 }),
  circuitBreaker({ failureThreshold: 5 })
]);
```

**Devrait être (CORRECT):**
```typescript
import { compose, timeoutMiddleware, retryMiddleware, circuitBreakerMiddleware } from 'ai-patterns';

const robustAPI = compose([
  timeoutMiddleware({ duration: 5000 }),
  retryMiddleware({ maxAttempts: 3 }),
  circuitBreakerMiddleware({ failureThreshold: 5 })
]);
```

## 2. Mettre à jour la documentation docs/patterns/compose.md

Remplacer tous les usages:
- `retry()` → `retryMiddleware()`
- `timeout()` → `timeoutMiddleware()`
- `fallback()` → `fallbackMiddleware()`
- `circuitBreaker()` → `circuitBreakerMiddleware()`
- `rateLimiter()` → `rateLimiterMiddleware()`
- `cache()` → `cacheMiddleware()`

## 3. Pourquoi?

- `retry()`, `timeout()`, etc. sont les **patterns directs** qui retournent `Promise<RetryResult>`, `Promise<TimeoutResult>`, etc.
- `retryMiddleware()`, `timeoutMiddleware()`, etc. sont les **middleware adapters** qui retournent `Middleware<TInput, TOutput>`
- `compose()` accepte uniquement des `Middleware[]`, donc il faut utiliser les adapters

## 4. Alternative (si on veut la syntaxe simple)

Créer des overloads/wrappers qui détectent si `execute` est fourni:
- Si `execute` est fourni → exécuter le pattern directement
- Si `execute` n'est pas fourni → retourner un middleware

Mais cela compliquerait l'implémentation. Plus simple de juste utiliser les adapters.
