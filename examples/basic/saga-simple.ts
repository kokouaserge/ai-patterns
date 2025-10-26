/**
 * Simple Saga Example
 *
 * This example demonstrates multi-step workflows with automatic rollback.
 */

import { executeSaga } from '../../src';

interface OrderContext {
  orderId?: string;
  paymentId?: string;
  inventoryReserved?: boolean;
  emailSent?: boolean;
}

// Simulate database operations
const database = {
  orders: new Map<string, any>(),
  payments: new Map<string, any>(),
  inventory: new Map<string, number>([['item-123', 10]]),
};

async function main() {
  console.log('🔄 Simple Saga Example: Order Processing\n');

  const result = await executeSaga<OrderContext>({
    context: {},
    steps: [
      {
        name: 'Create Order',
        execute: async (ctx) => {
          console.log('📝 Step 1: Creating order...');
          const orderId = `order-${Date.now()}`;
          database.orders.set(orderId, { status: 'pending' });
          ctx.orderId = orderId;
          console.log(`  ✅ Order created: ${orderId}\n`);
          return orderId;
        },
        compensate: async (ctx) => {
          console.log(`  ↩️  Rolling back: Deleting order ${ctx.orderId}`);
          database.orders.delete(ctx.orderId!);
        },
      },
      {
        name: 'Reserve Inventory',
        execute: async (ctx) => {
          console.log('📦 Step 2: Reserving inventory...');
          const itemId = 'item-123';
          const current = database.inventory.get(itemId) || 0;

          if (current > 0) {
            database.inventory.set(itemId, current - 1);
            ctx.inventoryReserved = true;
            console.log(`  ✅ Inventory reserved (${current - 1} remaining)\n`);
            return true;
          }

          throw new Error('Out of stock');
        },
        compensate: async (ctx) => {
          if (ctx.inventoryReserved) {
            console.log('  ↩️  Rolling back: Releasing inventory');
            const itemId = 'item-123';
            const current = database.inventory.get(itemId) || 0;
            database.inventory.set(itemId, current + 1);
          }
        },
      },
      {
        name: 'Process Payment',
        execute: async (ctx) => {
          console.log('💳 Step 3: Processing payment...');

          // Simulate payment failure (70% success rate)
          if (Math.random() < 0.7) {
            const paymentId = `payment-${Date.now()}`;
            database.payments.set(paymentId, { status: 'completed' });
            ctx.paymentId = paymentId;
            console.log(`  ✅ Payment processed: ${paymentId}\n`);
            return paymentId;
          }

          throw new Error('Payment declined');
        },
        compensate: async (ctx) => {
          if (ctx.paymentId) {
            console.log(`  ↩️  Rolling back: Refunding payment ${ctx.paymentId}`);
            database.payments.delete(ctx.paymentId);
          }
        },
      },
      {
        name: 'Send Confirmation',
        execute: async (ctx) => {
          console.log('📧 Step 4: Sending confirmation email...');
          ctx.emailSent = true;
          console.log('  ✅ Email sent\n');
          return true;
        },
        compensate: async (ctx) => {
          if (ctx.emailSent) {
            console.log('  ↩️  Rolling back: Sending cancellation email');
          }
        },
      },
    ],
  });

  if (result.success) {
    console.log('✅ Order processing completed successfully!');
    console.log(`📦 Order ID: ${result.context.orderId}`);
    console.log(`💳 Payment ID: ${result.context.paymentId}`);
  } else {
    console.log('\n❌ Order processing failed - all steps rolled back');
    console.log(`📍 Completed steps: ${result.completedSteps}`);
    console.log(`↩️  Compensated steps: ${result.compensatedSteps}`);
    console.log(`❌ Error: ${result.error?.message}`);
  }
}

// Run the example
main().catch(console.error);
