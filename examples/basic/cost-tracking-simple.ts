/**
 * Simple Cost Tracking Example
 *
 * This example demonstrates how to track and control AI costs in real-time.
 */

import { costTracking } from "../../src/monitoring/cost-tracking";
import { ModelCost } from "../../src/types/cost-tracking";

// Simulate AI text generation with token usage
async function generateText(prompt: string): Promise<{ text: string; tokens: number }> {
  // In a real app, this would call an AI API
  const tokens = prompt.length * 2; // Simulate token count
  return {
    text: `Generated response for: ${prompt}`,
    tokens,
  };
}

async function main() {
  console.log("=== Cost Tracking Simple Example ===\n");

  try {
    const result = await costTracking({
      execute: async () => {
        const response = await generateText(
          "Explain the benefits of TypeScript in modern web development"
        );
        return { value: response.text, tokens: response.tokens };
      },
      costPerToken: ModelCost.GPT4_TURBO, // Predefined pricing
      monthlyBudget: 500,
      dailyLimit: 50,
      tags: {
        feature: "chatbot",
        userId: "user-123",
      },
      onCostCalculated: (cost, tags) => {
        console.log(`Cost calculated: $${cost.toFixed(4)}`);
        console.log(`Tags: ${JSON.stringify(tags, null, 2)}`);
      },
      onBudgetWarning: (spent, limit) => {
        console.log(`\n⚠️ Budget Warning: $${spent.toFixed(2)}/$${limit.toFixed(2)} (80%)`);
      },
    });

    console.log("\nResult:");
    console.log(`- Value: ${result.value}`);
    console.log(`- Cost: $${result.cost.toFixed(4)}`);
    console.log(`- Tokens: ${result.tokens}`);
    console.log(`- Remaining Budget: $${result.remainingBudget?.toFixed(2)}`);
    console.log(`- Tags: ${JSON.stringify(result.tags, null, 2)}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    }
  }
}

main().catch(console.error);
