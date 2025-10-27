/**
 * Error handling system for ai-patterns
 */

/**
 * Error codes for all patterns
 */
export enum ErrorCode {
  // Retry errors
  MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED",
  INVALID_MAX_ATTEMPTS = "INVALID_MAX_ATTEMPTS",
  NON_RETRYABLE_ERROR = "NON_RETRYABLE_ERROR",

  // Timeout errors
  TIMEOUT = "TIMEOUT",
  INVALID_TIMEOUT = "INVALID_TIMEOUT",
  ABORTED = "ABORTED",

  // Circuit Breaker errors
  CIRCUIT_OPEN = "CIRCUIT_OPEN",
  CIRCUIT_INVALID_CONFIG = "CIRCUIT_INVALID_CONFIG",

  // Rate Limiter errors
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_RATE_LIMIT_STRATEGY = "INVALID_RATE_LIMIT_STRATEGY",
  INVALID_RATE_LIMIT_CONFIG = "INVALID_RATE_LIMIT_CONFIG",

  // Fan-Out errors
  FAN_OUT_PARTIAL_FAILURE = "FAN_OUT_PARTIAL_FAILURE",
  INVALID_CONCURRENCY = "INVALID_CONCURRENCY",

  // Saga errors
  SAGA_STEP_FAILED = "SAGA_STEP_FAILED",
  SAGA_STEP_TIMEOUT = "SAGA_STEP_TIMEOUT",
  SAGA_COMPENSATION_FAILED = "SAGA_COMPENSATION_FAILED",

  // Human-in-the-Loop errors
  REVIEW_TIMEOUT = "REVIEW_TIMEOUT",
  NO_AI_OUTPUT = "NO_AI_OUTPUT",
  ESCALATION_FAILED = "ESCALATION_FAILED",

  // Idempotency errors
  CONCURRENT_REQUEST = "CONCURRENT_REQUEST",
  WAIT_TIMEOUT = "WAIT_TIMEOUT",
  REQUEST_FAILED = "REQUEST_FAILED",
  INVALID_IDEMPOTENCY_KEY = "INVALID_IDEMPOTENCY_KEY",

  // Conditional Branch errors
  NO_MATCHING_BRANCH = "NO_MATCHING_BRANCH",

  // Generic errors
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  OPERATION_FAILED = "OPERATION_FAILED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Resolution strategies for common errors
 */
interface ErrorResolution {
  /**
   * What went wrong
   */
  problem: string;

  /**
   * Why it happened
   */
  cause: string;

  /**
   * How to fix it
   */
  solution: string;

