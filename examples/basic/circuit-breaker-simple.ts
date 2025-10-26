/**
 * Simple Circuit Breaker Example
 *
 * This example demonstrates how the circuit breaker protects
 * your application from cascading failures.
 */

import { defineCircuitBreaker } from '../../src';

async function main() {
  console.log('⚡ Simple Circuit Breaker Example\n');

  let callCount = 0;
  const failureRate = 0.8; // 80% failure rate to trigger circuit

  const breaker = defineCircuitBreaker({
    execute: async () => {
      callCount++;
      console.log(`📞 API Call #${callCount}`);

      // Simulate failing service
      if (Math.random() < failureRate) {
        throw new Error('Service unavailable');
      }

      return {
        success: true,
        data: `Response #${callCount}`,
      };
    },

    failureThreshold: 3, // Open after 3 failures
    openDuration: 5000, // Stay open for 5 seconds
    halfOpenMaxAttempts: 1,

    onStateChange: (oldState, newState) => {
      console.log(`\n🔄 Circuit: ${oldState} → ${newState}\n`);
    },

    onOpen: () => {
      console.log('🚫 Circuit OPENED - Requests will fail fast\n');
    },

    onClose: () => {
      console.log('✅ Circuit CLOSED - Normal operation resumed\n');
    },
  });

  // Make multiple requests to trigger circuit breaker
  for (let i = 0; i < 10; i++) {
    try {
      const result = await breaker(); // ✅ Direct call (Vercel-style)
      console.log(`  ✅ Success: ${result.data}`);
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
    }

    // Wait a bit between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Show final statistics
  console.log('\n📊 Final Statistics:');
  const stats = breaker.getStats(); // ✅ Utility method
  console.log({
    state: stats.state,
    totalCalls: stats.totalCalls,
    failures: stats.failureCount,
    successes: stats.successCount,
    successRate: ((stats.successCount / stats.totalCalls) * 100).toFixed(2) + '%',
  });
}

// Run the example
main().catch(console.error);
