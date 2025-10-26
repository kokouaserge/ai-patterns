# Circuit Breaker Pattern

Protect your application from cascading failures by stopping calls to failing external services and allowing them time to recover.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
- [Circuit States](#circuit-states)
- [Examples](#examples)
- [Monitoring](#monitoring)
- [Best Practices](#best-practices)
- [Related Patterns](#related-patterns)

---

## Overview

The circuit breaker pattern prevents an application from repeatedly trying to execute an operation that's likely to fail. It allows your system to detect failures and avoid wasting resources on doomed requests.

### Key Features

- **Three states** - CLOSED, OPEN, HALF_OPEN
- **Automatic recovery** - Tests service health after timeout
- **Failure tracking** - Monitors consecutive failures
- **State callbacks** - React to state changes
- **Type-safe** - Full TypeScript support

### Use Cases

- **External API calls** - Protect against third-party service failures
- **Database connections** - Handle database unavailability
- **Microservices** - Prevent cascading failures between services
- **Distributed systems** - Graceful degradation
- **Payment gateways** - Handle payment provider outages

### How It Works

1. **CLOSED** - Normal operation, requests flow through
2. **Failure threshold exceeded** → Circuit **OPENS**
3. **OPEN** - All requests fail immediately (fail-fast)
4. **After timeout** → Circuit goes to **HALF_OPEN**
5. **HALF_OPEN** - Test requests allowed to check if service recovered
   - **Success** → Circuit **CLOSES**
   - **Failure** → Circuit **OPENS** again

---

## Installation

```bash
npm install ai-patterns
```

---

## Basic Usage

```typescript
import { defineCircuitBreaker } from 'ai-patterns';

// Vercel-style: callable function with attached methods
const apiCall = defineCircuitBreaker({
  execute: () => callExternalAPI(),
  failureThreshold: 5,
  openDuration: 60000 // 1 minute
});

// Direct call (Vercel-style - like defineFlow)
const result = await apiCall();

// Access state and utilities
console.log(apiCall.getState());  // Get current circuit state
console.log(apiCall.getStats());  // Get statistics
apiCall.reset();                   // Reset circuit to CLOSED
```

---

## API Reference

### `circuitBreaker<TResult>(options: CircuitBreakerOptions<TResult>): CallableCircuitBreaker<TResult>`

Returns a **callable function** (Vercel-style) with attached utility methods.

#### CallableCircuitBreaker

```typescript
interface CallableCircuitBreaker<TResult> {
  // Direct callable (like Vercel's defineFlow)
  (): Promise<TResult>;

  // Utility methods
  getState(): CircuitState;
  getStats(): CircuitBreakerStats;
  reset(): void;
}
```

#### CircuitBreakerOptions

```typescript
interface CircuitBreakerOptions<TResult = any> {
  /**
   * Function to execute with circuit breaker protection
   */
  execute: AsyncFunction<TResult>;

  /**
   * Number of consecutive failures before opening circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Duration in ms to keep circuit open
   * @default 60000 (1 minute)
   */
  openDuration?: number;

  /**
   * Number of test requests in half-open state before closing
   * @default 1
   */
  halfOpenMaxAttempts?: number;

  /**
   * Timeout for each request in ms
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Function to determine if error should count towards failure
   * @default () => true
   */
  shouldCountFailure?: (error: Error) => boolean;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Callbacks for state changes
   */
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}
```

#### CircuitBreaker Class

```typescript
class CircuitBreaker<TResult> {
  /**
   * Execute function with circuit breaker protection
   */
  execute(): Promise<TResult>;

  /**
   * Get circuit statistics
   */
  getStats(): CircuitBreakerStats;

  /**
   * Reset circuit to closed state
   */
  reset(): void;

  /**
   * Get current state
   */
  getState(): CircuitState;
}
```

#### CircuitState Enum

```typescript
enum CircuitState {
  /**
   * Circuit is closed - requests flow normally
   */
  CLOSED = "CLOSED",

  /**
   * Circuit is open - requests are blocked
   */
  OPEN = "OPEN",

  /**
   * Circuit is half-open - testing if service recovered
   */
  HALF_OPEN = "HALF_OPEN"
}
```

#### CircuitBreakerStats

```typescript
interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}
```

---

## Circuit States

### CLOSED (Normal Operation)

- Requests pass through normally
- Failures are counted
- When failure threshold is reached → Opens

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  failureThreshold: 5 // Opens after 5 consecutive failures
});
```

### OPEN (Fail-Fast)

- All requests fail immediately
- No actual calls to the protected service
- After openDuration → Goes to HALF_OPEN

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  openDuration: 60000 // Stay open for 1 minute
});
```

### HALF_OPEN (Testing)

- Limited test requests allowed
- Success → Closes circuit
- Failure → Re-opens circuit

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  halfOpenMaxAttempts: 3 // Try 3 requests in half-open
});
```

---

## Examples

### Example 1: Basic Circuit Breaker

```typescript
import { defineCircuitBreaker, CircuitState } from 'ai-patterns';

const breaker = defineCircuitBreaker({
  execute: async () => {
    const response = await fetch('https://external-api.com/data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  failureThreshold: 5,
  openDuration: 60000
});

try {
  const result = await breaker.execute();
  console.log('Data:', result);
} catch (error) {
  console.error('Request failed:', error.message);
}
```

### Example 2: With State Monitoring

```typescript
import { defineCircuitBreaker } from 'ai-patterns';

const breaker = defineCircuitBreaker({
  execute: () => callPaymentGateway(),
  failureThreshold: 3,
  openDuration: 30000,

  onStateChange: (oldState, newState) => {
    console.log(`Circuit: ${oldState} → ${newState}`);

    // Alert when circuit opens
    if (newState === CircuitState.OPEN) {
      alerting.trigger('payment-gateway-down');
    }

    // Log recovery
    if (newState === CircuitState.CLOSED) {
      console.log('Payment gateway recovered');
    }
  },

  onOpen: () => {
    metrics.increment('circuit.opened', { service: 'payment' });
  },

  onClose: () => {
    metrics.increment('circuit.closed', { service: 'payment' });
  }
});
```

### Example 3: Conditional Failure Counting

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  failureThreshold: 5,

  // Only count 5xx errors, ignore 4xx
  shouldCountFailure: (error) => {
    if (error.response?.status >= 500) return true;
    if (error.code === 'ETIMEDOUT') return true;
    return false;
  }
});
```

### Example 4: With Statistics

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  failureThreshold: 5
});

// Execute requests
for (let i = 0; i < 10; i++) {
  try {
    await breaker.execute();
  } catch (error) {
    // Handle error
  }
}

// Get statistics
const stats = breaker.getStats();
console.log({
  state: stats.state,
  failures: stats.failureCount,
  successes: stats.successCount,
  total: stats.totalCalls,
  successRate: (stats.successCount / stats.totalCalls) * 100
});
```

### Example 5: Production Configuration

```typescript
import { defineCircuitBreaker, CircuitState } from 'ai-patterns';

const paymentBreaker = defineCircuitBreaker({
  execute: () => processPayment(),

  // Configuration
  failureThreshold: 5,
  openDuration: 60000,
  halfOpenMaxAttempts: 3,
  timeout: 10000,

  // Only count real failures
  shouldCountFailure: (error) => {
    // Ignore client errors
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return false;
    }
    return true;
  },

  // Monitoring
  logger: customLogger,

  onStateChange: (oldState, newState) => {
    logger.warn('Circuit state changed', {
      service: 'payment',
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });

    // Trigger alerts
    if (newState === CircuitState.OPEN) {
      pagerDuty.alert('Payment gateway circuit opened');
      metrics.gauge('circuit.state', 1, { service: 'payment', state: 'open' });
    }

    if (newState === CircuitState.CLOSED) {
      pagerDuty.resolve('Payment gateway circuit closed');
      metrics.gauge('circuit.state', 0, { service: 'payment', state: 'closed' });
    }
  },

  onOpen: () => {
    // Switch to fallback
    enablePaymentFallback();
  },

  onClose: () => {
    // Resume normal operation
    disablePaymentFallback();
  }
});

