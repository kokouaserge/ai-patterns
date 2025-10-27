/**
 * Advanced Response Validation with Composition
 *
 * This example demonstrates combining response validation with other patterns
 * like retry, timeout, and cost tracking for production-ready AI applications.
 */

import { compose } from "../../src/composition/compose";
import { withTimeout, withRetry } from "../../src/composition/middleware";
import { validateResponse } from "../../src/validation/response-validation";

// Simulate AI API responses
interface ContentGenerationResponse {
  title: string;
  body: string;
  tags: string[];
  sentiment: "positive" | "negative" | "neutral";
  wordCount: number;
}

// Simulate content moderation API
interface ModerationResult {
  flagged: boolean;
  categories: string[];
  score: number;
}

async function moderateContent(text: string): Promise<ModerationResult> {
  // In production, this would call OpenAI Moderation API or similar
  const hasProfanity = /\b(bad|terrible|awful)\b/i.test(text);

  return {
    flagged: hasProfanity,
    categories: hasProfanity ? ["profanity"] : [],
    score: hasProfanity ? 0.8 : 0.1,
  };
}

// Simulate AI text generation
async function generateContent(prompt: string): Promise<ContentGenerationResponse> {
  // In production, this would call OpenAI, Anthropic, etc.
  const random = Math.random();

  if (random < 0.2) {
    // Sometimes returns short content
    return {
      title: "Title",
      body: "Short body",
      tags: ["tag1"],
      sentiment: "neutral",
      wordCount: 2,
    };
  } else if (random < 0.4) {
    // Sometimes returns inappropriate content
    return {
      title: "This is a terrible product",
      body: "This product is really bad and awful. I hate it so much.",
      tags: ["negative", "review"],
      sentiment: "negative",
      wordCount: 12,
    };
  } else if (random < 0.6) {
    // Sometimes returns content with too many tags
    return {
      title: "Great Product Review",
      body: "This is an amazing product with lots of great features. Highly recommended for everyone!",
      tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
      sentiment: "positive",
      wordCount: 14,
    };
  } else {
    // Returns valid content
    return {
      title: "Excellent Wireless Headphones",
      body: "These wireless headphones offer exceptional sound quality and comfort. The active noise cancellation works brilliantly in busy environments. Battery life easily lasts a full day of use. Highly recommended for commuters and travelers.",
      tags: ["electronics", "audio", "review"],
      sentiment: "positive",
      wordCount: 35,
    };
  }
}

