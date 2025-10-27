/**
 * Basic Composition Example
 *
 * This example demonstrates how to compose multiple patterns together
 * to create a robust, production-ready AI workflow using patterns directly.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  retry,
  timeout,
  fallback,
  memoize,
  BackoffStrategy,
} from "../../src";

interface PromptInput {
  prompt: string;
  userId?: string;
}

async function main() {
  console.log("🎯 Basic Composition Example\n");

  // Create a memoized AI function (caching layer)
  const cachedAI = memoize<[PromptInput], string>({
    execute: async (input: PromptInput) => {
      console.log(`  🤖 Calling OpenAI for: "${input.prompt}"`);
      const { text } = await generateText({
        model: openai("gpt-4-turbo"),
        prompt: input.prompt,
        maxRetries: 0,
      });
      return text;
    },
    ttl: 5 * 60 * 1000, // 5 minutes cache
    keyFn: (input) => input.prompt,
  });

  // Compose patterns together by nesting them
  async function robustAI(input: PromptInput): Promise<string> {
    console.log("🚀 Starting AI request...\n");
    const startTime = Date.now();

    try {
      // Fallback pattern (outermost)
      const result = await fallback<string>({
        execute: async () => {
          // Timeout pattern
          const timeoutResult = await timeout<string>({
            execute: async () => {
              // Retry pattern
              const retryResult = await retry<string>({
                execute: async () => {
                  // Cache pattern (innermost)
                  return await cachedAI(input);
                },
                maxAttempts: 3,
                backoffStrategy: BackoffStrategy.EXPONENTIAL,
                initialDelay: 1000,
                onRetry: (error, attempt) => {
                  console.log(`  🔄 Retry attempt ${attempt} after error: ${error.message}`);
                },
              });
              return retryResult.value;
            },
            timeoutMs: 10000,
          });
          return timeoutResult.value;
        },
        fallback: async () => {
          console.log("  ⚠️  Using fallback response");
          return "I apologize, but I'm having trouble processing your request right now. Please try again later.";
        },
      });

      const duration = Date.now() - startTime;
      console.log(`\n✅ Completed in ${duration}ms`);
      return result.value;
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      throw error;
    }
  }

  // First request - will execute and cache
  console.log("📝 First request:");
  const result1 = await robustAI({ prompt: "What is the capital of France?" });
  console.log(`\n💬 Response: ${result1}\n`);

  // Second request with same prompt - will use cache
  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📝 Second request (same prompt):");
  const result2 = await robustAI({ prompt: "What is the capital of France?" });
  console.log(`\n💬 Response: ${result2}`);
  console.log("  ⚡ (Retrieved from cache)");

  // Third request with different prompt
  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📝 Third request (different prompt):");
  const result3 = await robustAI({
    prompt: "What is the largest planet in our solar system?",
  });
  console.log(`\n💬 Response: ${result3}`);
}

// Run the example
main().catch(console.error);
