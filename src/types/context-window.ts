/**
 * Types for Smart Context Window Management Pattern
 */

import type { Logger } from "./common";

/**
 * Message structure (compatible with AI SDK)
 */
export interface Message {
  role: "system" | "user" | "assistant" | "function" | "tool";
  content: string;
  name?: string;
  metadata?: Record<string, any>;
}

/**
 * Token count information
 */
export interface TokenCount {
  /** Total number of tokens */
  total: number;
  /** Tokens by message index */
  byMessage?: number[];
}

/**
 * Strategy for managing context when token limit is exceeded
 */
export enum ContextStrategy {
  SLIDING_WINDOW = "sliding-window",
  SUMMARIZE_OLD = "summarize-old",
  PRIORITIZE_IMPORTANT = "prioritize-important",
  TRUNCATE_MIDDLE = "truncate-middle",
  CUSTOM = "custom",
}

/**
 * Function to count tokens in messages
 */
export type TokenCounter = (
  messages: Message[]
) => number | Promise<number>;

/**
 * Function to optimize messages based on strategy
 */
export type MessageOptimizer = (
  messages: Message[],
  currentTokens: number,
  maxTokens: number
) => Message[] | Promise<Message[]>;

/**
 * Built-in optimization strategies
 */
export interface OptimizationStrategies {
  /** Keep only the most recent N messages */
  "sliding-window"?: (messages: Message[]) => Message[] | Promise<Message[]>;
  /** Summarize old messages and keep recent ones */
  "summarize-old"?: (messages: Message[]) => Message[] | Promise<Message[]>;
  /** Keep only important messages (system, mentions, commands) */
  "prioritize-important"?: (messages: Message[]) => Message[] | Promise<Message[]>;
  /** Remove messages from the middle of conversation */
  "truncate-middle"?: (messages: Message[]) => Message[] | Promise<Message[]>;
  /** Custom optimization strategy */
  custom?: MessageOptimizer;
}

/**
 * Configuration for smart context window management
 */
export interface SmartContextWindowConfig<TResult> {
  /** Function to execute with optimized messages */
  execute: (messages: Message[]) => Promise<TResult> | TResult;
  /** Input messages */
  messages: Message[];
  /** Maximum tokens allowed (leave margin for response) */
  maxTokens: number;
  /** Strategy to use when context exceeds limit */
  strategy?: ContextStrategy;
  /** Custom optimization strategies */
  strategies?: OptimizationStrategies;
  /** Function to count tokens (defaults to simple estimation) */
  tokenCounter?: TokenCounter;
  /** Number of recent messages to always keep (for sliding window) */
  keepRecentCount?: number;
  /** Number of old messages to summarize (for summarize-old) */
  summarizeOldCount?: number;
  /** Function to generate summary (for summarize-old strategy) */
  summarizer?: (messages: Message[]) => Promise<string>;
  /** Callback when messages are truncated/optimized */
  onTruncation?: (
    originalCount: number,
    optimizedCount: number,
    originalTokens: number,
    optimizedTokens: number
  ) => void | Promise<void>;
  /** Callback when optimization is applied */
  onOptimization?: (
    strategy: ContextStrategy,
    messages: Message[]
  ) => void | Promise<void>;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Result from smart context window execution
 */
export interface SmartContextWindowResult<TResult> {
  /** The result from execution */
  value: TResult;
  /** Original message count */
  originalMessageCount: number;
  /** Optimized message count */
  optimizedMessageCount: number;
  /** Original token count */
  originalTokens: number;
  /** Optimized token count */
  optimizedTokens: number;
  /** Whether optimization was applied */
  wasOptimized: boolean;
  /** Strategy used for optimization */
  strategyUsed?: ContextStrategy;
  /** Timestamp of execution */
  timestamp: number;
}

/**
 * Priority levels for message importance
 */
export enum MessagePriority {
  CRITICAL = 100,
  HIGH = 75,
  MEDIUM = 50,
  LOW = 25,
  MINIMAL = 0,
}