async function main() {
  console.log("=== Response Validation with Composition ===\n");

  // Create a resilient content generation function with timeout and retry
  const resilientGenerate = compose(
    async (prompt: string) => await generateContent(prompt),
    withTimeout({ duration: 5000 }),
    withRetry({
      maxAttempts: 2,
      delayMs: 1000,
      backoff: "exponential",
    })
  );

  const analytics = {
    totalAttempts: 0,
    validationFailures: {} as Record<string, number>,
    successfulGenerations: 0,
  };

  try {
    const result = await validateResponse({
      execute: async () => {
        analytics.totalAttempts++;
        console.log(`\n[Attempt ${analytics.totalAttempts}] Generating content...`);

        const response = await resilientGenerate(
          "Write a positive product review for wireless headphones"
        );

        console.log(`Generated content:`);
        console.log(`  Title: ${response.title}`);
        console.log(`  Body: ${response.body.substring(0, 60)}...`);
        console.log(`  Tags: ${response.tags.join(", ")}`);
        console.log(`  Sentiment: ${response.sentiment}`);
        console.log(`  Word count: ${response.wordCount}`);

        return response;
      },
      validators: [
        {
          name: "word-count-minimum",
          priority: 10,
          validate: (response) => response.wordCount >= 20,
          errorMessage: "Content must be at least 20 words",
        },
        {
          name: "word-count-maximum",
          priority: 10,
          validate: (response) => response.wordCount <= 500,
          errorMessage: "Content must be no more than 500 words",
        },
        {
          name: "tags-count",
          priority: 8,
          validate: (response) => response.tags.length >= 1 && response.tags.length <= 5,
          errorMessage: "Must have between 1 and 5 tags",
        },
        {
          name: "sentiment-check",
          priority: 7,
          validate: (response) => response.sentiment === "positive" || response.sentiment === "neutral",
          errorMessage: "Content must have positive or neutral sentiment",
        },
        {
          name: "title-length",
          priority: 5,
          validate: (response) => response.title.length >= 10 && response.title.length <= 100,
          errorMessage: "Title must be between 10 and 100 characters",
        },
        {
          name: "content-moderation",
          priority: 9,
          validate: async (response) => {
            // Check both title and body for inappropriate content
            const titleCheck = await moderateContent(response.title);
            const bodyCheck = await moderateContent(response.body);

            return !titleCheck.flagged && !bodyCheck.flagged;
          },
          errorMessage: "Content contains inappropriate language",
          stopOnFailure: true, // Stop validation if content is inappropriate
        },
        {
          name: "body-length",
          priority: 6,
          validate: (response) => response.body.length >= 100,
          errorMessage: "Body must be at least 100 characters",
        },
      ],
      maxRetries: 5,
      retryDelayMs: 1000,
      parallel: false, // Run validators sequentially for better debugging
      onValidationFailed: (validator, attempt, response) => {
        console.log(`  ❌ ${validator.name}: ${validator.errorMessage}`);
        analytics.validationFailures[validator.name] =
          (analytics.validationFailures[validator.name] || 0) + 1;
      },
      onValidatorPassed: (validator) => {
        console.log(`  ✅ ${validator.name} passed`);
      },
      onValidationSuccess: (response, validationResult) => {
        analytics.successfulGenerations++;
        console.log(`\n🎉 All validations passed!`);
        console.log(`  Validators: ${validationResult.passedCount}/${validationResult.totalCount}`);
      },
      onAllRetriesFailed: async (failures) => {
        console.log(`\n⚠️  All validation attempts failed. Using curated template.`);

        // In production, you might fetch a pre-approved template from a database
        return {
          title: "Premium Wireless Headphones Review",
          body: "These headphones deliver outstanding audio quality with deep bass and crystal-clear highs. The comfortable over-ear design makes them perfect for long listening sessions. Active noise cancellation effectively blocks out ambient noise. The battery lasts up to 30 hours on a single charge. Bluetooth connectivity is stable and easy to set up. Overall, an excellent choice for music lovers and professionals.",
          tags: ["audio", "headphones", "review"],
          sentiment: "positive" as const,
          wordCount: 65,
        };
      },
    });

    console.log("\n=== Final Result ===");
    console.log(`Status: ${result.validation.valid ? "✅ Valid" : "⚠️  Using Fallback"}`);
    console.log(`Total attempts: ${analytics.totalAttempts}`);
    console.log(`Is fallback: ${result.isFallback}`);
    console.log(`\n📝 Generated Content:`);
    console.log(`Title: ${result.value.title}`);
    console.log(`\nBody:\n${result.value.body}`);
    console.log(`\nTags: ${result.value.tags.join(", ")}`);
    console.log(`Sentiment: ${result.value.sentiment}`);
    console.log(`Word count: ${result.value.wordCount}`);

    if (Object.keys(analytics.validationFailures).length > 0) {
      console.log(`\n📊 Validation Failures Breakdown:`);
      Object.entries(analytics.validationFailures)
        .sort(([, a], [, b]) => b - a)
        .forEach(([validator, count]) => {
          console.log(`  ${validator}: ${count} time(s)`);
        });
    }

    console.log(`\n📈 Analytics:`);
    console.log(`  Total generation attempts: ${analytics.totalAttempts}`);
    console.log(`  Successful validations: ${analytics.successfulGenerations}`);
    console.log(
      `  Success rate: ${((analytics.successfulGenerations / analytics.totalAttempts) * 100).toFixed(1)}%`
    );
  } catch (error) {
    console.error("\n❌ Fatal error:", error instanceof Error ? error.message : error);

    if (error instanceof Error && "context" in error) {
      console.error("Context:", (error as any).context);
    }
  }
}

main().catch(console.error);
