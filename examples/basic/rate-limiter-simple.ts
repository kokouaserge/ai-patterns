/**
 * Simple Rate Limiter Example
 *
 * This example demonstrates how to control request throughput.
 */

import { defineRateLimiter, RateLimitStrategy } from '../../src';

async function main() {
  console.log('🚦 Simple Rate Limiter Example\n');

  // Create a rate limiter: max 3 requests per 5 seconds
  const limitedCall = defineRateLimiter({
    execute: async () => {
      const timestamp = new Date().toISOString();
      return {
        message: 'API call successful',
        timestamp,
      };
    },
    maxRequests: 3,
    windowMs: 5000, // 5 seconds
    strategy: RateLimitStrategy.SLIDING_WINDOW,
  });

  console.log('📍 Making 5 requests (limit: 3 per 5 seconds)\n');

  // Make 5 rapid requests
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`📞 Request #${i}`);
      const result = await limitedCall();
      console.log(`  ✅ ${result.value.message}`);
      console.log(`  📊 Remaining: ${result.remaining}/3`);

      // Show reset time if we need to wait
      if (result.remaining === 0) {
        const now = Date.now();
        const waitMs = result.resetAt - now;
        console.log(`  ⏳ Wait ${waitMs}ms before next request\n`);
      }
    } catch (error) {
      console.error(`  ❌ Rate limit exceeded: ${error.message}\n`);
    }
  }

  // Demonstrate wait() method
  console.log('---\n');
  console.log('📍 Using wait() to respect rate limits\n');

  await limitedCall.wait();
  console.log('✅ Wait complete - can make request now');
  const result = await limitedCall();
  console.log(`📦 ${result.value.message}`);
  console.log(`📊 Remaining: ${result.remaining}/3\n`);
}

// Run the example
main().catch(console.error);
