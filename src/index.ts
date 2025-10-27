/**
 * ai-patterns - Battle-tested TypeScript patterns for building robust AI workflows
 * @author Serge KOKOUA
 * @version 1.0.0
 */

// ===== All Types =====
export * from "./types";

// ===== Resilience Patterns =====

// Retry Pattern
export { retry, RetryPredicates } from "./resilience/retry";

// Timeout Pattern
export { timeout, createTimeoutSignal, combineSignals } from "./resilience/timeout";

// Circuit Breaker Pattern
export {
  CircuitBreaker,
  defineCircuitBreaker,
  circuitBreaker, // @deprecated - use defineCircuitBreaker
  CallableCircuitBreaker
} from "./resilience/circuit-breaker";

// ===== Rate Limiting =====

// Rate Limiter Pattern
export {
  RateLimiter,
  defineRateLimiter,
  rateLimiter, // @deprecated - use defineRateLimiter
  CallableRateLimiter
} from "./rate-limiting/rate-limiter";

// ===== Orchestration Patterns =====

// Fan-Out Pattern
export { fanOut } from "./orchestration/fan-out";

// Saga Pattern
export { Saga, executeSaga } from "./orchestration/saga";

// ===== AI Patterns =====

// Human-in-the-Loop Pattern
export { HumanInTheLoop, humanInTheLoop, CommonEscalationRules } from "./ai/human-in-the-loop";

// ===== Consistency Patterns =====

// Idempotency Pattern
export { Idempotency, idempotent, Idempotent } from "./consistency/idempotency";

// ===== New Resilience Patterns =====

// Fallback Pattern
export { fallback } from "./resilience/fallback";

// Bulkhead Pattern
export { defineBulkhead, bulkhead } from "./resilience/bulkhead";

// ===== Timing Patterns =====

export { defineDebounce, debounce } from "./timing/debounce";
export { defineThrottle, throttle } from "./timing/throttle";

// ===== Caching Patterns =====

export { memoize } from "./caching/memoize";

// ===== Queue Patterns =====

export { deadLetterQueue } from "./queuing/dead-letter-queue";

// ===== Orchestration Patterns (Additional) =====

export { conditionalBranch } from "./orchestration/conditional-branch";

// ===== Composition =====

export { compose } from "./composition/compose";
export type { Middleware, ComposeConfig } from "./composition/compose";

// Middleware adapters for composition
export * from "./composition/middleware";

// ===== Version =====
export const VERSION = "1.0.0";
