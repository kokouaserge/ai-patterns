/**
 * Smart Context Window Management Pattern
 *
 * Automatically manages context token limits by truncating, summarizing,
 * or chunking content to prevent context_length_exceeded errors.
 *
 * @example
 * ```typescript
 * import { smartContextWindow, ContextStrategy } from 'ai-patterns';
 *
 * const result = await smartContextWindow({
 *   execute: async (messages) => {
 *     return await generateText({
 *       model: openai('gpt-4-turbo'),
 *       messages
 *     });
 *   },
 *   messages: conversationHistory,
 *   maxTokens: 120000,
 *   strategy: ContextStrategy.SLIDING_WINDOW,
 *   keepRecentCount: 50
 * });
 * ```
 */

import type {
  SmartContextWindowConfig,
  SmartContextWindowResult,
  Message,
  TokenCounter,
  MessageOptimizer,
} from "../types/context-window";
import { ContextStrategy } from "../types/context-window";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";

/**
 * Simple token counter (approximately 4 characters per token)
 * For production, use a proper tokenizer like tiktoken
 */
function defaultTokenCounter(messages: Message[]): number {
  const totalChars = messages.reduce((sum, msg) => {
    return sum + msg.content.length + (msg.name?.length || 0) + msg.role.length;
  }, 0);

  // Rough estimation: ~4 chars per token
  return Math.ceil(totalChars / 4);
}

/**
 * Sliding window strategy: keep only recent messages
 */
function slidingWindowStrategy(
  messages: Message[],
  keepCount: number
): Message[] {
  // Always keep system messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  // Keep the most recent messages
  const recentMessages = otherMessages.slice(-keepCount);

  return [...systemMessages, ...recentMessages];
}

/**
 * Prioritize important strategy: keep system, mentions, and important messages
 */
function prioritizeImportantStrategy(messages: Message[]): Message[] {
  return messages.filter((msg) => {
    // Always keep system messages
    if (msg.role === "system") return true;

    // Keep messages marked as important
    if (msg.metadata?.important === true) return true;

    // Keep messages with mentions (@)
    if (msg.content.includes("@")) return true;

    // Keep messages that look like commands (start with /)
    if (msg.content.trim().startsWith("/")) return true;

    // Keep function/tool calls
    if (msg.role === "function" || msg.role === "tool") return true;

    return false;
  });
}

/**
 * Truncate middle strategy: keep first and last messages, remove middle
 */