// Usage with error handling
async function handlePayment(data) {
  try {
    return await paymentBreaker.execute();
  } catch (error) {
    if (error.code === 'CIRCUIT_OPEN') {
      // Circuit is open, use fallback
      return await fallbackPaymentMethod(data);
    }
    throw error;
  }
}
```

---

## Monitoring

### Health Checks

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),
  failureThreshold: 5
});

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = breaker.getStats();

  res.json({
    service: 'external-api',
    circuitState: stats.state,
    isHealthy: stats.state === CircuitState.CLOSED,
    metrics: {
      totalCalls: stats.totalCalls,
      failures: stats.failureCount,
      successes: stats.successCount,
      successRate: (stats.successCount / stats.totalCalls) * 100
    }
  });
});
```

### Metrics Dashboard

```typescript
const breaker = defineCircuitBreaker({
  execute: () => callAPI(),

  onStateChange: (oldState, newState) => {
    // Send to metrics system
    datadog.gauge('circuit.state', {
      service: 'api',
      state: newState,
      value: newState === CircuitState.CLOSED ? 0 : 1
    });
  }
});

// Periodic metrics
setInterval(() => {
  const stats = breaker.getStats();

  metrics.gauge('circuit.failures', stats.failureCount);
  metrics.gauge('circuit.successes', stats.successCount);
  metrics.gauge('circuit.total', stats.totalCalls);
}, 60000);
```

