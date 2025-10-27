import { defineThrottle } from '../../src';

let trackCount = 0;

async function trackEvent(event: string) {
  trackCount++;
  console.log(`  📊 Tracking #${trackCount}: ${event}`);
  return { tracked: true, count: trackCount };
}

async function main() {
  console.log('🚦 Throttle Example\n');

  const throttledTrack = defineThrottle({
    execute: trackEvent,
    interval: 1000
  });

  console.log('Rapid event tracking:');
  await throttledTrack('scroll-1');
  await throttledTrack('scroll-2');
  await throttledTrack('scroll-3');
  await new Promise(r => setTimeout(r, 1100));
  await throttledTrack('scroll-4');

  console.log(`\n✅ Total tracked: ${trackCount}/4 events\n`);
}

main().catch(console.error);
