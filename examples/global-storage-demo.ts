/**
 * Demo: Global Unified Storage
 *
 * This example demonstrates how all ai-patterns now share a single
 * GlobalStorage instance with namespace isolation.
 */

import {
  GlobalStorage,
  StorageNamespace,
  idempotent,
  costTracking,
  abTest,
  versionedPrompt,
  reflectionLoop,
} from '../src';

async function demo() {
  console.log('=== Global Storage Demo ===\n');

  // Get the global storage instance
  const storage = GlobalStorage.getInstance();

  console.log('1. Initial storage stats:');
  console.log(JSON.stringify(storage.getStats(), null, 2));
  console.log();

  // Use idempotency pattern
  console.log('2. Using idempotency pattern...');
  const idempotencyInstance = new (await import('../src/consistency/idempotency')).Idempotency(
    async () => {
      console.log('   Executing expensive operation');
      return 'result';
    },
    {
      keyGenerator: () => 'demo-key',
    }
  );
  await idempotencyInstance.execute();

  console.log('   Storage stats after idempotency:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Use cost tracking
  console.log('3. Using cost tracking...');
  await costTracking({
    execute: async () => ({ value: 'result', tokens: 100 }),
    costPerToken: 0.01,
    monthlyBudget: 1000,
  });

  console.log('   Storage stats after cost tracking:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Use A/B testing
  console.log('4. Using A/B testing...');
  await abTest({
    variants: [
      { name: 'A', weight: 0.5, execute: async () => 'variant A' },
      { name: 'B', weight: 0.5, execute: async () => 'variant B' },
    ],
    userId: 'user-123',
    experimentId: 'test-experiment',
  });

  console.log('   Storage stats after A/B testing:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Use prompt versioning
  console.log('5. Using prompt versioning...');
  await versionedPrompt({
    promptId: 'demo-prompt',
    versions: {
      'v1.0': {
        prompt: 'Test prompt',
        active: true,
      },
    },
    execute: async (prompt) => prompt,
  });

  console.log('   Storage stats after prompt versioning:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Use reflection loop
  console.log('6. Using reflection loop...');
  await reflectionLoop({
    execute: async () => 'response',
    reflect: async () => ({
      score: 10,
      feedback: 'good',
      shouldContinue: false,
    }),
    enableHistory: true,
    sessionId: 'demo-session',
  });

  console.log('   Storage stats after reflection loop:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Show total storage size
  console.log('7. Total storage size across all patterns:');
  const totalSize = await storage.size();
  console.log(`   Total entries: ${totalSize}`);
  console.log();

  // Show entries by namespace
  console.log('8. Entries by namespace:');
  for (const namespace of Object.values(StorageNamespace)) {
    const size = await storage.size(namespace);
    console.log(`   ${namespace}: ${size} entries`);
  }
  console.log();

  // Clear specific namespace
  console.log('9. Clearing idempotency namespace...');
  await storage.clear(StorageNamespace.IDEMPOTENCY);
  console.log('   Storage stats after clearing idempotency:');
  console.log('   ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n   '));
  console.log();

  // Clear all
  console.log('10. Clearing all storage...');
  await GlobalStorage.clearAll();
  console.log('    Final storage stats:');
  console.log('    ' + JSON.stringify(storage.getStats(), null, 2).replace(/\n/g, '\n    '));
  console.log();

  console.log('=== Demo Complete ===');
  console.log('\nKey Takeaways:');
  console.log('- All patterns share the same GlobalStorage instance');
  console.log('- Each pattern uses its own namespace for isolation');
  console.log('- You can monitor storage usage across all patterns');
  console.log('- You can clear data by namespace or all at once');
  console.log('- Memory-efficient with automatic cleanup');
}

// Run the demo
demo().catch(console.error);
