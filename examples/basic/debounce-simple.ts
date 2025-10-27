import { defineDebounce } from '../../src';

let saveCount = 0;

async function saveData(text: string) {
  saveCount++;
  console.log(`  💾 Saving data #${saveCount}: "${text}"`);
  return { saved: true, count: saveCount };
}

async function main() {
  console.log('⏱️  Debounce Example\n');

  const debouncedSave = defineDebounce({
    execute: saveData,
    wait: 500,
    maxWait: 2000
  });

  console.log('Typing simulation (rapid calls):');
  await debouncedSave('H');
  await debouncedSave('He');
  await debouncedSave('Hel');
  await debouncedSave('Hell');
  const result = await debouncedSave('Hello');

  console.log(`\n✅ Final save: ${result.saved}, Total saves: ${result.count}\n`);
}

main().catch(console.error);
