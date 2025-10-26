# Saga Pattern

Implement distributed transactions with automatic compensation and rollback.

## Overview

The **Saga** pattern manages long-running transactions that span multiple services or operations. When a step fails, it automatically compensates (rolls back) all completed steps. Perfect for:

- E-commerce order processing
- Multi-step payment workflows
- Distributed microservice transactions
- Booking systems (flights, hotels, etc.)
- Resource allocation across services

### Key Features

- 🔄 **Automatic Compensation** - Rollback on failure
- 📝 **Shared Context** - Pass data between steps
- ⚡ **Conditional Steps** - Skip steps based on context
- ⏱️ **Timeout Support** - Per-step time limits
- 🎯 **Type-Safe** - Full TypeScript generics for context
- 📊 **Lifecycle Callbacks** - Monitor each step
- 🔔 **Error Handling** - Detailed failure information

---

## API Reference

### Basic Usage

```typescript
import { executeSaga } from 'ai-patterns';

const result = await executeSaga({
  context: { userId: 'user-1', orderId: 'order-123' },
  steps: [
    {
      name: 'Reserve Inventory',
      execute: async (ctx) => {
        return await reserveInventory(ctx.orderId);
      },
      compensate: async (ctx) => {
        await releaseInventory(ctx.orderId);
      }
    },
    {
      name: 'Process Payment',
      execute: async (ctx) => {
        return await processPayment(ctx.userId);
      },
      compensate: async (ctx) => {
        await refundPayment(ctx.userId);
      }
    }
  ]
});

if (result.success) {
  console.log('Transaction completed');
} else {
  console.log(`Failed: ${result.error.message}`);
  console.log(`Compensated ${result.compensatedSteps} steps`);
}
```

### With Type Safety

```typescript
interface OrderContext {
  orderId: string;
  userId: string;
  inventoryId?: string;
  paymentId?: string;
  shippingId?: string;
}

const result = await executeSaga<OrderContext>({
  context: { orderId: '123', userId: 'user-1' },
  steps: [
    {
      name: 'Reserve Inventory',
      execute: async (ctx) => {
        const inventoryId = await reserveInventory(ctx.orderId);
        ctx.inventoryId = inventoryId; // ✅ Type-safe context mutation
        return inventoryId;
      },
      compensate: async (ctx) => {
        if (ctx.inventoryId) {
          await releaseInventory(ctx.inventoryId);
        }
      }
    },
    {
      name: 'Process Payment',
      execute: async (ctx) => {
        const paymentId = await processPayment(ctx.userId);
        ctx.paymentId = paymentId;
        return paymentId;
      },
      compensate: async (ctx) => {
        if (ctx.paymentId) {
          await refundPayment(ctx.paymentId);
        }
      }
    }
  ]
});

console.log(result.context.paymentId); // ✅ Fully typed
```

### SagaOptions<TContext>

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `context` | `TContext` | ✅ Yes | - | Initial context passed to all steps |
| `steps` | `SagaStep<TContext>[]` | ✅ Yes | - | Array of steps to execute |
| `logger` | `Logger` | ❌ No | `undefined` | Logger for events |
| `onStepStart` | `(step, index) => void` | ❌ No | `undefined` | Before each step |
| `onStepComplete` | `(step, index, result) => void` | ❌ No | `undefined` | After successful step |
| `onStepError` | `(step, index, error) => void` | ❌ No | `undefined` | On step error |
| `onCompensate` | `(step, index) => void` | ❌ No | `undefined` | During compensation |
| `onComplete` | `(context) => void` | ❌ No | `undefined` | On saga completion |
| `onFailure` | `(error, context) => void` | ❌ No | `undefined` | On saga failure |

### SagaStep<TContext>

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ Yes | Step name (for logging) |
| `execute` | `(context) => Promise<any>` | ✅ Yes | Step execution function |
| `compensate` | `(context, result?) => Promise<void>` | ❌ No | Rollback function |
| `condition` | `(context) => boolean \| Promise<boolean>` | ❌ No | Skip step if false |
| `timeout` | `number` | ❌ No | Timeout in milliseconds |

### SagaResult<TContext>

```typescript
interface SagaResult<TContext> {
  success: boolean;           // Overall success/failure
  context: TContext;          // Final context state
  stepResults: unknown[];     // Results of each step
  completedSteps: number;     // Number of completed steps
  compensatedSteps: number;   // Number of compensated steps
  error?: Error;              // Error if failed
  duration: number;           // Total duration (ms)
}
```

