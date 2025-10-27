/**
 * Simple Prompt Versioning Example
 *
 * This example demonstrates how to manage prompt versions with
 * rollback capabilities and gradual rollout.
 */

import { versionedPrompt } from "../../src/experimentation/prompt-versioning";

// Simulate AI text generation
async function generateText(prompt: string): Promise<string> {
  // In a real app, this would call an AI API (OpenAI, Anthropic, etc.)
  return `AI Response: ${prompt.substring(0, 50)}...`;
}

async function main() {
  console.log("=== Prompt Versioning Simple Example ===\n");

  const productData = "iPhone 15 Pro - Advanced camera system, A17 Pro chip, titanium design";

  // Test different prompt versions with gradual rollout
  const result = await versionedPrompt({
    promptId: "product-summary",
    versions: {
      "v1.0": {
        prompt: "Summarize this product in 2 sentences",
        active: false,
        performance: {
          satisfaction: 0.75,
          avgTokens: 50,
          usageCount: 1000,
        },
      },
      "v2.0": {
        prompt: "Create an engaging 2-sentence product summary",
        active: false,
        performance: {
          satisfaction: 0.82,
          avgTokens: 65,
          usageCount: 500,
        },
      },
      "v3.0": {
        prompt: "Write a compelling summary highlighting key benefits (2 sentences max)",
        active: true,
        rolloutPercentage: 50,
        performance: {
          satisfaction: 0.88,
          avgTokens: 70,
          usageCount: 100,
        },
      },
    },
    execute: async (prompt, version) => {
      console.log(`\nExecuting version: ${version}`);
      console.log(`Prompt: "${prompt}"\n`);

      const fullPrompt = `${prompt}\n\nProduct: ${productData}`;
      const response = await generateText(fullPrompt);

      return {
        text: response,
        metadata: {
          version,
          productId: "iphone-15-pro",
        },
      };
    },
    onVersionUsed: (version, result) => {
      console.log(`Version ${version} used successfully`);
      console.log(`Response time: ${result.responseTime}ms`);
      console.log(`Result: ${JSON.stringify(result.value, null, 2)}\n`);
    },
    autoRollback: {
      enabled: true,
      conditions: [
        {
          metric: "satisfaction",
          threshold: 0.7,
          window: "1h",
          operator: "lt",
        },
        {
          metric: "errorRate",
          threshold: 0.05,
          window: "30m",
          operator: "gt",
        },
      ],
    },
  });

  console.log("=== Execution Summary ===");
  console.log(`Version used: ${result.version}`);
  console.log(`Response time: ${result.responseTime}ms`);
  console.log(`Timestamp: ${new Date(result.timestamp).toISOString()}`);
  console.log(`Result: ${JSON.stringify(result.value, null, 2)}`);
}

main().catch(console.error);
