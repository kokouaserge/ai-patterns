import { deadLetterQueue } from '../../src';

const deadLetters: any[] = [];

async function processMessage(msg: string) {
  if (Math.random() < 0.7) throw new Error('Processing failed');
  return { processed: true, message: msg };
}

async function main() {
  console.log('💀 Dead Letter Queue Example\n');

  try {
    await deadLetterQueue({
      execute: processMessage,
      maxRetries: 3,
      onDeadLetter: (item, errors) => {
        deadLetters.push({ item, errors });
        console.log(`\n💀 Sent to DLQ: "${item}" after ${errors.length} failures\n`);
      }
    }, 'test-message');
  } catch (error) {
    console.log(`❌ Final error: ${error.message}`);
  }

  console.log(`📊 Dead letters: ${deadLetters.length}\n`);
}

main().catch(console.error);
