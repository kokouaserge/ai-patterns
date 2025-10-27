/**
 * Human-in-the-Loop Pattern - AI → Human escalation
 */

import { AsyncFunction, Logger, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import {
  EscalationReason,
  ReviewStatus,
  TimeoutFallback,
  EscalationRule,
  HumanReview,
  HumanInTheLoopOptions,
  HumanInTheLoopResult,
  CommonEscalationRules,
} from "../types/human-in-the-loop";

export { CommonEscalationRules };

/**
 * Internal options (without execute and input)
 */
interface HumanInTheLoopInternalOptions<TInput = any, TOutput = any> {
  escalationRules?: EscalationRule<TInput, TOutput>[];
  reviewTimeout?: number;
  requestHumanReview: (
    review: HumanReview<TInput, TOutput>
  ) => Promise<TOutput>;
  onEscalate?: (review: HumanReview<TInput, TOutput>) => void;
  onReviewComplete?: (review: HumanReview<TInput, TOutput>) => void;
  logger?: Logger;
  timeoutFallback?: TimeoutFallback;
}

/**
 * Human-in-the-Loop - Enables AI → Human escalation (internal class)
 */
export class HumanInTheLoop<TInput = any, TOutput = any> {
  private reviews = new Map<string, HumanReview<TInput, TOutput>>();
  private reviewCounter = 0;

  constructor(
    private readonly aiFn: AsyncFunction<TOutput, [TInput]>,
    private readonly options: HumanInTheLoopInternalOptions<TInput, TOutput>
  ) {}

  /**
   * Execute AI function with possible escalation
   */
  async execute(input: TInput): Promise<TOutput> {
    const logger = this.options.logger ?? defaultLogger;
    let aiOutput: TOutput | undefined;
    let error: Error | undefined;

    // Try to execute AI function
    try {
      aiOutput = await this.aiFn(input);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      logger.warn("Error during AI execution", { error: error.message });
    }

    // Check escalation rules
    const escalationRule = await this.checkEscalationRules(
      input,
      aiOutput,
      error
    );

    if (escalationRule) {
      logger.info(`Escalation triggered: ${escalationRule.name}`);

      // Create review
      const review = this.createReview(input, aiOutput, escalationRule.reason);

      if (this.options.onEscalate) {
        this.options.onEscalate(review);
      }

      // Request human review
      const humanOutput = await this.requestReview(review);

      if (this.options.onReviewComplete) {
        this.options.onReviewComplete(review);
      }

      return humanOutput;
    }

    // No escalation, return AI output (or throw error)
    if (error) {
      throw error;
    }

    return aiOutput!;
  }

  /**
   * Check escalation rules
   */
  private async checkEscalationRules(
    input: TInput,
    output?: TOutput,
    error?: Error
  ): Promise<EscalationRule<TInput, TOutput> | null> {
    const rules = this.options.escalationRules ?? [];

    // Sort by priority
    const sortedRules = [...rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );

    for (const rule of sortedRules) {
      const shouldEscalate = await rule.shouldEscalate(input, output, error);
      if (shouldEscalate) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Create a review
   */
  private createReview(
    input: TInput,
    aiOutput: TOutput | undefined,
    reason: EscalationReason
  ): HumanReview<TInput, TOutput> {
    const id = `review-${++this.reviewCounter}-${Date.now()}`;

    const review: HumanReview<TInput, TOutput> = {
      id,
      input,
      aiOutput,
      reason,
      createdAt: Date.now(),
      status: ReviewStatus.PENDING,
    };

    this.reviews.set(id, review);
    return review;
  }

  /**
   * Request human review with timeout
   */
  private async requestReview(
    review: HumanReview<TInput, TOutput>
  ): Promise<TOutput> {
    const logger = this.options.logger ?? defaultLogger;
    const timeout = this.options.reviewTimeout ?? 300000;
    const timeoutFallback =
      this.options.timeoutFallback ?? TimeoutFallback.THROW;

    try {
      const humanOutput = await Promise.race([
        this.options.requestHumanReview(review),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new PatternError(
                  `Review timeout after ${timeout}ms`,
                  ErrorCode.REVIEW_TIMEOUT,
                  undefined,
                  { timeout, reviewId: review.id }
                )
              ),
            timeout
          )
        ),
      ]);

      review.status = ReviewStatus.APPROVED;
      review.humanOutput = humanOutput;
      review.resolvedAt = Date.now();

      logger.info(`Review ${review.id} completed`);
      return humanOutput;
    } catch (error) {
      if (error instanceof PatternError && error.code === ErrorCode.REVIEW_TIMEOUT) {
        logger.warn(`Review ${review.id} timed out`);

        switch (timeoutFallback) {
          case TimeoutFallback.USE_AI:
            if (review.aiOutput !== undefined) {
              logger.info("Using AI output after timeout");
              return review.aiOutput;
            }
            throw new PatternError(
              "No AI output available after timeout",
              ErrorCode.NO_AI_OUTPUT
            );

          case TimeoutFallback.RETRY:
            logger.info("Retrying review request");
            return this.requestReview(review);

          case TimeoutFallback.THROW:
          default:
            throw error;
        }
      }

      throw error;
    }
  }

  /**
   * Get all reviews
   */
  getReviews(): HumanReview<TInput, TOutput>[] {
    return Array.from(this.reviews.values());
  }

  /**
   * Get review by ID
   */
  getReview(id: string): HumanReview<TInput, TOutput> | undefined {
    return this.reviews.get(id);
  }

  /**
   * Get pending reviews
   */
  getPendingReviews(): HumanReview<TInput, TOutput>[] {
    return this.getReviews().filter((r) => r.status === ReviewStatus.PENDING);
  }
}

