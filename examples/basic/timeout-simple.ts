/**
 * Simple Timeout Example
 *
 * This example demonstrates how to add time limits to async operations.
 */

import { timeout, TimeoutDurations } from '../../src';

async function main() {
  console.log('⏱️  Simple Timeout Example\n');

  // Example 1: Fast operation (succeeds)
  console.log('📍 Test 1: Fast operation (should succeed)');
  try {
    const result = await timeout({
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { status: 'success', data: 'Fast operation completed!' };
      },
      timeoutMs: TimeoutDurations.SHORT, // 5 seconds
    });

    console.log('✅ Success:', result.value);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }

  console.log('\n---\n');

  // Example 2: Slow operation (times out)
  console.log('📍 Test 2: Slow operation (should timeout)');
  try {
    const result = await timeout({
      execute: async () => {
        console.log('  ⏳ Starting slow operation...');
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
        return { status: 'success', data: 'This will never be seen' };
      },
      timeoutMs: 3000, // 3 seconds max
      onTimeout: () => {
        console.log('  ⚠️  Operation timed out!');
      },
    });

    console.log('✅ Success:', result.value);
  } catch (error) {
    console.error('❌ Timed out after 3 seconds');
  }

  console.log('\n📊 Timeout Example Complete\n');
}

// Run the example
main().catch(console.error);
