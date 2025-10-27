/**
 * AI Agent with Compose
 *
 * This example demonstrates a production-ready AI agent using compose()
 * with multiple middleware for structured output generation.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  compose,
  withRetry,
  withTimeout,
  withFallback,
  withCircuitBreaker,
  withCache,
  BackoffStrategy,
} from "../../src";

// Define the schema for structured output
const TaskAnalysisSchema = z.object({
  category: z.enum(["technical", "creative", "analytical", "general"]),
  complexity: z.enum(["low", "medium", "high"]),
  estimatedTime: z.number().describe("Estimated time in minutes"),
  steps: z.array(z.string()).describe("List of steps to complete the task"),
  confidence: z.number().min(0).max(1).describe("Confidence score"),
});

type TaskAnalysis = z.infer<typeof TaskAnalysisSchema>;

async function main() {
  console.log("🤖 AI Agent with Compose\n");

  // Create a robust AI agent pipeline using compose()
  const agent = compose<string, TaskAnalysis>([
    withCircuitBreaker({
      failureThreshold: 5,
      openDuration: 60000,
      halfOpenMaxAttempts: 2,
      onOpen: () => console.log("  🔴 Circuit breaker opened"),
      onClose: () => console.log("  🟢 Circuit breaker closed"),
      onHalfOpen: () => console.log("  🟡 Circuit breaker half-open"),
    }),
    withFallback({
      fallback: () => ({
        category: "general" as const,
        complexity: "medium" as const,
        estimatedTime: 30,
        steps: [
          "Analyze the task requirements",
          "Break down into smaller steps",
          "Execute each step methodically",
          "Review and verify results",
        ],
        confidence: 0.5,
      }),
    }),
    withTimeout({
      duration: 15000,
      message: "Agent analysis timed out",
    }),
    withRetry({
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 1000,
      maxDelay: 5000,
    }),
    withCache({
      ttl: 10 * 60 * 1000, // 10 minutes cache
      keyFn: (task) => task,
    }),
  ]);

  // Define the AI agent operation
  const analyzeTask = async (task: string): Promise<TaskAnalysis> => {
    console.log(`  🔍 Analyzing task: "${task}"`);
    const { object } = await generateObject({
      model: openai("gpt-4-turbo"),
      schema: TaskAnalysisSchema,
      prompt: `Analyze this task: "${task}"`,
      maxRetries: 0,
    });
    return object;
  };

  // Test the agent with various tasks
  const tasks = [
    "Build a REST API for a todo application with authentication",
    "Write a blog post about climate change",
    "Analyze sales data and identify trends",
  ];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n📝 Task ${i + 1}: ${task}\n`);

    try {
      const startTime = Date.now();
      const analysis = await agent(analyzeTask, task);
      const duration = Date.now() - startTime;

      // Display results
      console.log(`\n  📋 Analysis Results:`);
      console.log(`     Category: ${analysis.category}`);
      console.log(`     Complexity: ${analysis.complexity}`);
      console.log(`     Estimated Time: ${analysis.estimatedTime} minutes`);
      console.log(`     Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
      console.log(`     Steps:`);
      analysis.steps.forEach((step, idx) => {
        console.log(`       ${idx + 1}. ${step}`);
      });
      console.log(`\n  ⏱️  Duration: ${duration}ms`);
    } catch (error) {
      console.error(
        `\n  ❌ Failed to analyze task: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Small delay between tasks
    if (i < tasks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Test cache by repeating first task
  console.log(`\n${"=".repeat(60)}`);
  console.log(`\n🔄 Repeating first task (should use cache):`);
  console.log(`📝 Task: ${tasks[0]}\n`);

  const startTime = Date.now();
  const cachedAnalysis = await agent(analyzeTask, tasks[0]);
  const duration = Date.now() - startTime;

  console.log(`  📊 Confidence: ${(cachedAnalysis.confidence * 100).toFixed(0)}%`);
  console.log(`  ⏱️  Duration: ${duration}ms`);
  console.log("  ⚡ (Retrieved from cache - much faster!)");

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n✨ AI Agent example completed successfully!");
}

// Run the example
main().catch(console.error);