  /**
   * Additional context or tips
   */
  tips?: string[];
}

/**
 * Error resolution mapping
 */
const ERROR_RESOLUTIONS: Record<ErrorCode, ErrorResolution> = {
  // Retry errors
  [ErrorCode.MAX_RETRIES_EXCEEDED]: {
    problem: "Operation failed after all retry attempts were exhausted",
    cause: "The operation continued to fail despite multiple retry attempts",
    solution:
      "1. Check if the underlying service is available\n2. Increase maxAttempts if failures are temporary\n3. Review the shouldRetry function to ensure it's not retrying permanent errors\n4. Check network connectivity and service health",
    tips: [
      "Use exponential backoff for better retry distribution",
      "Implement a circuit breaker for failing services",
      "Log the underlying errors to identify patterns",
    ],
  },

  [ErrorCode.INVALID_MAX_ATTEMPTS]: {
    problem: "Invalid retry configuration",
    cause: "maxAttempts must be at least 1",
    solution: "Set maxAttempts to a positive integer (recommended: 3-5)",
    tips: ["Common values: 3 for quick operations, 5-10 for important operations"],
  },

  [ErrorCode.NON_RETRYABLE_ERROR]: {
    problem: "Operation failed with a non-retryable error",
    cause: "The shouldRetry function determined this error cannot be recovered",
    solution:
      "1. Review the error to determine if it's a permanent failure\n2. Fix the root cause (e.g., invalid input, authentication, permissions)\n3. Update your shouldRetry logic if needed",
    tips: [
      "Common non-retryable errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden",
      "Retryable errors: 429 Rate Limit, 500 Internal Server Error, 503 Service Unavailable",
    ],
  },

  // Timeout errors
  [ErrorCode.TIMEOUT]: {
    problem: "Operation exceeded the maximum allowed time",
    cause: "The operation took longer than the configured timeout",
    solution:
      "1. Increase the timeout value if the operation legitimately needs more time\n2. Optimize the operation to complete faster\n3. Check for network issues or slow external services\n4. Consider using pagination or chunking for large operations",
    tips: [
      "Typical timeouts: API calls 10-30s, LLM calls 30-60s, batch operations 5-10 minutes",
      "Use AbortSignal for clean cancellation",
      "Combine with retry pattern for better resilience",
    ],
  },

  [ErrorCode.INVALID_TIMEOUT]: {
    problem: "Invalid timeout configuration",
    cause: "Timeout value must be greater than 0",
    solution: "Set timeoutMs to a positive number in milliseconds",
    tips: ["Common values: 10000 (10s), 30000 (30s), 60000 (1 minute)"],
  },

  [ErrorCode.ABORTED]: {
    problem: "Operation was cancelled before it could complete",
    cause: "An AbortSignal was triggered before the operation started or during execution",
    solution:
      "1. Check if the cancellation was intentional\n2. Review abort signal sources\n3. Ensure signal isn't being triggered prematurely",
  },

  // Circuit Breaker errors
  [ErrorCode.CIRCUIT_OPEN]: {
    problem: "Circuit breaker is open - requests are being blocked",
    cause: "Too many failures occurred, causing the circuit breaker to open",
    solution:
      "1. Wait for the openDuration to elapse (circuit will auto-transition to half-open)\n2. Check the health of the downstream service\n3. Review circuit breaker stats to understand failure patterns\n4. Consider calling reset() manually if the service is confirmed healthy",
    tips: [
      "The circuit will automatically attempt recovery after openDuration",
      "Monitor circuit state transitions for insights",
      "Adjust failureThreshold based on acceptable error rate",
    ],
  },

  [ErrorCode.CIRCUIT_INVALID_CONFIG]: {
    problem: "Invalid circuit breaker configuration",
    cause: "Configuration values are out of acceptable range",
    solution:
      "Ensure: failureThreshold ≥ 1, openDuration > 0, halfOpenMaxAttempts ≥ 1",
    tips: [
      "Recommended: failureThreshold=5, openDuration=60000, halfOpenMaxAttempts=1",
    ],
  },

  // Rate Limiter errors
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    problem: "Rate limit exceeded - too many requests",
    cause: "The number of requests exceeded the configured limit for the time window",
    solution:
      "1. Wait for the time window to reset (check retryAfter value)\n2. Use executeWithWait() to automatically wait and retry\n3. Reduce request rate\n4. Increase maxRequests if legitimate traffic requires it\n5. Implement request queuing or batching",
    tips: [
      "Use token-bucket strategy for burst tolerance",
      "Implement exponential backoff for retries",
      "Monitor rate limit stats to optimize limits",
    ],
  },

  [ErrorCode.INVALID_RATE_LIMIT_STRATEGY]: {
    problem: "Unknown rate limiting strategy",
    cause: "Strategy must be one of: sliding-window, fixed-window, or token-bucket",
    solution: 'Set strategy to "sliding-window", "fixed-window", or "token-bucket"',
    tips: [
      "sliding-window: Most accurate, higher memory usage",
      "fixed-window: Simple, potential burst at window boundaries",
      "token-bucket: Best for handling bursts",
    ],
  },

  [ErrorCode.INVALID_RATE_LIMIT_CONFIG]: {
    problem: "Invalid rate limiter configuration",
    cause: "Configuration values are out of acceptable range",
    solution: "Ensure: maxRequests > 0, windowMs > 0, refillRate > 0 (for token-bucket)",
  },