/**
 * Human-in-the-Loop Pattern with single parameter API
 */
export async function humanInTheLoop<TInput = any, TOutput = any>(
  options: HumanInTheLoopOptions<TInput, TOutput>
): Promise<HumanInTheLoopResult<TOutput>> {
  const {
    execute: aiFn,
    input,
    escalationRules = [],
    reviewTimeout = 300000,
    requestHumanReview,
    onEscalate,
    onReviewComplete,
    logger = defaultLogger,
    timeoutFallback = TimeoutFallback.THROW,
  } = options;

  let aiOutput: TOutput | undefined;
  let error: Error | undefined;

  // Try to execute AI function
  try {
    aiOutput = await aiFn();
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Error during AI execution", { error: error.message });
  }

  // Check escalation rules
  const escalationRule = await checkEscalationRules(
    input,
    aiOutput,
    error,
    escalationRules
  );

  if (escalationRule) {
    logger.info(`Escalation triggered: ${escalationRule.name}`);

    // Create review
    const review = createReview(input, aiOutput, escalationRule.reason);

    if (onEscalate) {
      onEscalate(review);
    }

    // Request human review
    const humanOutput = await requestReviewWithTimeout(
      review,
      requestHumanReview,
      reviewTimeout,
      timeoutFallback,
      logger
    );

    if (onReviewComplete) {
      onReviewComplete(review);
    }

    return {
      value: humanOutput,
      escalated: true,
      escalationReason: escalationRule.reason,
    };
  }

  // No escalation, return AI output (or throw error)
  if (error) {
    throw error;
  }

  return {
    value: aiOutput!,
    escalated: false,
  };
}

/**
 * Check escalation rules
 */
async function checkEscalationRules<TInput, TOutput>(
  input: TInput | undefined,
  output: TOutput | undefined,
  error: Error | undefined,
  rules: EscalationRule<TInput, TOutput>[]
): Promise<EscalationRule<TInput, TOutput> | null> {
  // Sort by priority
  const sortedRules = [...rules].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  for (const rule of sortedRules) {
    const shouldEscalate = await rule.shouldEscalate(input as TInput, output, error);
    if (shouldEscalate) {
      return rule;
    }
  }

  return null;
}

/**
 * Create a review
 */
let reviewCounter = 0;
function createReview<TInput, TOutput>(
  input: TInput | undefined,
  aiOutput: TOutput | undefined,
  reason: EscalationReason
): HumanReview<TInput, TOutput> {
  const id = `review-${++reviewCounter}-${Date.now()}`;

  return {
    id,
    input: input as TInput,
    aiOutput,
    reason,
    createdAt: Date.now(),
    status: ReviewStatus.PENDING,
  };
}

/**
 * Request human review with timeout
 */
async function requestReviewWithTimeout<TInput, TOutput>(
  review: HumanReview<TInput, TOutput>,
  requestHumanReview: (review: HumanReview<TInput, TOutput>) => Promise<TOutput>,
  timeout: number,
  timeoutFallback: TimeoutFallback,
  logger: Logger
): Promise<TOutput> {
  try {
    const humanOutput = await Promise.race([
      requestHumanReview(review),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new PatternError(
                `Review timeout after ${timeout}ms`,
                ErrorCode.REVIEW_TIMEOUT,
                undefined,
                { timeout, reviewId: review.id }
              )
            ),
          timeout
        )
      ),
    ]);

    review.status = ReviewStatus.APPROVED;
    review.humanOutput = humanOutput;
    review.resolvedAt = Date.now();

    logger.info(`Review ${review.id} completed`);
    return humanOutput;
  } catch (error) {
    if (
      error instanceof PatternError &&
      error.code === ErrorCode.REVIEW_TIMEOUT
    ) {
      logger.warn(`Review ${review.id} timed out`);

      switch (timeoutFallback) {
        case TimeoutFallback.USE_AI:
          if (review.aiOutput !== undefined) {
            logger.info("Using AI output after timeout");
            return review.aiOutput;
          }
          throw new PatternError(
            "No AI output available after timeout",
            ErrorCode.NO_AI_OUTPUT
          );

        case TimeoutFallback.RETRY:
          logger.info("Retrying review request");
          return requestReviewWithTimeout(
            review,
            requestHumanReview,
            timeout,
            timeoutFallback,
            logger
          );

        case TimeoutFallback.THROW:
        default:
          throw error;
      }
    }

    throw error;
  }
}
