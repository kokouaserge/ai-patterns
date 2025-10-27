/**
 * Simple Fan-Out Example
 *
 * This example demonstrates parallel processing with concurrency control.
 */

import { fanOut } from '../../src';

interface Task {
  id: number;
  name: string;
}

interface Result {
  id: number;
  name: string;
  processingTime: number;
  status: 'completed';
}

async function main() {
  console.log('⚡ Simple Fan-Out Example\n');

  const tasks: Task[] = [
    { id: 1, name: 'Task Alpha' },
    { id: 2, name: 'Task Beta' },
    { id: 3, name: 'Task Gamma' },
    { id: 4, name: 'Task Delta' },
    { id: 5, name: 'Task Epsilon' },
    { id: 6, name: 'Task Zeta' },
  ];

  console.log(`📋 Processing ${tasks.length} tasks with concurrency limit of 3\n`);

  const result = await fanOut<Task, Result>({
    items: tasks,
    execute: async (task) => {
      const startTime = Date.now();
      console.log(`  🔄 Starting: ${task.name}`);

      // Simulate work (random delay 1-3 seconds)
      const delay = 1000 + Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const processingTime = Date.now() - startTime;
      console.log(`  ✅ Completed: ${task.name} (${processingTime}ms)`);

      return {
        id: task.id,
        name: task.name,
        processingTime,
        status: 'completed' as const,
      };
    },
    concurrency: 3, // Process max 3 tasks at once
    onProgress: (completed, total) => {
      console.log(`\n📊 Progress: ${completed}/${total} tasks completed\n`);
    },
  });

  // Display results
  console.log('\n✅ All tasks completed!\n');
  console.log('📦 Results:');
  result.results.forEach((res) => {
    console.log(`  - ${res.name}: ${res.processingTime}ms`);
  });

  console.log(`\n📈 Summary:`);
  console.log(`  Total: ${result.total}`);
  console.log(`  Success: ${result.successCount}`);
  console.log(`  Failed: ${result.errorCount}`);
  console.log(`  Success Rate: ${((result.successCount / result.total) * 100).toFixed(1)}%`);
}

// Run the example
main().catch(console.error);
