import { describe, it, expect, vi, beforeEach } from "vitest";
import { costTracking, createCostTracker, InMemoryCostStorage } from "./cost-tracking";
import type { CostTrackingConfig } from "../types/cost-tracking";
import { PatternError, ErrorCode } from "../types/errors";
import { GlobalStorage } from "../common/storage";

describe("Cost Tracking Pattern", () => {
  beforeEach(async () => {
    await GlobalStorage.clearAll();
  });
  describe("costTracking", () => {
    it("should track cost correctly", async () => {
      const result = await costTracking({
        execute: async () => ({ value: "result", tokens: 1000 }),
        costPerToken: 0.00003,
      });

      expect(result.value).toBe("result");
      expect(result.cost).toBeCloseTo(0.03, 5);
      expect(result.tokens).toBe(1000);
      expect(result.timestamp).toBeDefined();
    });

    it("should handle operations without token count", async () => {
      const result = await costTracking({
        execute: async () => ({ value: "result" }),
        costPerToken: 0.00003,
      });

      expect(result.value).toBe("result");
      expect(result.cost).toBe(0);
      expect(result.tokens).toBe(0);
    });

    it("should include tags in result", async () => {
      const tags = { feature: "chatbot", userId: "user-123" };
      const result = await costTracking({
        execute: async () => ({ value: "result", tokens: 1000 }),
        costPerToken: 0.00003,
        tags,
      });

      expect(result.tags).toEqual(tags);
    });

    it("should call onCostCalculated callback", async () => {
      const onCostCalculated = vi.fn();
      const tags = { feature: "test" };

      await costTracking({
        execute: async () => ({ value: "result", tokens: 1000 }),
        costPerToken: 0.00003,
        tags,
        onCostCalculated,
      });

      expect(onCostCalculated).toHaveBeenCalledWith(expect.closeTo(0.03, 5), tags);
    });

    it("should trigger onExpensiveOperation when threshold exceeded", async () => {
      const onExpensiveOperation = vi.fn();
      const tags = { feature: "test" };

      await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        costThresholdWarning: 0.1,
        tags,
        onExpensiveOperation,
      });

      expect(onExpensiveOperation).toHaveBeenCalledWith(0.3, tags);
    });

    it("should not trigger onExpensiveOperation when below threshold", async () => {
      const onExpensiveOperation = vi.fn();

      await costTracking({
        execute: async () => ({ value: "result", tokens: 1000 }),
        costPerToken: 0.00003,
        costThresholdWarning: 0.1,
        onExpensiveOperation,
      });

      expect(onExpensiveOperation).not.toHaveBeenCalled();
    });

    it("should throw error when monthly budget exceeded", async () => {
      const storage = new InMemoryCostStorage();
      const onBudgetExceeded = vi.fn();

      // First call should succeed
      await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        monthlyBudget: 0.5,
        storage,
      });

      // Second call should exceed budget
      await expect(
        costTracking({
          execute: async () => ({ value: "result", tokens: 20000 }),
          costPerToken: 0.00003,
          monthlyBudget: 0.5,
          storage,
          onBudgetExceeded,
        })
      ).rejects.toThrow("Monthly budget exceeded");

      expect(onBudgetExceeded).toHaveBeenCalled();
    });

    it("should throw error when daily limit exceeded", async () => {
      const storage = new InMemoryCostStorage();

      await expect(
        costTracking({
          execute: async () => ({ value: "result", tokens: 10000 }),
          costPerToken: 0.00003,
          dailyLimit: 0.1,
          storage,
        })
      ).rejects.toThrow("Daily budget exceeded");
    });

    it("should throw error when hourly limit exceeded", async () => {
      const storage = new InMemoryCostStorage();

      await expect(
        costTracking({
          execute: async () => ({ value: "result", tokens: 10000 }),
          costPerToken: 0.00003,
          hourlyLimit: 0.1,
          storage,
        })
      ).rejects.toThrow("Hourly budget exceeded");
    });

    it("should trigger onBudgetWarning at 80%", async () => {
      const storage = new InMemoryCostStorage();
      const onBudgetWarning = vi.fn();

      // First call: 30% of budget
      await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
        onBudgetWarning,
      });

      expect(onBudgetWarning).not.toHaveBeenCalled();

      // Second call: brings total to 90%
      await costTracking({
        execute: async () => ({ value: "result", tokens: 20000 }),
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
        onBudgetWarning,
      });

      expect(onBudgetWarning).toHaveBeenCalled();
    });

    it("should trigger custom alerts at specified thresholds", async () => {
      const storage = new InMemoryCostStorage();
      const alert50 = vi.fn();
      const alert80 = vi.fn();

      // First call: 30% of budget
      await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
        alerts: [
          { threshold: 0.5, action: alert50 },
          { threshold: 0.8, action: alert80 },
        ],
      });

      expect(alert50).not.toHaveBeenCalled();
      expect(alert80).not.toHaveBeenCalled();

      // Second call: brings total to 60%
      await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
        alerts: [
          { threshold: 0.5, action: alert50 },
          { threshold: 0.8, action: alert80 },
        ],
      });

      expect(alert50).toHaveBeenCalled();
      expect(alert80).not.toHaveBeenCalled();
    });

    it("should calculate remaining budget", async () => {
      const storage = new InMemoryCostStorage();

      const result = await costTracking({
        execute: async () => ({ value: "result", tokens: 10000 }),
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
      });

      expect(result.remainingBudget).toBeCloseTo(0.7, 2);
    });

    it("should use budget config object", async () => {
      const storage = new InMemoryCostStorage();

      await expect(
        costTracking({
          execute: async () => ({ value: "result", tokens: 10000 }),
          costPerToken: 0.00003,
          budget: {
            monthly: 0.1,
            daily: 0.05,
            hourly: 0.01,
          },
          storage,
        })
      ).rejects.toThrow("budget exceeded");
    });

    it("should rethrow errors from execute function", async () => {
      const error = new Error("Execution error");

      await expect(
        costTracking({
          execute: async () => {
            throw error;
          },
          costPerToken: 0.00003,
        })
      ).rejects.toThrow("Execution error");
    });
  });

  describe("createCostTracker", () => {
    it("should create a reusable cost tracker", async () => {
      const tracker = createCostTracker({
        costPerToken: 0.00003,
        monthlyBudget: 10.0,
        tags: { feature: "test" },
      });

      const result = await tracker(async () => ({ value: "result", tokens: 1000 }));

      expect(result.value).toBe("result");
      expect(result.cost).toBeCloseTo(0.03, 5);
      expect(result.tags).toEqual({ feature: "test" });
    });

    it("should share state across multiple calls", async () => {
      const storage = new InMemoryCostStorage();
      const tracker = createCostTracker({
        costPerToken: 0.00003,
        monthlyBudget: 1.0,
        storage,
      });

      // First call
      await tracker(async () => ({ value: "result1", tokens: 10000 }));

      // Second call
      const result2 = await tracker(async () => ({ value: "result2", tokens: 10000 }));

      expect(result2.remainingBudget).toBeCloseTo(0.4, 2);
    });
  });

  describe("InMemoryCostStorage", () => {
    let storage: InMemoryCostStorage;

    beforeEach(() => {
      storage = new InMemoryCostStorage();
    });

    it("should track spent amounts by period", async () => {
      await storage.addSpent("monthly", 10);
      await storage.addSpent("daily", 5);
      await storage.addSpent("hourly", 2);

      expect(await storage.getSpent("monthly")).toBe(10);
      expect(await storage.getSpent("daily")).toBe(5);
      expect(await storage.getSpent("hourly")).toBe(2);
    });

    it("should accumulate spent amounts", async () => {
      await storage.addSpent("monthly", 10);
      await storage.addSpent("monthly", 5);
      await storage.addSpent("monthly", 3);

      expect(await storage.getSpent("monthly")).toBe(18);
    });

    it("should reset spent amounts", async () => {
      await storage.addSpent("monthly", 10);
      await storage.resetSpent("monthly");

      expect(await storage.getSpent("monthly")).toBe(0);
    });

    it("should return 0 for new periods", async () => {
      expect(await storage.getSpent("monthly")).toBe(0);
      expect(await storage.getSpent("daily")).toBe(0);
      expect(await storage.getSpent("hourly")).toBe(0);
    });
  });
});
