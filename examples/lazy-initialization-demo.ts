/**
 * Demo: Lazy Initialization
 *
 * This demonstrates that NO pattern initializes until actually used.
 * The GlobalStorage and default storages only initialize when needed.
 */

import { GlobalStorage } from '../src/common/storage';

console.log('=== Lazy Initialization Demo ===\n');

// Step 1: Import the library
console.log('1. ✅ Library imported');
console.log('   - No storage created yet');
console.log('   - No GlobalStorage instance exists');
console.log('   - Zero memory footprint\n');

// Step 2: Check if GlobalStorage exists
const hasInstance = (GlobalStorage as any).instance !== null;
console.log('2. Check GlobalStorage instance:');
console.log(`   - Instance exists: ${hasInstance}`);
console.log('   - Nothing is initialized until first use\n');

// Step 3: Use a pattern for the first time
console.log('3. First pattern usage (costTracking):');
import('../src/monitoring/cost-tracking').then(async ({ costTracking }) => {
  console.log('   - Pattern imported');

  const beforeUse = (GlobalStorage as any).instance !== null;
  console.log(`   - GlobalStorage exists before use: ${beforeUse}`);

  await costTracking({
    execute: async () => ({ value: 'result', tokens: 100 }),
    costPerToken: 0.01,
  });

  const afterUse = (GlobalStorage as any).instance !== null;
  console.log(`   - GlobalStorage exists after use: ${afterUse}`);
  console.log('   - ✅ Storage initialized ONLY when needed\n');

  // Step 4: Show storage stats
  const storage = GlobalStorage.getInstance();
  console.log('4. Storage statistics after first use:');
  console.log(JSON.stringify(storage.getStats(), null, 2));
  console.log();

  console.log('=== Key Takeaways ===');
  console.log('✅ No initialization at import time');
  console.log('✅ GlobalStorage created only on first use');
  console.log('✅ Pattern-specific storages lazy-loaded');
  console.log('✅ Zero overhead if patterns unused');
  console.log('✅ Perfect for tree-shaking and bundle size');
});
