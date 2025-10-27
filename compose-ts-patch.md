# Patch pour src/composition/compose.ts

## Fichier: src/composition/compose.ts

### Changement à faire (lignes 16-30)

**Remplacer:**
```typescript
 * @example
 * ```typescript
 * import { compose, retry, timeout, circuitBreaker } from 'ai-patterns';
 *
 * const robustAPI = compose([
 *   timeout({ duration: 5000 }),
 *   retry({ maxAttempts: 3 }),
 *   circuitBreaker({ failureThreshold: 5 })
 * ]);
 *
 * const result = await robustAPI(
 *   async () => fetch('/api/data'),
 *   undefined
 * );
 * ```
```

**Par:**
```typescript
 * @example
 * ```typescript
 * import { compose, timeoutMiddleware, retryMiddleware, circuitBreakerMiddleware } from 'ai-patterns';
 *
 * const robustAPI = compose([
 *   timeoutMiddleware({ duration: 5000 }),
 *   retryMiddleware({ maxAttempts: 3 }),
 *   circuitBreakerMiddleware({ failureThreshold: 5 })
 * ]);
 *
 * const result = await robustAPI(
 *   async () => fetch('/api/data'),
 *   undefined
 * );
 * ```
```

## Commande pour appliquer le patch

Vous devez éditer manuellement le fichier:
```bash
nano src/composition/compose.ts
```

Ou utiliser votre éditeur favori pour faire ce changement.

Cette correction fixera l'erreur TypeScript:
```
Type 'Promise<TimeoutResult<unknown>>' is not assignable to type 'Middleware<void, unknown>'.
```

## Explication

- `timeout()`, `retry()`, `circuitBreaker()` sont les **patterns directs** qui retournent `Promise<Result>`
- `timeoutMiddleware()`, `retryMiddleware()`, `circuitBreakerMiddleware()` sont les **middleware adapters** qui retournent `Middleware<TInput, TOutput>`
- `compose()` accepte **uniquement** des `Middleware[]`
