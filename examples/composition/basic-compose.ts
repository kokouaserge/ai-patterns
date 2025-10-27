/**
 * Basic Compose Example
 *
 * This example demonstrates how to use compose() with middleware
 * to create a robust, production-ready AI workflow.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  compose,
  withRetry,
  withTimeout,
  withFallback,
  withCache,
  BackoffStrategy,
} from "../../src";

async function main() {
  console.log("🎯 Basic Compose Example\n");

  // Create a robust AI pipeline using compose()
  const robustAI = compose<string, string>([
    withFallback({
      fallback: () => "I apologize, but I'm having trouble processing your request right now. Please try again later.",
    }),
    withTimeout({ duration: 10000 }),
    withRetry({
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 1000,
    }),
    withCache({
      ttl: 5 * 60 * 1000, // 5 minutes cache
      keyFn: (prompt) => prompt,
    }),
  ]);

  // Define the AI operation
  const callAI = async (prompt: string): Promise<string> => {
    console.log(`  🤖 Calling OpenAI for: "${prompt}"`);
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
      maxRetries: 0,
    });
    return text;
  };

  // First request - will execute and cache
  console.log("📝 First request:");
  const startTime1 = Date.now();
  const result1 = await robustAI(callAI, "What is the capital of France?");
  const duration1 = Date.now() - startTime1;
  console.log(`\n💬 Response: ${result1}`);
  console.log(`⏱️  Duration: ${duration1}ms\n`);

  // Second request with same prompt - will use cache
  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📝 Second request (same prompt):");
  const startTime2 = Date.now();
  const result2 = await robustAI(callAI, "What is the capital of France?");
  const duration2 = Date.now() - startTime2;
  console.log(`\n💬 Response: ${result2}`);
  console.log(`⏱️  Duration: ${duration2}ms`);
  console.log("  ⚡ (Retrieved from cache - much faster!)");

  // Third request with different prompt
  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📝 Third request (different prompt):");
  const startTime3 = Date.now();
  const result3 = await robustAI(
    callAI,
    "What is the largest planet in our solar system?"
  );
  const duration3 = Date.now() - startTime3;
  console.log(`\n💬 Response: ${result3}`);
  console.log(`⏱️  Duration: ${duration3}ms`);

  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Example completed!");
  console.log("\nKey features demonstrated:");
  console.log("  • compose() creates reusable pipeline");
  console.log("  • withCache() caches responses");
  console.log("  • withRetry() retries on failures");
  console.log("  • withTimeout() adds time limits");
  console.log("  • withFallback() provides graceful degradation");
}

// Run the example
main().catch(console.error);
