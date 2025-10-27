/**
 * Simple Idempotency Example
 *
 * This example demonstrates how to prevent duplicate operations.
 */

import { idempotent } from '../../src';

let executionCount = 0;

async function main() {
  console.log('🔒 Simple Idempotency Example\n');

  const processOrder = async (orderId: string) => {
    return await idempotent({
      execute: async () => {
        executionCount++;
        console.log(`  💰 Processing payment for order ${orderId} (execution #${executionCount})`);

        // Simulate expensive operation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          orderId,
          status: 'completed',
          timestamp: new Date().toISOString(),
          amount: 99.99,
        };
      },
      key: `order:${orderId}`,
      ttl: 60000, // Cache for 1 minute
      onCacheHit: (key) => {
        console.log(`  ✅ Returning cached result for ${key} (no duplicate charge!)`);
      },
    });
  };

  // First call - will execute
  console.log('📍 First call (order-123):\n');
  const result1 = await processOrder('order-123');
  console.log(`\n✅ Result:`, result1);

  console.log('\n---\n');

  // Second call with same ID - will return cached result
  console.log('📍 Second call (order-123) - same order ID:\n');
  const result2 = await processOrder('order-123');
  console.log(`\n✅ Result:`, result2);

  console.log('\n---\n');

  // Third call with different ID - will execute again
  console.log('📍 Third call (order-456) - different order ID:\n');
  const result3 = await processOrder('order-456');
  console.log(`\n✅ Result:`, result3);

  console.log('\n---\n');
  console.log('📊 Summary:');
  console.log(`   Total function calls: 3`);
  console.log(`   Actual executions: ${executionCount}`);
  console.log(`   Cache hits: ${3 - executionCount}`);
  console.log(`   💵 Money saved: $${((3 - executionCount) * 99.99).toFixed(2)} (avoided duplicate charges)\n`);
}

// Run the example
main().catch(console.error);
