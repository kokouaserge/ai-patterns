/**
 * Simple Retry Example
 *
 * This example demonstrates the basic usage of the retry pattern
 * with exponential backoff.
 */

import { retry, BackoffStrategy } from '../../src';

async function main() {
  console.log('🔄 Simple Retry Example\n');

  let attemptCount = 0;

  try {
    const result = await retry({
      execute: async () => {
        attemptCount++;
        console.log(`📍 Attempt ${attemptCount}`);

        // Simulate 70% failure rate for demonstration
        if (Math.random() < 0.7) {
          throw new Error('Random failure (simulated)');
        }

        return {
          success: true,
          data: 'Hello from retry pattern!',
          timestamp: new Date().toISOString(),
        };
      },

      maxAttempts: 5,
      initialDelay: 1000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,

      onRetry: (error, attempt, delay) => {
        console.log(`  ❌ Failed: ${error.message}`);
        console.log(`  ⏳ Retrying in ${delay}ms...\n`);
      },
    });

    console.log('✅ Success!');
    console.log(`📊 Total attempts: ${result.attempts}`);
    console.log(`⏱️  Total delay: ${result.totalDelay}ms`);
    console.log(`📦 Result:`, result.value);
  } catch (error) {
    console.error('\n❌ All retry attempts failed');
    console.error('Error:', error.message);
  }
}

// Run the example
main().catch(console.error);
