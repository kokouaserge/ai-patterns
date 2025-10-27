/**
 * Combined A/B Testing + Cost Tracking Example
 *
 * This example demonstrates how to combine A/B testing with cost tracking
 * to optimize both performance and ROI.
 */

import { abTest } from "../../src/experimentation/ab-test";
import { costTracking } from "../../src/monitoring/cost-tracking";
import { ModelCost } from "../../src/types/cost-tracking";

// Simulate AI text generation with different models
async function generateWithGPT4(prompt: string): Promise<{ text: string; tokens: number }> {
  const tokens = prompt.length * 3; // Simulate higher token usage
  return {
    text: `[GPT-4] Generated response for: ${prompt}`,
    tokens,
  };
}

async function generateWithGPT35(prompt: string): Promise<{ text: string; tokens: number }> {
  const tokens = prompt.length * 2; // Simulate lower token usage
  return {
    text: `[GPT-3.5] Generated response for: ${prompt}`,
    tokens,
  };
}

async function main() {
  console.log("=== A/B Testing + Cost Tracking Example ===\n");

  const prompt = "Explain the benefits of TypeScript in modern web development";
  const userId = "user-123";

  // Combine A/B testing with cost tracking for data-driven optimization
  const result = await costTracking({
    execute: async () => {
      // A/B test different models
      const testResult = await abTest({
        variants: [
          {
            name: "GPT-4 (expensive)",
            weight: 0.3, // 30% of users
            execute: async () => {
              const response = await generateWithGPT4(prompt);
              return {
                text: response.text,
                tokens: response.tokens,
                model: "gpt-4-turbo",
              };
            },
          },
          {
            name: "GPT-3.5 (cheap)",
            weight: 0.7, // 70% of users
            execute: async () => {
              const response = await generateWithGPT35(prompt);
              return {
                text: response.text,
                tokens: response.tokens,
                model: "gpt-3.5-turbo",
              };
            },
          },
        ],
        userId,
        experimentId: "model-cost-optimization-v1",
        onVariantSelected: (variant, result) => {
          console.log(`\nA/B Test - Selected variant: ${variant.name}`);
          console.log(`Model: ${result.model}`);
        },
      });

      return {
        value: testResult.value,
        tokens: testResult.value.tokens,
      };
    },
    costPerToken: ModelCost.GPT4_TURBO, // Can use different costs based on model
    monthlyBudget: 500,
    dailyLimit: 50,
    tags: {
      feature: "ai-explanation",
      userId,
      experiment: "model-cost-optimization-v1",
    },
    onCostCalculated: (cost, tags) => {
      console.log(`\nCost Tracking - Cost: $${cost.toFixed(4)}`);
      console.log(`Tags: ${JSON.stringify(tags, null, 2)}`);
    },
    onBudgetWarning: (spent, limit) => {
      console.log(`\n⚠️ Budget Warning: $${spent.toFixed(2)}/$${limit.toFixed(2)}`);
    },
  });

  console.log("\n=== Final Result ===");
  console.log(`Text: ${result.value.text}`);
  console.log(`Model: ${result.value.model}`);
  console.log(`Tokens: ${result.tokens}`);
  console.log(`Cost: $${result.cost.toFixed(4)}`);
  console.log(`Remaining Monthly Budget: $${result.remainingBudget?.toFixed(2)}`);

  console.log("\n=== Analysis ===");
  console.log("By combining A/B testing with cost tracking, you can:");
  console.log("1. Test different models to find the best quality/cost ratio");
  console.log("2. Track actual costs per model variant");
  console.log("3. Make data-driven decisions based on cost AND satisfaction");
  console.log("4. Prevent budget overruns while optimizing performance");
}

main().catch(console.error);