---

## How It Works

### Execution Flow

```
Step 1 → Step 2 → Step 3 → Step 4 → ✅ Success
  ✓        ✓        ✓        ✓
```

If all steps succeed, the saga completes successfully.

### Failure and Compensation

```
Step 1 → Step 2 → Step 3 → ❌ Step 4 fails
  ✓        ✓        ✓        ✗
  ↓        ↓        ↓
Comp 1 ← Comp 2 ← Comp 3   (Rollback in reverse order)
  ✓        ✓        ✓
```

If a step fails, all completed steps are compensated in reverse order.

---

## Examples

### Example 1: E-Commerce Order

```typescript
import { executeSaga } from 'ai-patterns';

interface OrderContext {
  orderId: string;
  userId: string;
  amount: number;
  inventoryReserved?: boolean;
  paymentProcessed?: boolean;
  emailSent?: boolean;
}

const result = await executeSaga<OrderContext>({
  context: {
    orderId: 'order-123',
    userId: 'user-456',
    amount: 99.99
  },
  steps: [
    {
      name: 'Reserve Inventory',
      execute: async (ctx) => {
        await db.inventory.reserve(ctx.orderId);
        ctx.inventoryReserved = true;
        return true;
      },
      compensate: async (ctx) => {
        if (ctx.inventoryReserved) {
          await db.inventory.release(ctx.orderId);
          console.log('Inventory released');
        }
      }
    },
    {
      name: 'Process Payment',
      execute: async (ctx) => {
        await stripe.charge(ctx.userId, ctx.amount);
        ctx.paymentProcessed = true;
        return true;
      },
      compensate: async (ctx) => {
        if (ctx.paymentProcessed) {
          await stripe.refund(ctx.userId, ctx.amount);
          console.log('Payment refunded');
        }
      }
    },
    {
      name: 'Send Confirmation Email',
      execute: async (ctx) => {
        await sendEmail(ctx.userId, 'Order confirmed!');
        ctx.emailSent = true;
        return true;
      },
      compensate: async (ctx) => {
        if (ctx.emailSent) {
          await sendEmail(ctx.userId, 'Order cancelled');
          console.log('Cancellation email sent');
        }
      }
    }
  ],
  onStepComplete: (step, index) => {
    console.log(`✓ ${step.name} completed`);
  },
  onCompensate: (step, index) => {
    console.log(`↻ ${step.name} compensated`);
  }
});

if (result.success) {
  console.log(`Order ${result.context.orderId} completed successfully`);
} else {
  console.error(`Order failed: ${result.error.message}`);
  console.log(`Compensated ${result.compensatedSteps} steps`);
}
```

### Example 2: Hotel + Flight Booking

```typescript
import { executeSaga } from 'ai-patterns';

interface BookingContext {
  userId: string;
  hotelId?: string;
  flightId?: string;
  carId?: string;
}

const result = await executeSaga<BookingContext>({
  context: { userId: 'user-789' },
  steps: [
    {
      name: 'Book Hotel',
      execute: async (ctx) => {
        const reservation = await bookHotel('hotel-123');
        ctx.hotelId = reservation.id;
        return reservation;
      },
      compensate: async (ctx) => {
        if (ctx.hotelId) {
          await cancelHotel(ctx.hotelId);
        }
      },
      timeout: 10000 // 10 second timeout
    },
    {
      name: 'Book Flight',
      execute: async (ctx) => {
        const booking = await bookFlight('flight-456');
        ctx.flightId = booking.id;
        return booking;
      },
      compensate: async (ctx) => {
        if (ctx.flightId) {
          await cancelFlight(ctx.flightId);
        }
      },
      timeout: 10000
    },
    {
      name: 'Book Rental Car',
      execute: async (ctx) => {
        const rental = await bookCar('car-789');
        ctx.carId = rental.id;
        return rental;
      },
      compensate: async (ctx) => {
        if (ctx.carId) {
          await cancelCar(ctx.carId);
        }
      },
      condition: async (ctx) => {
        // Only book car if user requested it
        const prefs = await getUserPreferences(ctx.userId);
        return prefs.needsCar;
      },
      timeout: 5000
    }
  ]
});

if (result.success) {
  console.log('Trip booked successfully!');
  console.log('Hotel:', result.context.hotelId);
  console.log('Flight:', result.context.flightId);
  if (result.context.carId) {
    console.log('Car:', result.context.carId);
  }
} else {
  console.error('Booking failed - all reservations cancelled');
}
```

