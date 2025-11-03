/**
 * A/B Testing Pattern
 *
 * Allows testing multiple variants simultaneously and measuring their performance
 * to continuously optimize AI applications.
 *
 * @example
 * ```typescript
 * const result = await abTest({
 *   variants: [
 *     {
 *       name: 'Simple',
 *       weight: 0.33,
 *       execute: async () => generateText({ prompt: 'Explain quantum computing' })
 *     },
 *     {
 *       name: 'With Context',
 *       weight: 0.33,
 *       execute: async () => generateText({
 *         prompt: 'Explain quantum computing to a software developer'
 *       })
 *     }
 *   ],
 *   userId: 'user-123',
 *   onVariantSelected: (variant, result) => {
 *     analytics.track('variant_selected', { variant: variant.name });
 *   }
 * });
 * ```
 */

import type {
  ABTestConfig,
  ABTestResult,
  ABTestVariant,
} from "../types/ab-test";
import { VariantAssignmentStrategy } from "../types/ab-test";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import { GlobalStorage, StorageNamespace } from "../common/storage";

/**
 * Simple in-memory storage for sticky assignments using GlobalStorage
 */
class InMemoryAssignmentStorage {
  private storage: GlobalStorage;
  private readonly namespace = StorageNamespace.AB_TEST;

  constructor() {
    this.storage = GlobalStorage.getInstance();
  }

  async get(userId: string, experimentId: string): Promise<string | null> {
    const key = `${experimentId}:${userId}`;
    const value = await this.storage.get<string>(this.namespace, key);
    return value ?? null;
  }

  async set(userId: string, experimentId: string, variantName: string): Promise<void> {
    const key = `${experimentId}:${userId}`;
    await this.storage.set(this.namespace, key, variantName);
  }
}

/**
 * Default in-memory storage instance
 */
const defaultStorage = new InMemoryAssignmentStorage();

/**
 * Hash function for consistent variant assignment
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Select a variant based on weights
 */
function selectVariantByWeight<TResult>(
  variants: ABTestVariant<TResult>[],
  random: number = Math.random()
): ABTestVariant<TResult> {
  // Normalize weights to sum to 1.0
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const normalizedVariants = variants.map((v) => ({
    ...v,
    weight: v.weight / totalWeight,
  }));

  let cumulative = 0;
  for (const variant of normalizedVariants) {
    cumulative += variant.weight;
    if (random <= cumulative) {
      return variant;
    }
  }

  // Fallback to last variant (should not happen with proper weights)
  return variants[variants.length - 1];
}

/**
 * Select a variant for a specific user (sticky assignment)
 */
function selectVariantForUser<TResult>(
  variants: ABTestVariant<TResult>[],
  userId: string,
  experimentId: string
): ABTestVariant<TResult> {
  const key = `${experimentId}:${userId}`;
  const hash = hashCode(key);
  const random = (hash % 10000) / 10000; // Normalize to 0-1
  return selectVariantByWeight(variants, random);
}

/**
 * Execute an A/B test with the given configuration
 */
export async function abTest<TResult = any>(
  config: ABTestConfig<TResult>
): Promise<ABTestResult<TResult>> {
  const {
    variants,
    userId,
    experimentId = "default",
    strategy = VariantAssignmentStrategy.WEIGHTED,
    storage = defaultStorage,
    onVariantSelected,
    onSuccess,
    onError,
    logger = defaultLogger,
  } = config;

  // Validate variants
  if (!variants || variants.length === 0) {
    throw new PatternError(
      "At least one variant is required for A/B testing",
      ErrorCode.NO_VARIANTS
    );
  }

  // Validate weights
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    logger.warn(
      `Variant weights sum to ${totalWeight}, expected 1.0. Weights will be normalized.`
    );
  }

  // Select variant based on strategy
  let selectedVariant: ABTestVariant<TResult>;

  if (userId && strategy === VariantAssignmentStrategy.STICKY) {
    // Check for existing sticky assignment
    const assignedVariantName = await storage.get(userId, experimentId);
    if (assignedVariantName) {
      const found = variants.find((v) => v.name === assignedVariantName);
      if (found) {
        selectedVariant = found;
        logger.debug(
          `Using sticky assignment: variant "${selectedVariant.name}" for user ${userId}`
        );
      } else {
        // Variant no longer exists, select new one
        selectedVariant = selectVariantForUser(variants, userId, experimentId);
        await storage.set(userId, experimentId, selectedVariant.name);
        logger.debug(
          `Sticky variant not found, selected new variant "${selectedVariant.name}" for user ${userId}`
        );
      }
    } else {
      // No existing assignment
      selectedVariant = selectVariantForUser(variants, userId, experimentId);
      await storage.set(userId, experimentId, selectedVariant.name);
      logger.debug(
        `New sticky assignment: variant "${selectedVariant.name}" for user ${userId}`
      );
    }
  } else if (userId && strategy === VariantAssignmentStrategy.WEIGHTED) {
    // Weighted selection with user consistency
    selectedVariant = selectVariantForUser(variants, userId, experimentId);
    logger.debug(
      `Weighted selection: variant "${selectedVariant.name}" for user ${userId}`
    );
  } else {
    // Random selection
    selectedVariant = selectVariantByWeight(variants);
    logger.debug(`Random selection: variant "${selectedVariant.name}"`);
  }

  const timestamp = Date.now();

  try {
    // Execute the selected variant
    const result = await selectedVariant.execute();

    // Call onVariantSelected callback
    if (onVariantSelected) {
      await onVariantSelected(selectedVariant, result);
    }

    // Call onSuccess callback
    if (onSuccess) {
      await onSuccess(selectedVariant, result);
    }

    logger.info(`A/B test completed successfully with variant "${selectedVariant.name}"`);

    return {
      variant: selectedVariant,
      value: result,
      timestamp,
      userId,
      experimentId,
    };
  } catch (error) {
    const variantError = error instanceof Error ? error : new Error(String(error));

    logger.error(`A/B test failed with variant "${selectedVariant.name}"`, {
      error: variantError.message,
    });

    // Call onError callback
    if (onError) {
      await onError(selectedVariant, variantError);
    }

    // Wrap in PatternError for consistency
    throw new PatternError(
      `Variant "${selectedVariant.name}" execution failed: ${variantError.message}`,
      ErrorCode.VARIANT_EXECUTION_FAILED,
      variantError,
      { variantName: selectedVariant.name, experimentId, userId, strategy }
    );
  }
}

/**
 * Export the in-memory storage for testing purposes
 */
export { InMemoryAssignmentStorage };
