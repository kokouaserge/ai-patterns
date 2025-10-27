import { describe, it, expect, vi, beforeEach } from "vitest";
import { smartContextWindow, createAISummarizer } from "./context-window";
import { ContextStrategy } from "../types/context-window";
import type { Message } from "../types/context-window";
import { PatternError, ErrorCode } from "../types/errors";

describe("Smart Context Window Pattern", () => {
  const createMessages = (count: number): Message[] => {
    return Array.from({ length: count }, (_, i) => ({
      role: i === 0 ? "system" : i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}: ${"x".repeat(100)}`, // ~25 tokens each
    })) as Message[];
  };

  describe("smartContextWindow", () => {
    it("should not optimize when within token limit", async () => {
      const messages = createMessages(10);
      const execute = vi.fn(async (msgs: Message[]) => "result");

      const result = await smartContextWindow({
        execute,
        messages,
        maxTokens: 10000,
      });

      expect(result.value).toBe("result");
      expect(result.wasOptimized).toBe(false);
      expect(result.originalMessageCount).toBe(10);
      expect(result.optimizedMessageCount).toBe(10);
      expect(execute).toHaveBeenCalledWith(messages);
    });

    it("should optimize when exceeding token limit with sliding-window", async () => {
      const messages = createMessages(100);
      const execute = vi.fn(async (msgs: Message[]) => "result");

      const result = await smartContextWindow({
        execute,
        messages,
        maxTokens: 500, // Force optimization
        strategy: ContextStrategy.SLIDING_WINDOW,
        keepRecentCount: 20,
      });

      expect(result.value).toBe("result");
      expect(result.wasOptimized).toBe(true);
      expect(result.strategyUsed).toBe("sliding-window");
      expect(result.optimizedMessageCount).toBeLessThan(result.originalMessageCount);
      expect(execute).toHaveBeenCalledTimes(1);

      // Should keep system message + recent messages
      const optimizedMessages = execute.mock.calls[0][0];
      expect(optimizedMessages.some((m: Message) => m.role === "system")).toBe(true);
    });

    it("should call onTruncation callback when optimizing", async () => {
      const messages = createMessages(100);
      const onTruncation = vi.fn();

      await smartContextWindow({
        execute: async () => "result",
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SLIDING_WINDOW,
        keepRecentCount: 20,
        onTruncation,
      });

      expect(onTruncation).toHaveBeenCalledWith(
        100, // original count
        expect.any(Number), // optimized count
        expect.any(Number), // original tokens
        expect.any(Number) // optimized tokens
      );

      const [origCount, optCount, origTokens, optTokens] = onTruncation.mock.calls[0];
      expect(optCount).toBeLessThan(origCount);
      expect(optTokens).toBeLessThan(origTokens);
    });

    it("should call onOptimization callback", async () => {
      const messages = createMessages(100);
      const onOptimization = vi.fn();

      await smartContextWindow({
        execute: async () => "result",
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SLIDING_WINDOW,
        onOptimization,
      });

      expect(onOptimization).toHaveBeenCalledWith("sliding-window", expect.any(Array));
    });

    it("should use prioritize-important strategy", async () => {
      const messages: Message[] = [
        { role: "system", content: "System message" },
        { role: "user", content: "Regular message" },
        { role: "user", content: "@user mention message" },
        { role: "user", content: "Another regular message" },
        { role: "user", content: "/command message" },
        { role: "user", content: "Regular message", metadata: { important: true } },
      ];

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 10, // Very low to force optimization
        strategy: ContextStrategy.PRIORITIZE_IMPORTANT,
      });

      const optimizedMessages = execute.mock.calls[0][0];

      // Should keep system, mentions, commands, and important messages (4 total)
      expect(optimizedMessages).toHaveLength(4);
      expect(optimizedMessages.some((m: Message) => m.role === "system")).toBe(true);
      expect(optimizedMessages.some((m: Message) => m.content.includes("@"))).toBe(true);
      expect(optimizedMessages.some((m: Message) => m.content.startsWith("/"))).toBe(true);
      expect(optimizedMessages.some((m: Message) => m.metadata?.important)).toBe(true);
    });

    it("should use truncate-middle strategy", async () => {
      const messages = createMessages(100);
      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.TRUNCATE_MIDDLE,
      });

      const optimizedMessages = execute.mock.calls[0][0];

      // Should have system messages + first messages + marker + last messages
      expect(optimizedMessages.some((m: Message) => m.content.includes("omitted"))).toBe(true);
    });

    it("should use summarize-old strategy with summarizer", async () => {
      const messages = createMessages(100);
      const summarizer = vi.fn(async (msgs: Message[]) => {
        return `Summary of ${msgs.length} messages`;
      });

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SUMMARIZE_OLD,
        summarizeOldCount: 20,
        summarizer,
      });

      expect(summarizer).toHaveBeenCalled();

      const optimizedMessages = execute.mock.calls[0][0];

      // Should have system message + summary + recent messages
      expect(
        optimizedMessages.some((m: Message) => m.content.includes("Previous conversation summary"))
      ).toBe(true);
    });

    it("should fall back to sliding-window if summarizer fails", async () => {
      const messages = createMessages(100);
      const summarizer = vi.fn(async () => {
        throw new Error("Summarizer failed");
      });

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SUMMARIZE_OLD,
        summarizer,
        keepRecentCount: 20,
      });

      expect(summarizer).toHaveBeenCalled();

      // Should still execute with sliding-window fallback
      expect(execute).toHaveBeenCalledTimes(1);
      const optimizedMessages = execute.mock.calls[0][0];
      expect(optimizedMessages.length).toBeLessThan(messages.length);
    });

    it("should use custom strategy from strategies config", async () => {
      const messages = createMessages(100);
      const customStrategy = vi.fn((msgs: Message[]) => msgs.slice(0, 10));

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SLIDING_WINDOW,
        strategies: {
          "sliding-window": customStrategy,
        },
      });

      expect(customStrategy).toHaveBeenCalledWith(messages);

      const optimizedMessages = execute.mock.calls[0][0];
      expect(optimizedMessages).toHaveLength(10);
    });

    it("should use custom strategy type", async () => {
      const messages = createMessages(100);
      const customOptimizer = vi.fn((msgs: Message[]) => msgs.slice(-15));

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.CUSTOM,
        strategies: {
          custom: customOptimizer,
        },
      });

      expect(customOptimizer).toHaveBeenCalled();

      const optimizedMessages = execute.mock.calls[0][0];
      expect(optimizedMessages).toHaveLength(15);
    });

    it("should use custom token counter", async () => {
      const messages = createMessages(10);
      const customTokenCounter = vi.fn((msgs: Message[]) => {
        return msgs.length * 1000; // Custom counting logic
      });

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 5000,
        tokenCounter: customTokenCounter,
        keepRecentCount: 5,
      });

      expect(customTokenCounter).toHaveBeenCalled();
    });

    it("should throw error if no messages provided", async () => {
      await expect(
        smartContextWindow({
          execute: async () => "result",
          messages: [],
          maxTokens: 1000,
        })
      ).rejects.toThrow(PatternError);

      try {
        await smartContextWindow({
          execute: async () => "result",
          messages: [],
          maxTokens: 1000,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.INVALID_ARGUMENT);
      }
    });

    it("should throw error if maxTokens is invalid", async () => {
      const messages = createMessages(10);

      await expect(
        smartContextWindow({
          execute: async () => "result",
          messages,
          maxTokens: 0,
        })
      ).rejects.toThrow(PatternError);

      await expect(
        smartContextWindow({
          execute: async () => "result",
          messages,
          maxTokens: -100,
        })
      ).rejects.toThrow(PatternError);
    });

    it("should throw error if execution fails", async () => {
      const messages = createMessages(10);
      const error = new Error("Execution failed");

      await expect(
        smartContextWindow({
          execute: async () => {
            throw error;
          },
          messages,
          maxTokens: 10000,
        })
      ).rejects.toThrow(PatternError);

      try {
        await smartContextWindow({
          execute: async () => {
            throw error;
          },
          messages,
          maxTokens: 10000,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(PatternError);
        expect((err as PatternError).code).toBe(ErrorCode.EXECUTION_FAILED);
        expect((err as PatternError).cause).toBe(error);
      }
    });

    it("should preserve system messages in all strategies", async () => {
      const messages: Message[] = [
        { role: "system", content: "System prompt 1" },
        { role: "system", content: "System prompt 2" },
        ...createMessages(98),
      ];

      const execute = vi.fn(async (msgs: Message[]) => "result");

      await smartContextWindow({
        execute,
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SLIDING_WINDOW,
        keepRecentCount: 10,
      });

      const optimizedMessages = execute.mock.calls[0][0];
      const systemMessages = optimizedMessages.filter((m: Message) => m.role === "system");

      expect(systemMessages.length).toBeGreaterThanOrEqual(2);
    });

    it("should return correct metadata in result", async () => {
      const messages = createMessages(100);

      const result = await smartContextWindow({
        execute: async () => "result",
        messages,
        maxTokens: 500,
        strategy: ContextStrategy.SLIDING_WINDOW,
        keepRecentCount: 20,
      });

      expect(result).toMatchObject({
        value: "result",
        originalMessageCount: 100,
        wasOptimized: true,
        strategyUsed: "sliding-window",
        timestamp: expect.any(Number),
      });

      expect(result.optimizedMessageCount).toBeLessThan(result.originalMessageCount);
      expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
    });
  });

  describe("createAISummarizer", () => {
    it("should create a working summarizer", async () => {
      const mockSummarize = vi.fn(async (msgs: Message[]) => {
        return `Summary of ${msgs.length} messages`;
      });

      const summarizer = createAISummarizer(mockSummarize);
      const messages = createMessages(10);

      const result = await summarizer(messages);

      expect(result).toBe("Summary of 10 messages");
      expect(mockSummarize).toHaveBeenCalledWith(messages);
    });

    it("should throw PatternError on failure", async () => {
      const mockSummarize = vi.fn(async () => {
        throw new Error("Summarization failed");
      });

      const summarizer = createAISummarizer(mockSummarize);
      const messages = createMessages(10);

      await expect(summarizer(messages)).rejects.toThrow(PatternError);

      try {
        await summarizer(messages);
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.EXECUTION_FAILED);
      }
    });
  });
});
