/**
 * Types for Response Validation Pattern
 */

import type { Logger } from "./common";

/**
 * Validator function that checks if a response meets certain criteria
 */
export interface ResponseValidator<TResponse> {
  /** Name of the validator for logging and debugging */
  name: string;
  /** Validation function that returns true if valid, false otherwise */
  validate: (response: TResponse) => boolean | Promise<boolean>;
  /** Error message to show when validation fails */
  errorMessage: string;
  /** Priority level (higher = runs first). Default: 0 */
  priority?: number;
  /** Whether to stop validation chain on failure. Default: false */
  stopOnFailure?: boolean;
}

/**
 * Validation failure information
 */
export interface ValidationFailure {
  /** Name of the validator that failed */
  validatorName: string;
  /** Error message from the validator */
  errorMessage: string;
  /** Timestamp of the failure */
  timestamp: number;
  /** Attempt number when this failure occurred */
  attempt: number;
}

/**
 * Result of validation
 */
export interface ValidationResult<TResponse> {
  /** Whether validation passed */
  valid: boolean;
  /** The validated response (only present if valid) */
  response?: TResponse;
  /** List of validation failures */
  failures: ValidationFailure[];
  /** Number of validators that passed */
  passedCount: number;
  /** Total number of validators */
  totalCount: number;
}

/**
 * Configuration for response validation
 */
export interface ValidateResponseConfig<TResponse> {
  /** Function that executes and returns a response to validate */
  execute: () => Promise<TResponse> | TResponse;
  /** List of validators to apply */
  validators: ResponseValidator<TResponse>[];
  /** Maximum number of retries if validation fails. Default: 0 */
  maxRetries?: number;
  /** Delay between retries in milliseconds. Default: 0 */
  retryDelayMs?: number;
  /** Whether to run validators in parallel. Default: false */
  parallel?: boolean;
  /** Callback when a validation fails */
  onValidationFailed?: (
    validator: ResponseValidator<TResponse>,
    attempt: number,
    response: TResponse
  ) => void | Promise<void>;
  /** Callback when a specific validator passes */
  onValidatorPassed?: (
    validator: ResponseValidator<TResponse>,
    response: TResponse
  ) => void | Promise<void>;
  /** Callback when all validations pass */
  onValidationSuccess?: (
    response: TResponse,
    result: ValidationResult<TResponse>
  ) => void | Promise<void>;
  /** Callback when all retries are exhausted */
  onAllRetriesFailed?: (
    failures: ValidationFailure[]
  ) => TResponse | Promise<TResponse>;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Result from validateResponse execution
 */
export interface ValidateResponseResult<TResponse> {
  /** The validated response */
  value: TResponse;
  /** Validation result details */
  validation: ValidationResult<TResponse>;
  /** Number of attempts made */
  attempts: number;
  /** Whether the response came from fallback */
  isFallback: boolean;
  /** Timestamp of completion */
  timestamp: number;
}
