/**
 * Types for Human-in-the-Loop Pattern
 */

import { AsyncFunction, Logger } from "./common";

/**
 * Escalation reasons
 */
export enum EscalationReason {
  /**
   * AI confidence is too low
   */
  LOW_CONFIDENCE = "LOW_CONFIDENCE",

  /**
   * Operation timed out
   */
  TIMEOUT = "TIMEOUT",

  /**
   * Operation encountered an error
   */
  ERROR = "ERROR",

  /**
   * Sensitive content detected
   */
  SENSITIVE_CONTENT = "SENSITIVE_CONTENT",

  /**
   * Keyword detected in input/output
   */
  KEYWORD_DETECTED = "KEYWORD_DETECTED",

  /**
   * Manual escalation requested
   */
  MANUAL_REQUEST = "MANUAL_REQUEST",

  /**
   * Custom escalation reason
   */
  CUSTOM = "CUSTOM",
}

/**
 * Review status
 */
export enum ReviewStatus {
  /**
   * Review is pending
   */
  PENDING = "PENDING",

  /**
   * Review approved
   */
  APPROVED = "APPROVED",

  /**
   * Review rejected
   */
  REJECTED = "REJECTED",

  /**
   * Review modified
   */
  MODIFIED = "MODIFIED",
}

/**
 * Timeout fallback behavior
 */
export enum TimeoutFallback {
  /**
   * Use AI output on timeout
   */
  USE_AI = "USE_AI",

  /**
   * Throw error on timeout
   */
  THROW = "THROW",

  /**
   * Retry escalation on timeout
   */
  RETRY = "RETRY",
}

/**
 * Escalation rule
 */
export interface EscalationRule<TInput = any, TOutput = any> {
  /**
   * Rule name
   */
  name: string;

  /**
   * Function to determine if escalation is needed
   */
  shouldEscalate: (
    input: TInput,
    output?: TOutput,
    error?: Error
  ) => boolean | Promise<boolean>;

  /**
   * Escalation reason
   */
  reason: EscalationReason;

  /**
   * Priority (higher = more important)
   */
  priority?: number;
}

/**
 * Human review request
 */
export interface HumanReview<TInput = any, TOutput = any> {
  /**
   * Unique review ID
   */
  id: string;

  /**
   * Original input
   */
  input: TInput;

  /**
   * AI output (if available)
   */
  aiOutput?: TOutput;

  /**
   * Escalation reason
   */
  reason: EscalationReason;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Review status
   */
  status: ReviewStatus;

  /**
   * Final output (after human review)
   */
  humanOutput?: TOutput;

  /**
   * Human notes
   */
  notes?: string;

  /**
   * Resolution timestamp
   */
  resolvedAt?: number;
}

/**
 * Options for human-in-the-loop
 */
export interface HumanInTheLoopOptions<TInput = any, TOutput = any> {
  /**
   * AI function to execute
   */
  execute: AsyncFunction<TOutput>;

  /**
   * Input for tracking purposes (optional, for metadata)
   */
  input?: TInput;

  /**
   * Escalation rules
   */
  escalationRules?: EscalationRule<TInput, TOutput>[];

  /**
   * Timeout for human review (ms)
   * @default 300000 (5 minutes)
   */
  reviewTimeout?: number;

  /**
   * Function to request human review
   * Must return the review result
   */
  requestHumanReview: (
    review: HumanReview<TInput, TOutput>
  ) => Promise<TOutput>;

  /**
   * Callback on escalation
   */
  onEscalate?: (review: HumanReview<TInput, TOutput>) => void;

  /**
   * Callback after review complete
   */
  onReviewComplete?: (review: HumanReview<TInput, TOutput>) => void;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Fallback mode on review timeout
   * @default TimeoutFallback.THROW
   */
  timeoutFallback?: TimeoutFallback;
}

/**
 * Common escalation rules for typical scenarios
 */
export const CommonEscalationRules = {
  /**
   * Escalate if confidence is low
   */
  lowConfidence: <T extends { confidence?: number }>(
    threshold: number = 0.7
  ): EscalationRule<any, T> => ({
    name: "low-confidence",
    shouldEscalate: (_, output) =>
      output?.confidence !== undefined && output.confidence < threshold,
    reason: EscalationReason.LOW_CONFIDENCE,
    priority: 5,
  }),

  /**
   * Escalate if sensitive keywords detected
   */
  sensitiveKeywords: (keywords: string[]): EscalationRule<string, any> => ({
    name: "sensitive-keywords",
    shouldEscalate: (input) => {
      const inputLower = input.toLowerCase();
      return keywords.some((keyword) =>
        inputLower.includes(keyword.toLowerCase())
      );
    },
    reason: EscalationReason.KEYWORD_DETECTED,
    priority: 10,
  }),

  /**
   * Escalate on error
   */
  onError: (): EscalationRule<any, any> => ({
    name: "on-error",
    shouldEscalate: (_, __, error) => error !== undefined,
    reason: EscalationReason.ERROR,
    priority: 8,
  }),

  /**
   * Custom escalation rule
   */
  custom: <TInput, TOutput>(
    name: string,
    fn: (input: TInput, output?: TOutput) => boolean | Promise<boolean>,
    priority: number = 5
  ): EscalationRule<TInput, TOutput> => ({
    name,
    shouldEscalate: fn,
    reason: EscalationReason.CUSTOM,
    priority,
  }),
};
