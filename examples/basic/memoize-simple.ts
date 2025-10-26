import { memoize } from '../../src';

let callCount = 0;

const fetchUser = memoize({
  execute: async (id: string) => {
    callCount++;
    console.log(`  🔍 Fetching user ${id} from DB (call #${callCount})`);
    await new Promise(r => setTimeout(r, 500));
    return { id, name: `User ${id}` };
  },
  ttl: 2000,
  keyFn: (id) => `user:${id}`
});

async function main() {
  console.log('💾 Memoize Example\n');

  await fetchUser('123');
  await fetchUser('123'); // Cached
  await fetchUser('456');
  await fetchUser('123'); // Still cached

  console.log(`\n✅ Total API calls: ${callCount}/4 requests (2 cached)\n`);
}

main().catch(console.error);