### Example 3: Microservices Transaction

```typescript
import { executeSaga } from 'ai-patterns';

interface TransactionContext {
  userId: string;
  accountId: string;
  amount: number;
  transactionId?: string;
  auditLogId?: string;
}

const result = await executeSaga<TransactionContext>({
  context: {
    userId: 'user-123',
    accountId: 'account-456',
    amount: 1000
  },
  steps: [
    {
      name: 'Validate Account',
      execute: async (ctx) => {
        const account = await accountService.get(ctx.accountId);
        if (account.balance < ctx.amount) {
          throw new Error('Insufficient balance');
        }
        return account;
      }
    },
    {
      name: 'Debit Account',
      execute: async (ctx) => {
        const txn = await accountService.debit(ctx.accountId, ctx.amount);
        ctx.transactionId = txn.id;
        return txn;
      },
      compensate: async (ctx) => {
        if (ctx.transactionId) {
          await accountService.credit(ctx.accountId, ctx.amount);
        }
      }
    },
    {
      name: 'Create Audit Log',
      execute: async (ctx) => {
        const log = await auditService.log({
          userId: ctx.userId,
          transactionId: ctx.transactionId,
          amount: ctx.amount
        });
        ctx.auditLogId = log.id;
        return log;
      },
      compensate: async (ctx) => {
        if (ctx.auditLogId) {
          await auditService.delete(ctx.auditLogId);
        }
      }
    },
    {
      name: 'Send Notification',
      execute: async (ctx) => {
        await notificationService.send(ctx.userId, {
          type: 'transaction',
          amount: ctx.amount
        });
      }
      // No compensation needed for notification
    }
  ],
  logger: customLogger
});
```

### Example 4: Conditional Steps

```typescript
import { executeSaga } from 'ai-patterns';

interface OrderContext {
  orderId: string;
  amount: number;
  requiresApproval?: boolean;
  approved?: boolean;
}

const result = await executeSaga<OrderContext>({
  context: {
    orderId: 'order-999',
    amount: 50000
  },
  steps: [
    {
      name: 'Check Amount',
      execute: async (ctx) => {
        // Orders over $10k require approval
        ctx.requiresApproval = ctx.amount > 10000;
        return ctx.requiresApproval;
      }
    },
    {
      name: 'Request Approval',
      execute: async (ctx) => {
        const approval = await requestManagerApproval(ctx.orderId);
        ctx.approved = approval.approved;
        if (!approval.approved) {
          throw new Error('Order not approved');
        }
        return approval;
      },
      condition: (ctx) => ctx.requiresApproval === true, // Only if approval needed
      timeout: 300000 // 5 minutes for approval
    },
    {
      name: 'Process Order',
      execute: async (ctx) => {
        return await processOrder(ctx.orderId);
      }
    }
  ]
});
```

### Example 5: Error Handling and Monitoring

```typescript
import { executeSaga } from 'ai-patterns';

const result = await executeSaga({
  context: { orderId: 'order-123' },
  steps: [
    /* ... steps ... */
  ],
  onStepStart: (step, index) => {
    console.log(`[${index + 1}] Starting: ${step.name}`);
    metrics.increment('saga.step.start', { step: step.name });
  },
  onStepComplete: (step, index, result) => {
    console.log(`[${index + 1}] ✓ ${step.name} completed`);
    metrics.increment('saga.step.complete', { step: step.name });
  },
  onStepError: (step, index, error) => {
    console.error(`[${index + 1}] ✗ ${step.name} failed:`, error);
    metrics.increment('saga.step.error', { step: step.name });
  },
  onCompensate: (step, index) => {
    console.log(`[${index + 1}] ↻ Compensating: ${step.name}`);
    metrics.increment('saga.compensate', { step: step.name });
  },
  onComplete: (context) => {
    console.log('✅ Saga completed successfully');
    metrics.increment('saga.complete');
  },
  onFailure: (error, context) => {
    console.error('❌ Saga failed:', error.message);
    metrics.increment('saga.failure');
    alerts.send('Saga failure', { error, context });
  }
});
```

---

## Best Practices

### ✅ Do's

1. **Always Implement Compensation**
   ```typescript
   {
     name: 'Reserve Inventory',
     execute: async (ctx) => {
       return await reserveInventory(ctx.orderId);
     },
     compensate: async (ctx) => {
       // ✅ Always provide rollback logic
       await releaseInventory(ctx.orderId);
     }
   }
   ```

