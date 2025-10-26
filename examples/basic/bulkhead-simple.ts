import { defineBulkhead } from '../../src';

async function heavyComputation() {
  await new Promise(r => setTimeout(r, 1000));
  return { result: Math.random() };
}

async function main() {
  console.log('🛡️  Bulkhead Example\n');

  const protectedCall = defineBulkhead({
    execute: heavyComputation,
    maxConcurrent: 3,
    maxQueue: 5
  });

  console.log('Launching 10 requests (max 3 concurrent):\n');

  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(
      protectedCall()
        .then(result => console.log(`✅ Request ${i + 1}: queued ${result.queueTime}ms`))
        .catch(error => console.log(`❌ Request ${i + 1}: ${error.message}`))
    );
  }

  await Promise.all(requests);
  console.log(`\n📊 Stats:`, protectedCall.getStats());
}

main().catch(console.error);
