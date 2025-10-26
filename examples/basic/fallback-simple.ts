/**
 * Simple Fallback Example
 *
 * This example demonstrates how to use fallback functions when primary fails.
 */

import { fallback } from '../../src';

// Simulate API services
let primaryAPIHealth = 0.3; // 30% success rate
let backupAPIHealth = 0.8; // 80% success rate

async function callPrimaryAPI(): Promise<string> {
  console.log('  🎯 Calling Primary API...');
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (Math.random() < primaryAPIHealth) {
    return 'Data from Primary API';
  }

  throw new Error('Primary API unavailable');
}

async function callBackupAPI(): Promise<string> {
  console.log('  🔄 Calling Backup API...');
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (Math.random() < backupAPIHealth) {
    return 'Data from Backup API';
  }

  throw new Error('Backup API unavailable');
}

async function callCacheAPI(): Promise<string> {
  console.log('  💾 Calling Cache API (always works)...');
  await new Promise((resolve) => setTimeout(resolve, 100));
  return 'Cached data (stale)';
}

async function main() {
  console.log('🔄 Simple Fallback Example\n');

  // Test 1: Primary → Backup → Cache
  console.log('📍 Test 1: Trying Primary → Backup → Cache\n');

  try {
    const result = await fallback({
      execute: callPrimaryAPI,
      fallback: [callBackupAPI, callCacheAPI],

      onPrimaryFailure: (error) => {
        console.log(`  ⚠️  Primary failed: ${error.message}`);
      },

      onFallbackUsed: (index, error) => {
        console.log(`  ✅ Fallback #${index + 1} succeeded!\n`);
      },
    });

    console.log(`✅ Success!`);
    console.log(`   Data: "${result.value}"`);
    console.log(`   Source: ${result.succeededAt === 0 ? 'Primary' : `Fallback #${result.succeededAt}`}`);
    console.log(`   Attempts: ${result.attempts}`);
    console.log(`   Errors encountered: ${result.errors.length}\n`);
  } catch (error) {
    console.error(`❌ All APIs failed: ${error.message}\n`);
  }

  console.log('---\n');

  // Test 2: With custom shouldFallback
  console.log('📍 Test 2: Conditional fallback (only 5xx errors)\n');

  try {
    const result = await fallback({
      execute: async () => {
        const error: any = new Error('Bad Request');
        error.statusCode = 400; // 4xx error
        throw error;
      },

      fallback: async () => {
        return 'Fallback data';
      },

      shouldFallback: (error: any) => {
        // Only fallback on 5xx errors (server errors)
        return error.statusCode >= 500;
      },
    });

    console.log(`✅ Success: ${result.value}\n`);
  } catch (error: any) {
    console.log(`❌ No fallback triggered for 4xx error: ${error.message}`);
    console.log(`   (Client errors should not use fallback)\n`);
  }

  console.log('📊 Fallback Example Complete\n');
}

// Run the example
main().catch(console.error);
