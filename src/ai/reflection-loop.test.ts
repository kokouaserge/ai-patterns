import { describe, it, expect, vi, beforeEach } from "vitest";
import { reflectionLoop, InMemoryReflectionStorage } from "./reflection-loop";
import type { ReflectionResult } from "../types/reflection-loop";
import { PatternError, ErrorCode } from "../types/errors";

describe("reflectionLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should improve response through iterations", async () => {
      let callCount = 0;
      const execute = vi.fn().mockImplementation(async (ctx) => {
        callCount++;
        return `Response v${callCount}`;
      });

      const reflect = vi.fn().mockImplementation(async (response) => {
        const version = parseInt(response.match(/v(\d+)/)?.[1] || "0");
        return {
          score: version * 2, // Improving score
          feedback: `Improve clarity for v${version + 1}`,
          shouldContinue: version < 3,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
        targetScore: 6,
      });

      expect(result.value).toBe("Response v3");
      expect(result.finalScore).toBe(6);
      expect(result.iterations).toBe(3);
      expect(result.targetReached).toBe(true);
      expect(execute).toHaveBeenCalledTimes(3);
      expect(reflect).toHaveBeenCalledTimes(3);
    });

    it("should provide context with previous iteration", async () => {
      let callCount = 0;
      const execute = vi.fn().mockImplementation(async (ctx) => {
        callCount++;
        if (ctx.iteration === 1) {
          return "First attempt";
        }
        expect(ctx.previousResponse).toBeDefined();
        expect(ctx.previousCritique).toBeDefined();
        return `Iteration ${ctx.iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async () => {
        return {
          score: 5,
          feedback: "Good",
          shouldContinue: callCount < 2, // Continue only for first iteration
        };
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 3,
      });

      expect(execute).toHaveBeenCalledTimes(2);
    });

    it("should return best score when max iterations reached", async () => {
      const scores = [3, 7, 5, 6, 4]; // Best is iteration 2 with score 7
      let iteration = 0;

      const execute = vi.fn().mockImplementation(async () => {
        iteration++;
        return `Response ${iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async () => {
        return {
          score: scores[iteration - 1],
          feedback: "Feedback",
          shouldContinue: true,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
        targetScore: 10,
        onMaxIterationsReached: "return-best",
      });

      expect(result.value).toBe("Response 2");
      expect(result.finalScore).toBe(7);
      expect(result.iterations).toBe(5);
      expect(result.targetReached).toBe(false);
    });

    it("should return last iteration when configured", async () => {
      const scores = [3, 7, 5];
      let iteration = 0;

      const execute = vi.fn().mockImplementation(async () => {
        iteration++;
        return `Response ${iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async () => {
        return {
          score: scores[iteration - 1],
          feedback: "Feedback",
          shouldContinue: true,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 3,
        targetScore: 10,
        onMaxIterationsReached: "return-last",
      });

      expect(result.value).toBe("Response 3");
      expect(result.finalScore).toBe(5);
    });

    it("should throw when max iterations reached and configured to throw", async () => {
      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 3,
        feedback: "Not good enough",
        shouldContinue: true,
      });

      await expect(
        reflectionLoop({
          execute,
          reflect,
          maxIterations: 2,
          targetScore: 10,
          onMaxIterationsReached: "throw",
        })
      ).rejects.toThrow(PatternError);
    });
  });

  describe("history and observability", () => {
    it("should track complete history", async () => {
      const execute = vi.fn().mockImplementation(async (ctx) => {
        return `Response ${ctx.iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async (response) => {
        const num = parseInt(response.match(/\d+/)?.[0] || "0");
        return {
          score: num * 2,
          feedback: "Good",
          shouldContinue: num < 3,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
      });

      expect(result.history.iterations).toHaveLength(3);
      expect(result.history.stats.totalIterations).toBe(3);
      expect(result.history.best.iteration).toBe(3);
      expect(result.history.last.iteration).toBe(3);
      expect(result.history.getScoreProgression()).toEqual([2, 4, 6]);
      expect(result.history.wasImproving()).toBe(true);
    });

    it("should call all lifecycle hooks", async () => {
      const onStart = vi.fn();
      const onBeforeExecute = vi.fn();
      const onAfterExecute = vi.fn();
      const onBeforeReflect = vi.fn();
      const onAfterReflect = vi.fn();
      const onIterationComplete = vi.fn();
      const onImprovement = vi.fn();
      const onTargetReached = vi.fn();
      const onComplete = vi.fn();

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 10,
        feedback: "Perfect",
        shouldContinue: false,
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 3,
        targetScore: 10,
        onStart,
        onBeforeExecute,
        onAfterExecute,
        onBeforeReflect,
        onAfterReflect,
        onIterationComplete,
        onImprovement,
        onTargetReached,
        onComplete,
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onBeforeExecute).toHaveBeenCalledTimes(1);
      expect(onAfterExecute).toHaveBeenCalledTimes(1);
      expect(onBeforeReflect).toHaveBeenCalledTimes(1);
      expect(onAfterReflect).toHaveBeenCalledTimes(1);
      expect(onIterationComplete).toHaveBeenCalledTimes(1);
      expect(onTargetReached).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("should call onImprovement when score improves", async () => {
      const scores = [3, 5, 7];
      let iteration = 0;
      const onImprovement = vi.fn();

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockImplementation(async () => {
        iteration++;
        return {
          score: scores[iteration - 1],
          feedback: "Better",
          shouldContinue: iteration < 3,
        };
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
        onImprovement,
      });

      expect(onImprovement).toHaveBeenCalledTimes(2); // Improved twice (3->5, 5->7)
    });

    it("should call onStagnation when score doesn't improve", async () => {
      const scores = [5, 5, 5];
      let iteration = 0;
      const onStagnation = vi.fn();

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockImplementation(async () => {
        iteration++;
        return {
          score: scores[iteration - 1],
          feedback: "Same",
          shouldContinue: iteration < 3,
        };
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
        onStagnation,
      });

      expect(onStagnation).toHaveBeenCalledTimes(2);
    });

    it("should call onMaxIterations hook", async () => {
      const onMaxIterations = vi.fn();

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 3,
        feedback: "Not enough",
        shouldContinue: true,
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 2,
        targetScore: 10,
        onMaxIterations,
      });

      expect(onMaxIterations).toHaveBeenCalledTimes(1);
    });
  });

  describe("metrics tracking", () => {
    it("should track metrics for each iteration", async () => {
      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 10,
        feedback: "Good",
        shouldContinue: false,
      });

      const result = await reflectionLoop({
        execute,
        reflect,
      });

      const iteration = result.history.iterations[0];
      expect(iteration.metrics.executionTime).toBeGreaterThan(0);
      expect(iteration.metrics.reflectionTime).toBeGreaterThan(0);
      expect(iteration.metrics.totalTime).toBeGreaterThan(0);
      expect(result.metrics.totalTime).toBeGreaterThan(0);
      expect(result.metrics.averageIterationTime).toBeGreaterThan(0);
    });

    it("should track tokens and cost when response includes tokens", async () => {
      // User returns { ...response, tokens } like costTracking pattern
      const execute = vi.fn().mockResolvedValue({
        text: "Response with tokens",
        tokens: 150  // User provides tokens
      });
      const reflect = vi.fn().mockResolvedValue({
        score: 10,
        feedback: "Good",
        shouldContinue: false,
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        costPerToken: 0.00002,  // We calculate cost automatically
      });

      const iteration = result.history.iterations[0];
      expect(iteration.metrics.tokens).toBe(150);
      expect(iteration.metrics.cost).toBe(150 * 0.00002);  // 0.003
      expect(result.metrics.totalTokens).toBe(150);
      expect(result.metrics.totalCost).toBe(150 * 0.00002);
    });
  });

  describe("history storage", () => {
    it("should save iterations to storage", async () => {
      const storage = new InMemoryReflectionStorage();
      const sessionId = "test-session";

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 10,
        feedback: "Good",
        shouldContinue: false,
      });

      await reflectionLoop({
        execute,
        reflect,
        enableHistory: true,
        historyStorage: storage,
        sessionId,
      });

      const loaded = await storage.load(sessionId);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].response).toBe("Response");
    });

    it("should support includeHistoryInContext", async () => {
      const execute = vi.fn().mockImplementation(async (ctx) => {
        if (ctx.iteration === 1) {
          expect(ctx.history).toHaveLength(0);
        } else {
          expect(ctx.history.length).toBeGreaterThan(0);
        }
        return `Response ${ctx.iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async (response) => {
        const num = parseInt(response.match(/\d+/)?.[0] || "0");
        return {
          score: num,
          feedback: "Good",
          shouldContinue: num < 3,
        };
      });

      await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
        includeHistoryInContext: true,
        maxHistoryInContext: 2,
      });

      expect(execute).toHaveBeenCalledTimes(3);
    });
  });

  describe("error handling", () => {
    it("should throw PatternError when execute fails", async () => {
      const execute = vi.fn().mockRejectedValue(new Error("Execution failed"));
      const reflect = vi.fn().mockResolvedValue({
        score: 5,
        feedback: "Good",
        shouldContinue: true,
      });

      await expect(
        reflectionLoop({
          execute,
          reflect,
        })
      ).rejects.toThrow(PatternError);
    });

    it("should throw PatternError when reflect fails", async () => {
      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockRejectedValue(new Error("Reflection failed"));

      await expect(
        reflectionLoop({
          execute,
          reflect,
        })
      ).rejects.toThrow(PatternError);
    });

    it("should call onError hook on failure", async () => {
      const onError = vi.fn();
      const execute = vi.fn().mockRejectedValue(new Error("Failed"));
      const reflect = vi.fn().mockResolvedValue({
        score: 5,
        feedback: "Good",
        shouldContinue: true,
      });

      await expect(
        reflectionLoop({
          execute,
          reflect,
          onError,
        })
      ).rejects.toThrow();

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("should validate maxIterations", async () => {
      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 5,
        feedback: "Good",
        shouldContinue: true,
      });

      await expect(
        reflectionLoop({
          execute,
          reflect,
          maxIterations: 0,
        })
      ).rejects.toThrow(PatternError);
    });

    it("should validate execute function", async () => {
      const reflect = vi.fn().mockResolvedValue({
        score: 5,
        feedback: "Good",
        shouldContinue: true,
      });

      await expect(
        reflectionLoop({
          // @ts-expect-error - Testing invalid input
          execute: null,
          reflect,
        })
      ).rejects.toThrow(PatternError);
    });

    it("should validate reflect function", async () => {
      const execute = vi.fn().mockResolvedValue("Response");

      await expect(
        reflectionLoop({
          execute,
          // @ts-expect-error - Testing invalid input
          reflect: null,
        })
      ).rejects.toThrow(PatternError);
    });
  });

  describe("shouldContinue flag", () => {
    it("should stop when reflect returns shouldContinue: false", async () => {
      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockResolvedValue({
        score: 5,
        feedback: "Good enough",
        shouldContinue: false,
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 10,
      });

      expect(result.iterations).toBe(1);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("history methods", () => {
    it("should provide getIteration method", async () => {
      const execute = vi.fn().mockImplementation(async (ctx) => {
        return `Response ${ctx.iteration}`;
      });

      const reflect = vi.fn().mockImplementation(async () => {
        return {
          score: 5,
          feedback: "Good",
          shouldContinue: false,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 1,
      });

      const iteration = result.history.getIteration(1);
      expect(iteration).toBeDefined();
      expect(iteration?.iteration).toBe(1);
      expect(iteration?.response).toBe("Response 1");

      const notFound = result.history.getIteration(999);
      expect(notFound).toBeUndefined();
    });

    it("should calculate stats correctly", async () => {
      const scores = [3, 7, 5];
      let iteration = 0;

      const execute = vi.fn().mockResolvedValue("Response");
      const reflect = vi.fn().mockImplementation(async () => {
        iteration++;
        return {
          score: scores[iteration - 1],
          feedback: "Feedback",
          shouldContinue: iteration < 3,
        };
      });

      const result = await reflectionLoop({
        execute,
        reflect,
        maxIterations: 5,
      });

      expect(result.history.stats.bestScore).toBe(7);
      expect(result.history.stats.worstScore).toBe(3);
      expect(result.history.stats.averageScore).toBe(5); // (3+7+5)/3
      expect(result.history.stats.scoreImprovement).toBe(4); // 7-3
    });
  });
});
