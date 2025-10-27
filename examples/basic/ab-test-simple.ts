/**
 * Simple A/B Testing Example
 *
 * This example demonstrates how to test multiple prompt variants
 * to determine which performs best.
 */

import { abTest } from "../../src/experimentation/ab-test";

// Simulate AI text generation
async function generateText(prompt: string): Promise<string> {
  // In a real app, this would call an AI API
  return `Generated response for: ${prompt}`;
}

async function main() {
  console.log("=== A/B Testing Simple Example ===\n");

  // Test different prompt variations
  const result = await abTest({
    variants: [
      {
        name: "Simple",
        weight: 0.33,
        execute: async () => {
          const response = await generateText("Explain quantum computing");
          return { text: response, variant: "Simple" };
        },
      },
      {
        name: "With Context",
        weight: 0.33,
        execute: async () => {
          const response = await generateText(
            "Explain quantum computing to a software developer with examples"
          );
          return { text: response, variant: "With Context" };
        },
      },
      {
        name: "Step by Step",
        weight: 0.34,
        execute: async () => {
          const response = await generateText(
            "Explain quantum computing step by step with analogies"
          );
          return { text: response, variant: "Step by Step" };
        },
      },
    ],
    userId: "user-123",
    experimentId: "prompt-optimization-v1",
    onVariantSelected: (variant, result) => {
      console.log(`Selected variant: ${variant.name}`);
      console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);
    },
  });

  console.log("Final result:");
  console.log(`- Variant: ${result.variant.name}`);
  console.log(`- Value: ${JSON.stringify(result.value, null, 2)}`);
  console.log(`- User ID: ${result.userId}`);
  console.log(`- Experiment ID: ${result.experimentId}`);
  console.log(`- Timestamp: ${new Date(result.timestamp).toISOString()}`);
}

main().catch(console.error);