  // Fan-Out errors
  [ErrorCode.FAN_OUT_PARTIAL_FAILURE]: {
    problem: "Some fan-out operations failed",
    cause: "One or more parallel operations encountered errors",
    solution:
      "1. Check the errors map in the result for specific failures\n2. Review failed items and determine if they can be retried\n3. Set continueOnError=true to process all items despite failures\n4. Implement error handling for individual items",
    tips: [
      "Use result.errors to identify which items failed",
      "Consider retry pattern for failed items",
      "Monitor successRate to detect systemic issues",
    ],
  },

  [ErrorCode.INVALID_CONCURRENCY]: {
    problem: "Invalid concurrency configuration",
    cause: "Concurrency must be a positive number or Infinity",
    solution: "Set concurrency to a positive integer (e.g., 5, 10, 20) or Infinity",
    tips: [
      "Start with concurrency=10 and adjust based on system capacity",
      "Higher concurrency = faster but more resource usage",
      "Consider system limits (file handles, connections, memory)",
    ],
  },

  // Saga errors
  [ErrorCode.SAGA_STEP_FAILED]: {
    problem: "A saga step failed during execution",
    cause: "The step's execute function threw an error",
    solution:
      "1. Check the specific error message for details\n2. Review the failed step's implementation\n3. Compensation will automatically run for completed steps\n4. Fix the underlying issue and retry the saga",
    tips: [
      "Implement proper error handling in step functions",
      "Use step conditions to skip unnecessary steps",
      "Add step timeouts for long-running operations",
    ],
  },

  [ErrorCode.SAGA_STEP_TIMEOUT]: {
    problem: "A saga step exceeded its timeout",
    cause: "The step took longer than the configured timeout",
    solution:
      "1. Increase the step's timeout value\n2. Optimize the step's operation\n3. Consider splitting into smaller steps",
    tips: ["Set timeouts appropriate for each step's complexity"],
  },

  [ErrorCode.SAGA_COMPENSATION_FAILED]: {
    problem: "Compensation (rollback) failed for a step",
    cause: "The compensate function threw an error",
    solution:
      "1. Review compensation logs for details\n2. Fix the compensation logic\n3. Implement idempotent compensation\n4. Consider manual intervention for critical operations",
    tips: [
      "Compensation functions should be idempotent",
      "Log compensation failures for manual review",
      "Keep compensation logic simple and reliable",
    ],
  },

  // Human-in-the-Loop errors
  [ErrorCode.REVIEW_TIMEOUT]: {
    problem: "Human review request timed out",
    cause: "No human response within the configured review timeout",
    solution:
      "1. Increase reviewTimeout if more time is needed\n2. Set timeoutFallback='use-ai' to use AI output as fallback\n3. Set timeoutFallback='retry' to request review again\n4. Implement notifications to alert reviewers faster",
    tips: [
      "Default timeout: 5 minutes - adjust based on SLA",
      "Monitor pending reviews to identify bottlenecks",
      "Consider escalation tiers for critical reviews",
    ],
  },

  [ErrorCode.NO_AI_OUTPUT]: {
    problem: "No AI output available after timeout",
    cause: "Review timed out and no AI output exists to fall back to",
    solution:
      "1. Ensure the AI function completes before escalation\n2. Store AI output even when escalating\n3. Use timeoutFallback='throw' or 'retry' instead",
  },

  [ErrorCode.ESCALATION_FAILED]: {
    problem: "Failed to escalate to human review",
    cause: "The requestHumanReview function threw an error",
    solution:
      "1. Check the requestHumanReview implementation\n2. Verify review system connectivity\n3. Implement retry logic for review requests",
    tips: ["Log escalation failures for monitoring"],
  },

