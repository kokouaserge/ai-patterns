import { describe, it, expect, vi, beforeEach } from "vitest";
import { abTest, InMemoryAssignmentStorage } from "./ab-test";
import type { ABTestVariant } from "../types/ab-test";
import { VariantAssignmentStrategy } from "../types/ab-test";
import { PatternError, ErrorCode } from "../types/errors";
import { GlobalStorage } from "../common/storage";

describe("A/B Testing Pattern", () => {
  beforeEach(async () => {
    await GlobalStorage.clearAll();
  });
  describe("abTest", () => {
    it("should select and execute a variant", async () => {
      const variants: ABTestVariant<string>[] = [
        {
          name: "variant-a",
          weight: 0.5,
          execute: async () => "result-a",
        },
        {
          name: "variant-b",
          weight: 0.5,
          execute: async () => "result-b",
        },
      ];

      const result = await abTest({ variants });

      expect(result.value).toMatch(/^result-(a|b)$/);
      expect(result.variant.name).toMatch(/^variant-(a|b)$/);
      expect(result.timestamp).toBeDefined();
    });

    it("should normalize weights that don't sum to 1.0", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 2, execute: async () => "a" },
        { name: "b", weight: 3, execute: async () => "b" },
      ];

      const result = await abTest({ variants });
      expect(result.value).toMatch(/^(a|b)$/);
    });

    it("should use consistent variant for same user", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 0.5, execute: async () => "a" },
        { name: "b", weight: 0.5, execute: async () => "b" },
      ];

      const userId = "user-123";
      const result1 = await abTest({ variants, userId });
      const result2 = await abTest({ variants, userId });

      expect(result1.variant.name).toBe(result2.variant.name);
    });

    it("should call onVariantSelected callback", async () => {
      const onVariantSelected = vi.fn();
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "result" },
      ];

      await abTest({ variants, onVariantSelected });

      expect(onVariantSelected).toHaveBeenCalledWith(
        expect.objectContaining({ name: "a" }),
        "result"
      );
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "result" },
      ];

      await abTest({ variants, onSuccess });

      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: "a" }), "result");
    });

    it("should call onError callback on failure", async () => {
      const onError = vi.fn();
      const error = new Error("Test error");
      const variants: ABTestVariant<string>[] = [
        {
          name: "a",
          weight: 1.0,
          execute: async () => {
            throw error;
          },
        },
      ];

      await expect(abTest({ variants, onError })).rejects.toThrow(PatternError);

      try {
        await abTest({ variants, onError });
      } catch (err) {
        expect(err).toBeInstanceOf(PatternError);
        expect((err as PatternError).code).toBe(ErrorCode.VARIANT_EXECUTION_FAILED);
        expect((err as PatternError).cause).toBe(error);
      }

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: "a" }), error);
    });

    it("should include userId and experimentId in result", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "result" },
      ];

      const result = await abTest({
        variants,
        userId: "user-123",
        experimentId: "exp-456",
      });

      expect(result.userId).toBe("user-123");
      expect(result.experimentId).toBe("exp-456");
    });

    it("should throw PatternError if no variants provided", async () => {
      await expect(abTest({ variants: [] })).rejects.toThrow(PatternError);

      try {
        await abTest({ variants: [] });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.NO_VARIANTS);
      }
    });
  });

  describe("abTest with strategies", () => {
    let storage: InMemoryAssignmentStorage;

    beforeEach(() => {
      storage = new InMemoryAssignmentStorage();
    });

    it("should use sticky assignments", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 0.5, execute: async () => "a" },
        { name: "b", weight: 0.5, execute: async () => "b" },
      ];

      const userId = "user-123";
      const experimentId = "exp-456";

      const result1 = await abTest({
        variants,
        userId,
        experimentId,
        strategy: VariantAssignmentStrategy.STICKY,
        storage,
      });

      const result2 = await abTest({
        variants,
        userId,
        experimentId,
        strategy: VariantAssignmentStrategy.STICKY,
        storage,
      });

      expect(result1.variant.name).toBe(result2.variant.name);

      // Verify it's stored
      const storedVariant = await storage.get(userId, experimentId);
      expect(storedVariant).toBe(result1.variant.name);
    });

    it("should select new variant if sticky variant no longer exists", async () => {
      const userId = "user-123";
      const experimentId = "exp-456";

      // Set a sticky assignment to a variant that won't exist
      await storage.set(userId, experimentId, "old-variant");

      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "a" },
      ];

      const result = await abTest({
        variants,
        userId,
        experimentId,
        strategy: VariantAssignmentStrategy.STICKY,
        storage,
      });

      expect(result.variant.name).toBe("a");

      // Verify new assignment is stored
      const storedVariant = await storage.get(userId, experimentId);
      expect(storedVariant).toBe("a");
    });

    it("should support weighted strategy", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 0.5, execute: async () => "a" },
        { name: "b", weight: 0.5, execute: async () => "b" },
      ];

      const userId = "user-123";

      const result1 = await abTest({
        variants,
        userId,
        strategy: VariantAssignmentStrategy.WEIGHTED,
      });

      const result2 = await abTest({
        variants,
        userId,
        strategy: VariantAssignmentStrategy.WEIGHTED,
      });

      // Should be consistent for same user even without sticky storage
      expect(result1.variant.name).toBe(result2.variant.name);
    });

    it("should support random strategy", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "a" },
      ];

      const result = await abTest({
        variants,
        strategy: VariantAssignmentStrategy.RANDOM,
      });

      expect(result.variant.name).toBe("a");
    });

    it("should respect variant weights", async () => {
      const variants: ABTestVariant<string>[] = [
        { name: "a", weight: 1.0, execute: async () => "a" },
        { name: "b", weight: 0.0, execute: async () => "b" },
      ];

      // Run multiple times to ensure "b" is never selected
      for (let i = 0; i < 10; i++) {
        const result = await abTest({ variants });
        expect(result.variant.name).toBe("a");
      }
    });
  });

  describe("InMemoryAssignmentStorage", () => {
    let storage: InMemoryAssignmentStorage;

    beforeEach(() => {
      storage = new InMemoryAssignmentStorage();
    });

    it("should store and retrieve assignments", async () => {
      await storage.set("user-123", "exp-456", "variant-a");
      const result = await storage.get("user-123", "exp-456");
      expect(result).toBe("variant-a");
    });

    it("should return null for non-existent assignments", async () => {
      const result = await storage.get("user-123", "exp-456");
      expect(result).toBeNull();
    });

    it("should handle multiple users and experiments", async () => {
      await storage.set("user-1", "exp-1", "variant-a");
      await storage.set("user-1", "exp-2", "variant-b");
      await storage.set("user-2", "exp-1", "variant-c");

      expect(await storage.get("user-1", "exp-1")).toBe("variant-a");
      expect(await storage.get("user-1", "exp-2")).toBe("variant-b");
      expect(await storage.get("user-2", "exp-1")).toBe("variant-c");
    });
  });
});