function truncateMiddleStrategy(
  messages: Message[],
  keepFirstCount: number = 10,
  keepLastCount: number = 30
): Message[] {
  if (messages.length <= keepFirstCount + keepLastCount) {
    return messages;
  }

  const systemMessages = messages.filter((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  const firstMessages = otherMessages.slice(0, keepFirstCount);
  const lastMessages = otherMessages.slice(-keepLastCount);

  // Add a marker message to indicate truncation
  const truncationMarker: Message = {
    role: "system",
    content: `[... ${otherMessages.length - keepFirstCount - keepLastCount} messages omitted ...]`,
  };

  return [...systemMessages, ...firstMessages, truncationMarker, ...lastMessages];
}

/**
 * Apply optimization strategy to messages
 */
async function optimizeMessages(
  messages: Message[],
  currentTokens: number,
  config: SmartContextWindowConfig<any>
): Promise<Message[]> {
  const {
    strategy = ContextStrategy.SLIDING_WINDOW,
    strategies = {},
    keepRecentCount = 50,
    summarizeOldCount = 20,
    summarizer,
    logger = defaultLogger,
  } = config;

  logger.debug(`Optimizing messages using strategy: ${strategy}`);

  // Use custom strategy if provided
  if (strategy === ContextStrategy.CUSTOM && strategies.custom) {
    return await strategies.custom(messages, currentTokens, config.maxTokens);
  }

  // Use user-provided strategy override
  if (strategies[strategy]) {
    const result = strategies[strategy]!(messages);
    return result instanceof Promise ? await result : result;
  }

  // Built-in strategies
  switch (strategy) {
    case ContextStrategy.SLIDING_WINDOW:
      return slidingWindowStrategy(messages, keepRecentCount);

    case ContextStrategy.SUMMARIZE_OLD:
      if (!summarizer) {
        logger.warn("No summarizer provided, falling back to sliding-window");
        return slidingWindowStrategy(messages, keepRecentCount);
      }

      const systemMessages = messages.filter((m) => m.role === "system");
      const otherMessages = messages.filter((m) => m.role !== "system");

      if (otherMessages.length <= summarizeOldCount) {
        return messages;
      }

      const oldMessages = otherMessages.slice(0, -summarizeOldCount);
      const recentMessages = otherMessages.slice(-summarizeOldCount);

      try {
        const summary = await summarizer(oldMessages);
        const summaryMessage: Message = {
          role: "system",
          content: `Previous conversation summary: ${summary}`,
        };

        return [...systemMessages, summaryMessage, ...recentMessages];
      } catch (error) {
        logger.error("Failed to summarize messages, falling back to sliding-window", {
          error: error instanceof Error ? error.message : String(error),
        });
        return slidingWindowStrategy(messages, keepRecentCount);
      }

    case ContextStrategy.PRIORITIZE_IMPORTANT:
      return prioritizeImportantStrategy(messages);

    case ContextStrategy.TRUNCATE_MIDDLE:
      return truncateMiddleStrategy(messages);

    default:
      logger.warn(`Unknown strategy: ${strategy}, using sliding-window`);
      return slidingWindowStrategy(messages, keepRecentCount);
  }
}

/**
 * Smart context window management
 */
export async function smartContextWindow<TResult = any>(
  config: SmartContextWindowConfig<TResult>
): Promise<SmartContextWindowResult<TResult>> {
  const {
    execute,
    messages,
    maxTokens,
    tokenCounter = defaultTokenCounter,
    onTruncation,
    onOptimization,
    logger = defaultLogger,
  } = config;

  // Validate configuration
  if (!messages || messages.length === 0) {
    throw new PatternError(
      "At least one message is required",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  if (maxTokens <= 0) {
    throw new PatternError(
      "maxTokens must be greater than 0",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  const originalMessageCount = messages.length;

  // Count tokens in original messages
  const originalTokens =
    typeof tokenCounter === "function"
      ? await tokenCounter(messages)
      : defaultTokenCounter(messages);

  logger.debug(`Original context: ${originalMessageCount} messages, ${originalTokens} tokens`);

  let optimizedMessages = messages;
  let wasOptimized = false;
  let strategyUsed: string | undefined;

  // Check if optimization is needed
  if (originalTokens > maxTokens) {
    logger.info(
      `Context exceeds limit (${originalTokens} > ${maxTokens}), applying optimization`
    );

    optimizedMessages = await optimizeMessages(messages, originalTokens, config);
    wasOptimized = true;
    strategyUsed = config.strategy || "sliding-window";

    // Count tokens in optimized messages
    const optimizedTokens = await tokenCounter(optimizedMessages);

    logger.info(
      `Optimized context: ${optimizedMessages.length} messages, ${optimizedTokens} tokens`
    );

    // Call optimization callback
    if (onOptimization) {
      await onOptimization(strategyUsed as any, optimizedMessages);
    }

    // Call truncation callback
    if (onTruncation) {
      await onTruncation(
        originalMessageCount,
        optimizedMessages.length,
        originalTokens,
        optimizedTokens
      );
    }

    // Check if still over limit
    if (optimizedTokens > maxTokens) {
      logger.warn(
        `Optimized context still exceeds limit (${optimizedTokens} > ${maxTokens})`
      );
    }
  } else {
    logger.debug("Context within limits, no optimization needed");
  }

  // Execute with optimized messages
  try {
    const result = await execute(optimizedMessages);

    const optimizedTokens = wasOptimized
      ? await tokenCounter(optimizedMessages)
      : originalTokens;

    return {
      value: result,
      originalMessageCount,
      optimizedMessageCount: optimizedMessages.length,
      originalTokens,
      optimizedTokens,
      wasOptimized,
      strategyUsed: wasOptimized ? (strategyUsed as any) : undefined,
      timestamp: Date.now(),
    };
  } catch (error) {
    const execError = error instanceof Error ? error : new Error(String(error));

    logger.error("Execution failed with optimized context", {
      error: execError.message,
    });

    throw new PatternError(
      `Smart context window execution failed: ${execError.message}`,
      ErrorCode.EXECUTION_FAILED,
      execError,
      {
        originalMessageCount,
        optimizedMessageCount: optimizedMessages.length,
        originalTokens,
        wasOptimized,
        strategyUsed,
      }
    );
  }
}

/**
 * Helper function to create a summarizer using an AI model
 */
export function createAISummarizer(
  summarizeFn: (messages: Message[]) => Promise<string>
): (messages: Message[]) => Promise<string> {
  return async (messages: Message[]) => {
    try {
      return await summarizeFn(messages);
    } catch (error) {
      throw new PatternError(
        `Failed to summarize messages: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.EXECUTION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  };
}
