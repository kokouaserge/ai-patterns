# Rate Limiter Fix - Global Rate Limiting

## Le Problème

Lorsque vous utilisiez `withRateLimiter` dans un pipeline composé avec différentes fonctions, vous obteniez parfois les résultats de requêtes précédentes au lieu des résultats de la requête actuelle.

### Exemple du bug :

```typescript
const robustApi = compose([withRateLimiter({ maxRequests: 5 })]);

// Appel 1
const users = await robustApi(() => fetchUsers(), undefined);
// Retourne correctement les users

// Appel 2
const products = await robustApi(() => fetchProducts(), undefined);
// PROBLÈME: Retournait parfois les users au lieu des products!
```

## La Cause

Le middleware `rateLimiterMiddleware` créait une instance de `RateLimiter` qui wrappait la fonction `next` lors de la première initialisation. Cette fonction wrappée était réutilisée pour tous les appels suivants, ce qui pouvait causer des problèmes de state partagé ou de caching.

## La Solution

Le middleware a été modifié pour :

1. **Créer un rate limiter global au niveau du middleware** plutôt qu'au niveau de chaque fonction
2. **Acquérir un token/slot** avant chaque exécution
3. **Exécuter la fonction actuelle** (pas une référence wrappée statique)

### Code modifié :

```typescript
export function rateLimiterMiddleware<TInput = any, TOutput = any>(
  options: Omit<RateLimiterOptions<TOutput>, "execute">
): Middleware<TInput, TOutput> {
  // Créer une instance globale
  const limiter = new RateLimiter(
    async () => { throw new Error("This should never be called directly"); },
    options
  );

  const internalLimiter = limiter.getLimiter();

  return (next) => {
    return async (input) => {
      // Acquérir un slot AVANT d'exécuter
      const { allowed, retryAfter, remaining } = await internalLimiter.acquire();

      if (!allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
      }

      // Exécuter la fonction ACTUELLE avec l'input ACTUEL
      return await next(input);
    };
  };
}
```

## Comportement Actuel (Correct)

Le `withRateLimiter` maintenant fonctionne comme un **rate limiter GLOBAL** :

- Compte TOUTES les requêtes ensemble
- Fonctionne indépendamment de quelle fonction est exécutée
- Parfait pour enforcer des limites d'API globales

### Exemple d'utilisation correcte :

```typescript
const robustApi = compose([
  withRateLimiter({
    maxRequests: 5,
    windowMs: 10000,
    strategy: RateLimitStrategy.SLIDING_WINDOW
  })
]);

// Tous ces appels partagent le même compteur de rate limit
await robustApi(() => fetchUsers(), undefined);    // Compte: 1/5 ✅
await robustApi(() => fetchProducts(), undefined); // Compte: 2/5 ✅
await robustApi(() => fetchOrders(), undefined);   // Compte: 3/5 ✅
await robustApi(() => fetchPayments(), undefined); // Compte: 4/5 ✅
await robustApi(() => fetchInvoices(), undefined); // Compte: 5/5 ✅
await robustApi(() => fetchReports(), undefined);  // ❌ Rate limit exceeded!
```

## Tests

Trois nouveaux tests ont été ajoutés pour valider le fix :

### Test 1 : Résultats corrects pour différentes fonctions
```typescript
// Vérifie que chaque fonction retourne SON propre résultat
const result1 = await robustApi(async () => ({ type: 'user', id: 123 }));
const result2 = await robustApi(async () => ({ type: 'product', id: 456 }));

expect(result1.type).toBe('user');    // ✅ Pas 'product'
expect(result2.type).toBe('product'); // ✅ Pas 'user'
```

### Test 2 : Rate limiting fonctionne toujours
```typescript
// Vérifie que les limites sont bien appliquées
for (let i = 1; i <= 5; i++) {
  await robustApi(async () => ({ request: i }));
}
// La 4ème devrait échouer si maxRequests: 3 ✅
```

### Test 3 : Comptage global
```typescript
// Vérifie que toutes les requêtes sont comptées ensemble
await robustApi(async () => ({ type: 'user' }));     // 1/3
await robustApi(async () => ({ type: 'product' }));  // 2/3
await robustApi(async () => ({ type: 'order' }));    // 3/3
await robustApi(async () => ({ type: 'payment' }));  // ❌ Rate limit!
```

## Migration

### Si vous aviez ce pattern (AVANT) :

```typescript
// ❌ Pouvait retourner des résultats incorrects
const robustApi = compose([withRateLimiter({ maxRequests: 5 })]);

await robustApi(() => fetchUsers(), undefined);
await robustApi(() => fetchProducts(), undefined);
```

### Maintenant (APRÈS) :

```typescript
// ✅ Fonctionne correctement - chaque fonction retourne son propre résultat
const robustApi = compose([withRateLimiter({ maxRequests: 5 })]);

await robustApi(() => fetchUsers(), undefined);    // Retourne users
await robustApi(() => fetchProducts(), undefined); // Retourne products
```

**Aucun changement de code nécessaire !** Le fix est transparent.

## Notes Importantes

1. **Rate limiting global** : Le rate limiter compte TOUTES les requêtes ensemble, pas séparément par fonction
2. **State partagé** : L'instance du rate limiter est partagée entre tous les appels
3. **Cas d'usage idéal** : Limiter le débit global vers une API externe (ex: OpenAI, Anthropic)

## Cas d'usage alternatifs

Si vous voulez des rate limiters **séparés** pour différentes opérations :

```typescript
// Option 1 : Instances séparées
const userApi = compose([withRateLimiter({ maxRequests: 10 })]);
const productApi = compose([withRateLimiter({ maxRequests: 20 })]);

// Option 2 : Utiliser defineRateLimiter directement
const limitedUserFetch = defineRateLimiter({
  execute: fetchUsers,
  maxRequests: 10,
  windowMs: 60000
});

const limitedProductFetch = defineRateLimiter({
  execute: fetchProducts,
  maxRequests: 20,
  windowMs: 60000
});
```

## Fichiers Modifiés

1. `src/composition/middleware.ts` - Fix du middleware
2. `src/rate-limiting/rate-limiter.ts` - Ajout de `getLimiter()` méthode
3. `src/composition/middleware.test.ts` - Nouveaux tests
4. `docs/patterns/compose.md` - Documentation mise à jour
5. `test-rate-limit-bug.ts` - Script de test manuel

## Exécuter les Tests

```bash
# Test manuel
npm run dev test-rate-limit-bug.ts

# Tests unitaires
npm test src/composition/middleware.test.ts
```
