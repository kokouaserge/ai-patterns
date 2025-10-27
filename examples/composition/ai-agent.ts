/**
 * AI Agent with Composition
 *
 * This example demonstrates a production-ready AI agent that uses
 * composition to combine multiple resilience patterns directly.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  retry,
  timeout,
  defineCircuitBreaker,
  memoize,
  fallback,
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

interface AgentInput {
  task: string;
  context?: Record<string, any>;
}

async function main() {
  console.log("🤖 AI Agent with Composition\n");

  // Create a memoized AI function (caching layer)
  const cachedAgent = memoize<[AgentInput], TaskAnalysis>({
    execute: async (input: AgentInput) => {
      const { object } = await generateObject({
        model: openai("gpt-4-turbo"),
        schema: TaskAnalysisSchema,
        prompt: `Analyze this task: "${input.task}"\n\nContext: ${JSON.stringify(input.context || {})}`,
        maxRetries: 0,
      });
      return object;
    },
    ttl: 10 * 60 * 1000, // 10 minutes cache
    keyFn: (input) => input.task,
    onCacheHit: () => console.log("  ⚡ Cache hit!"),
  });

  // Create circuit breaker (stateful pattern)
  const circuitBreaker = defineCircuitBreaker<TaskAnalysis>({
    execute: async (input: AgentInput) => {
      return await cachedAgent(input);
    },
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenAttempts: 2,
    onOpen: () => console.log("  🔴 Circuit breaker opened"),
    onClose: () => console.log("  🟢 Circuit breaker closed"),
    onHalfOpen: () => console.log("  🟡 Circuit breaker half-open"),
  });

  // Compose patterns together
  async function agent(input: AgentInput): Promise<TaskAnalysis> {
    console.log("  🔍 Analyzing task...");
    const startTime = Date.now();

    try {
      // Fallback pattern (outermost)
      const result = await fallback<TaskAnalysis>({
        execute: async () => {
          // Timeout pattern
          return await timeout<TaskAnalysis>({
            execute: async () => {
              // Retry pattern
              const retryResult = await retry<TaskAnalysis>({
                execute: async () => {
                  // Circuit breaker + cache (innermost)
                  return await circuitBreaker(input);
                },
                maxAttempts: 3,
                backoffStrategy: BackoffStrategy.EXPONENTIAL,
                initialDelay: 1000,
                maxDelay: 5000,
                shouldRetry: (error, attempt) => {
                  console.log(`  🔄 Retry attempt ${attempt} after error: ${error.message}`);
                  // Don't retry on validation errors
                  return !error.message.includes("validation");
                },
              });
              return retryResult.value;
            },
            timeoutMs: 15000,
            errorMessage: "Agent analysis timed out",
          });
        },
        fallback: async () => {
          console.log("  ⚠️  Using fallback analysis");
          return {
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
          };
        },
        shouldFallback: (error) => {
          // Only fallback for certain errors
          return error.message.includes("timeout") || error.message.includes("circuit");
        },
      });

      const duration = Date.now() - startTime;
      console.log(`  ✅ Analysis complete (${duration}ms)`);
      console.log(`  📊 Confidence: ${(result.value.confidence * 100).toFixed(0)}%`);

      return result.value;
    } catch (error) {
      console.error(`  ❌ Agent error: ${(error as Error).message}`);
      throw error;
    }
  }

  // Test the agent with various tasks
  const tasks = [
    {
      task: "Build a REST API for a todo application with authentication",
      context: { language: "TypeScript", framework: "Express" },
    },
    {
      task: "Write a blog post about climate change",
      context: { audience: "general public", tone: "informative" },
    },
    {
      task: "Analyze sales data and identify trends",
      context: { dataSize: "10000 records", period: "last quarter" },
    },
  ];

  for (const [index, { task, context }] of tasks.entries()) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n📝 Task ${index + 1}: ${task}`);
    console.log(`   Context: ${JSON.stringify(context)}\n`);

    try {
      const analysis = await agent({ task, context });

      // Display results
      console.log(`\n  📋 Analysis Results:`);
      console.log(`     Category: ${analysis.category}`);
      console.log(`     Complexity: ${analysis.complexity}`);
      console.log(`     Estimated Time: ${analysis.estimatedTime} minutes`);
      console.log(`     Steps:`);
      analysis.steps.forEach((step, i) => {
        console.log(`       ${i + 1}. ${step}`);
      });
    } catch (error) {
      console.error(
        `\n  ❌ Failed to analyze task: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Small delay between tasks
    if (index < tasks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Test cache by repeating first task
  console.log(`\n${"=".repeat(60)}`);
  console.log(`\n🔄 Repeating first task (should use cache):`);
  console.log(`📝 Task: ${tasks[0].task}\n`);

  const cachedAnalysis = await agent({ task: tasks[0].task, context: tasks[0].context });

  console.log(`  📊 Confidence: ${(cachedAnalysis.confidence * 100).toFixed(0)}%`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n✨ AI Agent example completed successfully!");
}

// Run the example
main().catch(console.error);