2. **Keep Steps Idempotent**
   ```typescript
   {
     name: 'Process Payment',
     execute: async (ctx) => {
       // ✅ Check if already processed
       if (ctx.paymentId) return ctx.paymentId;
       return await processPayment(ctx.userId);
     }
   }
   ```

3. **Use Context for State Sharing**
   ```typescript
   interface OrderContext {
     orderId: string;
     inventoryId?: string;  // ✅ Track IDs for compensation
     paymentId?: string;
   }
   ```

4. **Set Timeouts for Long Steps**
   ```typescript
   {
     name: 'Wait for Approval',
     execute: async (ctx) => { ... },
     timeout: 300000, // ✅ 5 minute timeout
   }
   ```

### ❌ Don'ts

1. **Don't Skip Compensation Logic**
   ```typescript
   // Bad: No compensation
   {
     name: 'Charge Payment',
     execute: async (ctx) => {
       return await chargeCard(ctx.userId);
     }
     // ❌ Missing compensate - can't rollback!
   }

   // Good: With compensation
   {
     name: 'Charge Payment',
     execute: async (ctx) => {
       const charge = await chargeCard(ctx.userId);
       ctx.chargeId = charge.id;
       return charge;
     },
     compensate: async (ctx) => {
       if (ctx.chargeId) {
         await refundCharge(ctx.chargeId);
       }
     }
   }
   ```

2. **Don't Mutate External State Without Tracking**
   ```typescript
   // Bad: Can't compensate
   execute: async (ctx) => {
     await updateDatabase(data); // ❌ No tracking
   }

   // Good: Track changes
   execute: async (ctx) => {
     const result = await updateDatabase(data);
     ctx.updateId = result.id; // ✅ Track for rollback
     return result;
   }
   ```

3. **Don't Ignore Errors**
   ```typescript
   // Bad: Silent failure
   const result = await executeSaga({ ... });
   // ❌ No error handling

   // Good: Handle errors
   const result = await executeSaga({ ... });
   if (!result.success) {
     logger.error('Saga failed', { error: result.error });
     notifyUser('Transaction failed');
   }
   ```

---

## Production Configuration

### E-Commerce

```typescript
const result = await executeSaga({
  context: orderContext,
  steps: orderSteps,
  logger: productionLogger,
  onStepComplete: (step) => {
    metrics.increment('saga.step.success', { step: step.name });
  },
  onCompensate: (step) => {
    metrics.increment('saga.compensate', { step: step.name });
    alerts.send('Saga compensation', { step: step.name });
  },
  onFailure: (error, context) => {
    logger.error('Order saga failed', { error, orderId: context.orderId });
    metrics.increment('saga.failure');
  }
});
```

### Microservices

```typescript
const result = await executeSaga({
  context: transactionContext,
  steps: transactionSteps,
  logger: distributedLogger,
  onStepStart: (step) => {
    tracing.startSpan(`saga.${step.name}`);
  },
  onStepComplete: (step) => {
    tracing.endSpan(`saga.${step.name}`);
  }
});
```

---

## Pattern Composition

### Saga + Retry

```typescript
import { executeSaga, retry, BackoffStrategy } from 'ai-patterns';

const result = await executeSaga({
  context: { ... },
  steps: [
    {
      name: 'Call External API',
      execute: async (ctx) => {
        return await retry({
          execute: () => externalAPI.call(ctx.data),
          maxAttempts: 3,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        });
      },
      compensate: async (ctx) => { ... }
    }
  ]
});
```

### Saga + Timeout

```typescript
import { executeSaga, timeout, TimeoutDurations } from 'ai-patterns';

const result = await executeSaga({
  context: { ... },
  steps: [
    {
      name: 'Long Running Task',
      execute: async (ctx) => {
        return await timeout({
          execute: () => longTask(),
          timeoutMs: TimeoutDurations.LONG
        });
      },
      compensate: async (ctx) => { ... }
    }
  ]
});
```

---

## Related Patterns

- **[Retry](./retry.md)** - Retry failed saga steps
- **[Timeout](./timeout.md)** - Add timeouts to saga steps
- **[Idempotency](./idempotency.md)** - Ensure saga steps are idempotent

---

## Additional Resources

- [Saga Pattern (Microservices.io)](https://microservices.io/patterns/data/saga.html)
- [Distributed Transactions](https://en.wikipedia.org/wiki/Distributed_transaction)
- [Best Practices Guide](../guides/best-practices.md)
