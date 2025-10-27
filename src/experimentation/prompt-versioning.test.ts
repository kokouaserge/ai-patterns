import { describe, it, expect, vi, beforeEach } from "vitest";
import { versionedPrompt, InMemoryPromptVersionStorage } from "./prompt-versioning";
import type { PromptVersion } from "../types/prompt-versioning";
import { PatternError, ErrorCode } from "../types/errors";

describe("Prompt Versioning Pattern", () => {
  describe("versionedPrompt", () => {
    it("should select and execute an active version", async () => {
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Summarize this text",
          active: true,
        },
      };

      const execute = vi.fn(async (prompt: string) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return `Result: ${prompt}`;
      });

      const result = await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute,
      });

      expect(result.value).toBe("Result: Summarize this text");
      expect(result.version).toBe("v1.0");
      expect(result.timestamp).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);
      expect(execute).toHaveBeenCalledWith("Summarize this text", "v1.0");
    });

    it("should select active version with highest rollout percentage", async () => {
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Version 1",
          active: true,
          rolloutPercentage: 0,
        },
        "v2.0": {
          prompt: "Version 2",
          active: true,
          rolloutPercentage: 100,
        },
      };

      const execute = vi.fn(async (prompt: string) => `Result: ${prompt}`);

      const result = await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute,
      });

      expect(result.version).toBe("v2.0");
      expect(result.value).toBe("Result: Version 2");
    });

    it("should call onVersionUsed callback", async () => {
      const onVersionUsed = vi.fn();
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        onVersionUsed,
      });

      expect(onVersionUsed).toHaveBeenCalledWith(
        "v1.0",
        expect.objectContaining({
          value: "result",
          version: "v1.0",
        })
      );
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        onSuccess,
      });

      expect(onSuccess).toHaveBeenCalledWith(
        "v1.0",
        expect.objectContaining({
          value: "result",
          version: "v1.0",
        })
      );
    });

    it("should call onError callback on failure", async () => {
      const onError = vi.fn();
      const error = new Error("Test error");
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      await expect(
        versionedPrompt({
          promptId: "test-prompt",
          versions,
          execute: async () => {
            throw error;
          },
          onError,
        })
      ).rejects.toThrow(PatternError);

      expect(onError).toHaveBeenCalledWith("v1.0", error);
    });

    it("should throw PatternError if no versions provided", async () => {
      await expect(
        versionedPrompt({
          promptId: "test-prompt",
          versions: {},
          execute: async () => "result",
        })
      ).rejects.toThrow(PatternError);

      try {
        await versionedPrompt({
          promptId: "test-prompt",
          versions: {},
          execute: async () => "result",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.NO_VARIANTS);
      }
    });

    it("should throw PatternError if no active versions", async () => {
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: false,
        },
      };

      await expect(
        versionedPrompt({
          promptId: "test-prompt",
          versions,
          execute: async () => "result",
        })
      ).rejects.toThrow(PatternError);
    });

    it("should update metrics after execution", async () => {
      const storage = new InMemoryPromptVersionStorage();
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return "result";
        },
        storage,
      });

      const metrics = await storage.getMetrics("test-prompt", "v1.0");
      expect(metrics).toBeDefined();
      expect(metrics?.usageCount).toBe(1);
      expect(metrics?.avgResponseTime).toBeGreaterThan(0);
    });

    it("should update error rate on failure", async () => {
      const storage = new InMemoryPromptVersionStorage();
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      try {
        await versionedPrompt({
          promptId: "test-prompt",
          versions,
          execute: async () => {
            throw new Error("Test error");
          },
          storage,
        });
      } catch {
        // Expected error
      }

      const metrics = await storage.getMetrics("test-prompt", "v1.0");
      expect(metrics?.errorRate).toBeGreaterThan(0);
    });

    it("should handle gradual rollout with multiple versions", async () => {
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Old version",
          active: true,
          rolloutPercentage: 50,
        },
        "v2.0": {
          prompt: "New version",
          active: true,
          rolloutPercentage: 50,
        },
      };

      const execute = vi.fn(async (prompt: string) => `Result: ${prompt}`);

      // Run multiple times to ensure both versions are potentially selected
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          versionedPrompt({
            promptId: "test-prompt",
            versions,
            execute,
          })
        )
      );

      // Check that at least one version was executed
      expect(results.length).toBe(10);
      expect(results.every((r) => r.version === "v1.0" || r.version === "v2.0")).toBe(true);
    });

    it("should store active version", async () => {
      const storage = new InMemoryPromptVersionStorage();
      const versions: Record<string, PromptVersion> = {
        "v1.0": {
          prompt: "Test prompt",
          active: true,
        },
      };

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        storage,
      });

      const activeVersion = await storage.getActiveVersion("test-prompt");
      expect(activeVersion).toBe("v1.0");
    });

    it("should maintain version history", async () => {
      const storage = new InMemoryPromptVersionStorage();

      // Execute v1.0
      await versionedPrompt({
        promptId: "test-prompt",
        versions: {
          "v1.0": { prompt: "Version 1", active: true },
        },
        execute: async () => "result",
        storage,
      });

      // Execute v2.0
      await versionedPrompt({
        promptId: "test-prompt",
        versions: {
          "v2.0": { prompt: "Version 2", active: true },
        },
        execute: async () => "result",
        storage,
      });

      const history = await storage.getVersionHistory("test-prompt");
      expect(history).toContain("v1.0");
    });
  });

  describe("InMemoryPromptVersionStorage", () => {
    let storage: InMemoryPromptVersionStorage;

    beforeEach(() => {
      storage = new InMemoryPromptVersionStorage();
    });

    it("should store and retrieve metrics", async () => {
      await storage.updateMetrics("prompt-1", "v1.0", {
        satisfaction: 0.85,
        avgTokens: 50,
      });

      const metrics = await storage.getMetrics("prompt-1", "v1.0");
      expect(metrics).toEqual({
        satisfaction: 0.85,
        avgTokens: 50,
      });
    });

    it("should return null for non-existent metrics", async () => {
      const metrics = await storage.getMetrics("prompt-1", "v1.0");
      expect(metrics).toBeNull();
    });

    it("should update existing metrics", async () => {
      await storage.updateMetrics("prompt-1", "v1.0", {
        satisfaction: 0.8,
        avgTokens: 50,
      });

      await storage.updateMetrics("prompt-1", "v1.0", {
        satisfaction: 0.9,
      });

      const metrics = await storage.getMetrics("prompt-1", "v1.0");
      expect(metrics?.satisfaction).toBe(0.9);
      expect(metrics?.avgTokens).toBe(50);
    });

    it("should store and retrieve active version", async () => {
      await storage.setActiveVersion("prompt-1", "v2.0");
      const activeVersion = await storage.getActiveVersion("prompt-1");
      expect(activeVersion).toBe("v2.0");
    });

    it("should return null for non-existent active version", async () => {
      const activeVersion = await storage.getActiveVersion("prompt-1");
      expect(activeVersion).toBeNull();
    });

    it("should maintain version history when active version changes", async () => {
      await storage.setActiveVersion("prompt-1", "v1.0");
      await storage.setActiveVersion("prompt-1", "v2.0");
      await storage.setActiveVersion("prompt-1", "v3.0");

      const history = await storage.getVersionHistory("prompt-1");
      expect(history).toEqual(["v1.0", "v2.0"]);
    });

    it("should handle multiple prompts independently", async () => {
      await storage.setActiveVersion("prompt-1", "v1.0");
      await storage.setActiveVersion("prompt-2", "v2.0");

      await storage.updateMetrics("prompt-1", "v1.0", { satisfaction: 0.8 });
      await storage.updateMetrics("prompt-2", "v2.0", { satisfaction: 0.9 });

      expect(await storage.getActiveVersion("prompt-1")).toBe("v1.0");
      expect(await storage.getActiveVersion("prompt-2")).toBe("v2.0");

      const metrics1 = await storage.getMetrics("prompt-1", "v1.0");
      const metrics2 = await storage.getMetrics("prompt-2", "v2.0");

      expect(metrics1?.satisfaction).toBe(0.8);
      expect(metrics2?.satisfaction).toBe(0.9);
    });

    it("should not duplicate versions in history", async () => {
      await storage.setActiveVersion("prompt-1", "v1.0");
      await storage.setActiveVersion("prompt-1", "v2.0");
      await storage.setActiveVersion("prompt-1", "v2.0");

      const history = await storage.getVersionHistory("prompt-1");
      expect(history).toEqual(["v1.0"]);
    });
  });

  describe("Auto-rollback", () => {
    it("should rollback when satisfaction threshold is not met", async () => {
      const storage = new InMemoryPromptVersionStorage();

      // Set up v1.0 with good metrics
      await storage.setActiveVersion("test-prompt", "v1.0");
      await storage.updateMetrics("test-prompt", "v1.0", {
        satisfaction: 0.85,
        usageCount: 100,
      });

      // Execute v2.0 with poor satisfaction (simulated via metrics update)
      const versions: Record<string, PromptVersion> = {
        "v2.0": {
          prompt: "New version",
          active: true,
        },
      };

      // Simulate poor performance
      await storage.updateMetrics("test-prompt", "v2.0", {
        satisfaction: 0.5,
        usageCount: 10,
      });

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        storage,
        autoRollback: {
          enabled: true,
          conditions: [
            { metric: "satisfaction", threshold: 0.7, window: "1h", operator: "lt" },
          ],
        },
      });

      // The function should have rolled back to v1.0
      const activeVersion = await storage.getActiveVersion("test-prompt");
      expect(activeVersion).toBe("v1.0");
    });

    it("should not rollback when metrics are good", async () => {
      const storage = new InMemoryPromptVersionStorage();

      const versions: Record<string, PromptVersion> = {
        "v2.0": {
          prompt: "New version",
          active: true,
        },
      };

      await storage.updateMetrics("test-prompt", "v2.0", {
        satisfaction: 0.9,
        usageCount: 10,
      });

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        storage,
        autoRollback: {
          enabled: true,
          conditions: [
            { metric: "satisfaction", threshold: 0.7, window: "1h", operator: "lt" },
          ],
        },
      });

      const activeVersion = await storage.getActiveVersion("test-prompt");
      expect(activeVersion).toBe("v2.0");
    });

    it("should rollback on high error rate", async () => {
      const storage = new InMemoryPromptVersionStorage();

      // Set up v1.0
      await storage.setActiveVersion("test-prompt", "v1.0");
      await storage.updateMetrics("test-prompt", "v1.0", {
        errorRate: 0.01,
        usageCount: 100,
      });

      const versions: Record<string, PromptVersion> = {
        "v2.0": {
          prompt: "New version",
          active: true,
        },
      };

      // Simulate high error rate
      await storage.updateMetrics("test-prompt", "v2.0", {
        errorRate: 0.1,
        usageCount: 10,
      });

      await versionedPrompt({
        promptId: "test-prompt",
        versions,
        execute: async () => "result",
        storage,
        autoRollback: {
          enabled: true,
          conditions: [{ metric: "errorRate", threshold: 0.05, window: "30m", operator: "gt" }],
        },
      });

      const activeVersion = await storage.getActiveVersion("test-prompt");
      expect(activeVersion).toBe("v1.0");
    });
  });
});
