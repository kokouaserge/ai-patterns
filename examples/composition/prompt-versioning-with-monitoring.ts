/**
 * Advanced Prompt Versioning with Composition
 *
 * This example demonstrates how to combine prompt versioning with
 * retry logic, cost tracking, and monitoring for production use.
 */

import { compose } from "../../src/composition/compose";
import { withRetry } from "../../src/composition/middleware";
import { versionedPrompt } from "../../src/experimentation/prompt-versioning";
import { InMemoryPromptVersionStorage } from "../../src/experimentation/prompt-versioning";

// Simulate AI API call
interface AIResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

async function callAI(prompt: string): Promise<AIResponse> {
  // Simulate API call with occasional failures
  if (Math.random() < 0.1) {
    throw new Error("API rate limit exceeded");
  }

  return {
    text: `AI generated response for: ${prompt.substring(0, 40)}...`,
    usage: {
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: 50 + Math.floor(Math.random() * 50),
      totalTokens: 0,
    },
  };
}

async function main() {
  console.log("=== Prompt Versioning with Composition ===\n");

  const storage = new InMemoryPromptVersionStorage();

  // Create a resilient AI call with retry logic
  const resilientAICall = compose(
    async (prompt: string) => {
      return await callAI(prompt);
    },
    withRetry({
      maxAttempts: 3,
      delayMs: 1000,
      backoff: "exponential",
      shouldRetry: (error) => {
        return error instanceof Error && error.message.includes("rate limit");
      },
    })
  );

  // Version 1: Simple product description
  async function executeV1(productData: string) {
    const prompt = `Describe this product briefly:\n\n${productData}`;
    return await resilientAICall(prompt);
  }

  // Version 2: Marketing-focused description
  async function executeV2(productData: string) {
    const prompt = `Create a compelling marketing description for:\n\n${productData}\n\nHighlight key benefits and unique features.`;
    return await resilientAICall(prompt);
  }

  // Version 3: SEO-optimized description
  async function executeV3(productData: string) {
    const prompt = `Write an SEO-optimized product description:\n\n${productData}\n\nInclude relevant keywords naturally and focus on user benefits.`;
    return await resilientAICall(prompt);
  }

  const productData = {
    name: "Wireless Noise-Cancelling Headphones",
    features: ["40-hour battery", "Active noise cancellation", "Hi-Res audio", "Bluetooth 5.3"],
    price: "$299",
  };

  const productText = `${productData.name}\nFeatures: ${productData.features.join(", ")}\nPrice: ${productData.price}`;

  // Analytics tracking
  const metrics = {
    totalExecutions: 0,
    versionUsage: {} as Record<string, number>,
    totalTokens: 0,
    totalCost: 0,
  };

  // Run multiple requests to demonstrate version selection
  console.log("Running 10 requests with prompt versioning...\n");

  for (let i = 0; i < 10; i++) {
    try {
      const result = await versionedPrompt({
        promptId: "product-description",
        versions: {
          "v1.0-simple": {
            prompt: "v1",
            active: false,
            performance: {
              satisfaction: 0.72,
              avgTokens: 45,
              usageCount: 5000,
            },
          },
          "v2.0-marketing": {
            prompt: "v2",
            active: true,
            rolloutPercentage: 30,
            performance: {
              satisfaction: 0.85,
              avgTokens: 65,
              usageCount: 2000,
            },
          },
          "v3.0-seo": {
            prompt: "v3",
            active: true,
            rolloutPercentage: 70,
            performance: {
              satisfaction: 0.88,
              avgTokens: 70,
              usageCount: 500,
            },
          },
        },
        execute: async (version) => {
          let response: AIResponse;

          switch (version) {
            case "v1":
              response = await executeV1(productText);
              break;
            case "v2":
              response = await executeV2(productText);
              break;
            case "v3":
              response = await executeV3(productText);
              break;
            default:
              throw new Error(`Unknown version: ${version}`);
          }

          return response;
        },
        storage,
        onVersionUsed: async (version, result) => {
          metrics.totalExecutions++;
          metrics.versionUsage[version] = (metrics.versionUsage[version] || 0) + 1;

          if (result.value?.usage) {
            metrics.totalTokens += result.value.usage.totalTokens;
            // Approximate cost: $0.01 per 1K tokens
            metrics.totalCost += (result.value.usage.totalTokens / 1000) * 0.01;
          }

          console.log(
            `[${i + 1}/10] Version: ${version} | Tokens: ${result.value?.usage?.totalTokens || 0} | Time: ${result.responseTime}ms`
          );
        },
        autoRollback: {
          enabled: true,
          conditions: [
            {
              metric: "satisfaction",
              threshold: 0.75,
              window: "1h",
              operator: "lt",
            },
            {
              metric: "errorRate",
              threshold: 0.1,
              window: "30m",
              operator: "gt",
            },
          ],
        },
      });

      // Simulate user feedback (random for demo purposes)
      const userRating = 0.7 + Math.random() * 0.3;
      await storage.updateMetrics("product-description", result.version, {
        satisfaction: userRating,
      });
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\n=== Analytics Summary ===");
  console.log(`Total executions: ${metrics.totalExecutions}`);
  console.log(`Total tokens used: ${metrics.totalTokens}`);
  console.log(`Estimated cost: $${metrics.totalCost.toFixed(4)}`);
  console.log("\nVersion usage distribution:");

  Object.entries(metrics.versionUsage)
    .sort(([, a], [, b]) => b - a)
    .forEach(([version, count]) => {
      const percentage = ((count / metrics.totalExecutions) * 100).toFixed(1);
      console.log(`  ${version}: ${count} times (${percentage}%)`);
    });

  // Show current metrics for each version
  console.log("\n=== Version Metrics ===");
  for (const versionName of ["v1.0-simple", "v2.0-marketing", "v3.0-seo"]) {
    const versionMetrics = await storage.getMetrics("product-description", versionName);
    if (versionMetrics) {
      console.log(`\n${versionName}:`);
      console.log(`  Usage count: ${versionMetrics.usageCount || 0}`);
      console.log(`  Satisfaction: ${(versionMetrics.satisfaction || 0).toFixed(2)}`);
      console.log(`  Avg tokens: ${versionMetrics.avgTokens || 0}`);
      console.log(`  Avg response time: ${versionMetrics.avgResponseTime?.toFixed(0) || 0}ms`);
    }
  }

  const activeVersion = await storage.getActiveVersion("product-description");
  console.log(`\nCurrent active version: ${activeVersion}`);
}

main().catch(console.error);
