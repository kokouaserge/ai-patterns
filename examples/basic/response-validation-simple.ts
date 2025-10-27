/**
 * Simple Response Validation Example
 *
 * This example demonstrates how to validate AI responses against
 * business rules and quality criteria.
 */

import { validateResponse } from "../../src/validation/response-validation";

// Simulate AI API that generates product descriptions
interface ProductResponse {
  name: string;
  description: string;
  price: number;
  category: string;
}

async function generateProductDescription(prompt: string): Promise<ProductResponse> {
  // In a real app, this would call an AI API (OpenAI, Anthropic, etc.)
  // For demo purposes, we'll simulate different responses

  const random = Math.random();

  if (random < 0.3) {
    // Sometimes returns invalid data
    return {
      name: "Product",
      description: "Short", // Too short!
      price: -10, // Invalid price!
      category: "Electronics",
    };
  } else if (random < 0.6) {
    // Sometimes returns edge case data
    return {
      name: "Free Product",
      description: "This is a free product with a longer description",
      price: 100, // Says "free" but has a price!
      category: "Electronics",
    };
  } else {
    // Sometimes returns valid data
    return {
      name: "Wireless Headphones",
      description: "Premium wireless headphones with active noise cancellation and 30-hour battery life",
      price: 299.99,
      category: "Electronics",
    };
  }
}

async function main() {
  console.log("=== Response Validation Simple Example ===\n");

  let attemptCount = 0;

  const result = await validateResponse({
    execute: async () => {
      attemptCount++;
      console.log(`\n[Attempt ${attemptCount}] Generating product description...`);
      const response = await generateProductDescription(
        "Generate a product description for wireless headphones"
      );
      console.log(`Generated:`, JSON.stringify(response, null, 2));
      return response;
    },
    validators: [
      {
        name: "price-range",
        priority: 10, // High priority - check this first
        validate: (response) => response.price >= 0 && response.price < 10000,
        errorMessage: "Price must be between $0 and $10,000",
      },
      {
        name: "description-length",
        priority: 5,
        validate: (response) => response.description.length >= 50,
        errorMessage: "Description must be at least 50 characters",
      },
      {
        name: "business-rules",
        priority: 8,
        validate: (response) => {
          // If product name contains "free", price must be 0
          if (response.name.toLowerCase().includes("free")) {
            return response.price === 0;
          }
          return true;
        },
        errorMessage: 'Products labeled "free" must have price = $0',
      },
      {
        name: "category-valid",
        priority: 3,
        validate: (response) => {
          const validCategories = ["Electronics", "Clothing", "Home", "Books", "Sports"];
          return validCategories.includes(response.category);
        },
        errorMessage: "Category must be one of: Electronics, Clothing, Home, Books, Sports",
      },
    ],
    maxRetries: 3,
    retryDelayMs: 500,
    onValidationFailed: (validator, attempt, response) => {
      console.log(`\n❌ Validation failed: ${validator.name}`);
      console.log(`   Message: ${validator.errorMessage}`);
      console.log(`   Attempt: ${attempt}`);
    },
    onValidatorPassed: (validator) => {
      console.log(`✅ ${validator.name} passed`);
    },
    onValidationSuccess: (response, validationResult) => {
      console.log(`\n🎉 All validations passed!`);
      console.log(`   Validators passed: ${validationResult.passedCount}/${validationResult.totalCount}`);
    },
    onAllRetriesFailed: async (failures) => {
      console.log(`\n⚠️  All retries exhausted. Using fallback response.`);
      console.log(`   Total failures: ${failures.length}`);

      // Return a safe default response
      return {
        name: "Product",
        description: "Please contact us for more information about this product. Our team will be happy to provide detailed specifications and pricing.",
        price: 0,
        category: "Electronics",
      };
    },
  });

  console.log("\n=== Final Result ===");
  console.log(`Valid: ${result.validation.valid}`);
  console.log(`Attempts: ${result.attempts}`);
  console.log(`Is Fallback: ${result.isFallback}`);
  console.log(`\nProduct:`);
  console.log(`  Name: ${result.value.name}`);
  console.log(`  Description: ${result.value.description}`);
  console.log(`  Price: $${result.value.price}`);
  console.log(`  Category: ${result.value.category}`);

  if (result.validation.failures.length > 0) {
    console.log(`\n⚠️  Note: This response came from fallback due to validation failures:`);
    result.validation.failures.forEach((failure) => {
      console.log(`  - ${failure.validatorName}: ${failure.errorMessage}`);
    });
  }
}

main().catch(console.error);
