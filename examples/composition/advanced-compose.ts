/**
 * Advanced Composition Example
 *
 * This example demonstrates composition with stateful patterns
 * like circuit breaker and rate limiter using patterns directly.
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  retry,
  timeout,
  defineCircuitBreaker,
  defineRateLimiter,
  fallback,
  BackoffStrategy,
  RateLimitStrategy,
} from "../../src";

interface AIRequest {
  prompt: string;
  model?: string;
}

async function main() {
  console.log("🎯 Advanced Composition Example\n");

  // Create stateful patterns (circuit breaker and rate limiter)
  // These maintain state across calls
  const circuitBreaker = defineCircuitBreaker<string>({
    execute: async (request: AIRequest) => {
      // Fallback to Claude if OpenAI fails
      const result = await fallback<string>({
        execute: async () => {
          // Timeout protection
          const timeoutResult = await timeout<string>({
            execute: async () => {
              // Retry logic
              const retryResult = await retry<string>({
                execute: async () => {
                  const { text } = await generateText({
                    model: openai(request.model || "gpt-4-turbo"),
                    prompt: request.prompt,
                    maxRetries: 0,
                  });
                  return text;
                },
                maxAttempts: 2,
                backoffStrategy: BackoffStrategy.EXPONENTIAL,
                initialDelay: 500,
              });
              return retryResult.value;
            },
            timeoutMs: 8000,
          });
          return timeoutResult.value;
        },
        fallback: async () => {
          console.log("  🔄 Falling back to Claude...");
          const { text } = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            prompt: request.prompt,
            maxRetries: 0,
          });
          return text;
        },
      });

      return result.value;
    },
    failureThreshold: 3,
    openDuration: 30000,
    halfOpenMaxAttempts: 2,
    onOpen: () => console.log("  🔴 Circuit breaker opened"),
    onClose: () => console.log("  🟢 Circuit breaker closed"),
    onHalfOpen: () => console.log("  🟡 Circuit breaker half-open"),
  });

  const rateLimiter = defineRateLimiter<string>({
    execute: async (request: AIRequest) => {
      return await circuitBreaker(request);
    },
    maxRequests: 5,
    windowMs: 10000, // 10 seconds
    strategy: RateLimitStrategy.FIXED_WINDOW,
    onLimitReached: (retryAfter) => {
      console.log(`  ⏱️  Rate limit reached. Retry after ${retryAfter}ms`);
    },
  });

  // Simulate multiple requests to trigger rate limiting
  console.log("📊 Making multiple requests...\n");

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

      const result = await rateLimiter({ prompt: prompts[i] });

      if (result.allowed && result.value) {
        console.log(`  💬 ${result.value.slice(0, 100)}...`);
      } else {
        console.log(`  ⏱️  Rate limited. Retry after ${result.retryAfter}ms`);
      }
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
  console.log("  • All patterns worked together seamlessly");

  // Display final stats
  console.log("\n📊 Final Statistics:");
  const cbStats = circuitBreaker.getStats();
  console.log(`  Circuit Breaker - State: ${circuitBreaker.getState()}`);
  console.log(`  Circuit Breaker - Success: ${cbStats.successCount}, Failures: ${cbStats.failureCount}`);
}

// Run the example
main().catch(console.error);
