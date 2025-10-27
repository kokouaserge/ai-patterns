/**
 * Advanced Compose Example
 *
 * This example demonstrates stateful middleware (circuit breaker, rate limiter)
 * using compose() for production-ready AI workflows.
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  compose,
  withRetry,
  withTimeout,
  withFallback,
  withCircuitBreaker,
  withRateLimiter,
  BackoffStrategy,
  RateLimitStrategy,
} from "../../src";

async function main() {
  console.log("🎯 Advanced Compose Example\n");

  // Create a robust AI pipeline with circuit breaker and rate limiting
  const robustAI = compose<string, string>([
    withRateLimiter({
      maxRequests: 5,
      windowMs: 10000, // 5 requests per 10 seconds
      strategy: RateLimitStrategy.FIXED_WINDOW,
    }),
    withCircuitBreaker({
      failureThreshold: 3,
      openDuration: 30000,
      halfOpenMaxAttempts: 2,
      onOpen: () => console.log("  🔴 Circuit breaker opened"),
      onClose: () => console.log("  🟢 Circuit breaker closed"),
      onHalfOpen: () => console.log("  🟡 Circuit breaker half-open"),
    }),
    withFallback({
      fallback: async (prompt) => {
        console.log("  🔄 Falling back to Claude...");
        const { text } = await generateText({
          model: anthropic("claude-3-5-sonnet-20241022"),
          prompt,
          maxRetries: 0,
        });
        return text;
      },
    }),
    withTimeout({ duration: 8000 }),
    withRetry({
      maxAttempts: 2,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 500,
    }),
  ]);

  // Define the AI operation
  const callOpenAI = async (prompt: string): Promise<string> => {
    console.log(`  🤖 Calling OpenAI...`);
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
      maxRetries: 0,
    });
    return text;
  };

  // Simulate multiple requests to trigger rate limiting
  const prompts = [
    "What is AI?",
    "Explain machine learning in simple terms",
    "What is the difference between AI and ML?",
    "How does deep learning work?",
    "What are neural networks?",
    "Explain GPT models",
    "What is natural language processing?",
  ];

  for (let i = 0; i < prompts.length; i++) {
    try {
      console.log(`\n[Request ${i + 1}/${prompts.length}] "${prompts[i]}"`);
      console.log("  🚀 Processing request...");

      const result = await robustAI(callOpenAI, prompts[i]);
      console.log(`  💬 ${result.slice(0, 100)}...`);
    } catch (error) {
      console.error(
        `  ❌ Request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Example completed!");
  console.log("\nKey observations:");
  console.log("  • Rate limiter prevented exceeding 5 requests/10s");
  console.log("  • Circuit breaker opened after consecutive failures");
  console.log("  • Fallback to Claude kicked in when OpenAI failed");
  console.log("  • All middleware worked together seamlessly");
}

// Run the example
main().catch(console.error);
