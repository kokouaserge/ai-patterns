import { conditionalBranch } from '../../src';

async function main() {
  console.log('🔀 Conditional Branch Example\n');

  const amounts = [500, 1500, 2500];

  for (const amount of amounts) {
    console.log(`Processing amount: $${amount}`);

    const result = await conditionalBranch({
      condition: (data) => data.amount > 1000,
      onTrue: async (data) => {
        console.log(`  ⚠️  High amount - Manual approval required`);
        return { approved: 'pending', amount: data.amount };
      },
      onFalse: async (data) => {
        console.log(`  ✅ Auto-approved`);
        return { approved: 'auto', amount: data.amount };
      }
    }, { amount });

    console.log(`  Result:`, result, '\n');
  }
}

main().catch(console.error);