  // Idempotency errors
  [ErrorCode.CONCURRENT_REQUEST]: {
    problem: "Another request with the same idempotency key is in progress",
    cause: "Concurrent request detected with concurrentBehavior='reject'",
    solution:
      "1. Wait and retry the request\n2. Set concurrentBehavior='wait' to automatically wait\n3. Use a different idempotency key if requests should be treated separately",
    tips: [
      "Use 'wait' behavior for better user experience",
      "Ensure idempotency keys are unique per logical operation",
    ],
  },

  [ErrorCode.WAIT_TIMEOUT]: {
    problem: "Timeout while waiting for concurrent request to complete",
    cause: "Waited too long for another request with the same key to finish",
    solution:
      "1. Increase waitTimeout value\n2. Check if the concurrent request is stuck\n3. Investigate the slow operation",
    tips: ["Default wait timeout: 30s"],
  },

  [ErrorCode.REQUEST_FAILED]: {
    problem: "The original request failed",
    cause: "The function execution threw an error",
    solution: "Review the original error and fix the underlying issue",
  },

  [ErrorCode.INVALID_IDEMPOTENCY_KEY]: {
    problem: "Invalid idempotency key generated",
    cause: "The keyGenerator function produced an invalid key",
    solution:
      "1. Review keyGenerator implementation\n2. Ensure it returns consistent keys for same inputs\n3. Keys should be strings and unique per operation",
  },

  // Conditional Branch errors
  [ErrorCode.NO_MATCHING_BRANCH]: {
    problem: "No branch condition matched the input",
    cause: "All branch conditions evaluated to false and no default branch was provided",
    solution:
      "1. Add a default branch to handle unmatched cases\n2. Review branch conditions to ensure they cover all expected inputs\n3. Add a catch-all condition as the last branch",
    tips: [
      "Use defaultBranch for fallback behavior",
      "Ensure at least one condition can match",
      "Consider logging unmatched inputs for debugging",
    ],
  },

  // Generic errors
  [ErrorCode.INVALID_CONFIGURATION]: {
    problem: "Invalid pattern configuration",
    cause: "One or more configuration values are invalid",
    solution: "Review the error message for specific validation failures",
  },

  [ErrorCode.OPERATION_FAILED]: {
    problem: "Operation failed",
    cause: "The operation encountered an error during execution",
    solution: "Review the underlying error for details",
  },

  [ErrorCode.UNKNOWN_ERROR]: {
    problem: "An unknown error occurred",
    cause: "An unexpected error was encountered",
    solution: "Review logs and stack trace for details",
  },
};

/**
 * Enhanced error class with resolution guidance
 */
export class PatternError extends Error {
  /**
   * Error code
   */
  public readonly code: ErrorCode;

  /**
   * Original cause (if any)
   */
  public readonly cause?: Error;

  /**
   * Resolution guidance
   */
  public readonly resolution: ErrorResolution;

  /**
   * Additional metadata
   */
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode,
    cause?: Error,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = "PatternError";
    this.code = code;
    this.cause = cause;
    this.resolution = ERROR_RESOLUTIONS[code] || ERROR_RESOLUTIONS[ErrorCode.UNKNOWN_ERROR];
    this.metadata = metadata;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PatternError);
    }
  }

  /**
   * Get a formatted error message with resolution
   */
  toString(): string {
    let output = `${this.name} [${this.code}]: ${this.message}\n\n`;

    output += `Problem: ${this.resolution.problem}\n`;
    output += `Cause: ${this.resolution.cause}\n\n`;
    output += `Solution:\n${this.resolution.solution}\n`;

    if (this.resolution.tips && this.resolution.tips.length > 0) {
      output += `\nTips:\n${this.resolution.tips.map((tip) => `  • ${tip}`).join("\n")}\n`;
    }

    if (this.cause) {
      output += `\nUnderlying error: ${this.cause.message}\n`;
    }

    if (this.metadata) {
      output += `\nMetadata: ${JSON.stringify(this.metadata, null, 2)}\n`;
    }

    return output;
  }

  /**
   * Get structured error info
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      resolution: this.resolution,
      metadata: this.metadata,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
          }
        : undefined,
    };
  }
}