---

## Best Practices

### ✅ Do

1. **Set appropriate failure threshold**
   ```typescript
   failureThreshold: 5 // For critical services
   ```

2. **Use reasonable open duration**
   ```typescript
   openDuration: 60000 // 1 minute for most services
   ```

3. **Monitor state changes**
   ```typescript
   onStateChange: (old, new) => logger.warn(`Circuit ${old} → ${new}`)
   ```

4. **Combine with retry**
   ```typescript
   const breaker = defineCircuitBreaker({
     execute: async () => {
       return await retry({
         execute: () => callAPI(),
         maxAttempts: 3
       });
     }
   });
   ```

5. **Have fallback mechanisms**
   ```typescript
   try {
     return await breaker.execute();
   } catch (error) {
     return cachedData; // Fallback
   }
   ```

### ❌ Don't

1. **Don't set failure threshold too low**
   ```typescript
   // Bad - too sensitive
   failureThreshold: 1

   // Good
   failureThreshold: 5
   ```

2. **Don't ignore circuit state**
   ```typescript
   // Bad - no handling
   await breaker.execute();

   // Good - handle open circuit
   try {
     await breaker.execute();
   } catch (error) {
     if (error.code === 'CIRCUIT_OPEN') {
       return fallback();
     }
   }
   ```

3. **Don't use without timeout**
   ```typescript
   // Good - with timeout
   defineCircuitBreaker({
     execute: () => callAPI(),
     timeout: 5000
   });
   ```

4. **Don't reset circuit manually unless necessary**
   - Let the circuit breaker manage state automatically

### Production Checklist

- [ ] Failure threshold configured appropriately
- [ ] Open duration set based on recovery time
- [ ] State change monitoring implemented
- [ ] Fallback mechanism in place
- [ ] Timeout configured
- [ ] Alerts configured for OPEN state
- [ ] Metrics dashboard created
- [ ] Half-open testing configured

---

## Related Patterns

### Combine with Retry

```typescript
import { defineCircuitBreaker, retry } from 'ai-patterns';

const breaker = defineCircuitBreaker({
  execute: async () => {
    return await retry({
      execute: () => callAPI(),
      maxAttempts: 3
    });
  },
  failureThreshold: 5
});
```

**[→ Retry Pattern Documentation](./retry.md)**

### Combine with Timeout

```typescript
import { defineCircuitBreaker, timeout } from 'ai-patterns';

const breaker = defineCircuitBreaker({
  execute: async () => {
    return await timeout({
      execute: () => callAPI(),
      timeoutMs: 5000
    });
  },
  failureThreshold: 5
});
```

**[→ Timeout Pattern Documentation](./timeout.md)**

### Combine with Rate Limiter

```typescript
import { defineCircuitBreaker, rateLimiter } from 'ai-patterns';

const limiter = rateLimiter({
  execute: async () => {
    const breaker = defineCircuitBreaker({
      execute: () => callAPI(),
      failureThreshold: 5
    });
    return await breaker.execute();
  },
  maxRequests: 100
});
```

**[→ Rate Limiter Pattern Documentation](./rate-limiter.md)**

---

## See Also

- [Pattern Composition Guide](../guides/composition.md)
- [Error Handling Guide](../guides/error-handling.md)
- [Best Practices Guide](../guides/best-practices.md)
- [API Reference](../api-reference.md)

---

## Examples

- [Basic Circuit Breaker](../../examples/basic/circuit-breaker-simple.ts)
- [With Monitoring](../../examples/basic/circuit-breaker-monitoring.ts)
- [Production Example](../../examples/basic/circuit-breaker-production.ts)

---

**[← Back to Documentation](../../README.md#patterns)**
