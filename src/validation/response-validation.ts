/**
 * Response Validation Pattern
 *
 * Automatically validates AI responses against business rules, schemas, or quality criteria.
 * Retries execution if validation fails, with configurable fallback behavior.
 *
 * @example
 * ```typescript
 * const result = await validateResponse({
 *   execute: async () => {
 *     const { object } = await generateObject({
 *       model: openai('gpt-4-turbo'),
 *       schema: z.object({
 *         name: z.string(),
 *         price: z.number()
 *       }),
 *       prompt: 'Generate a product'
 *     });
 *     return object;
 *   },
 *   validators: [
 *     {
 *       name: 'price-range',
 *       validate: (response) => response.price > 0 && response.price < 10000,
 *       errorMessage: 'Price must be between $0 and $10,000'
 *     }
 *   ],
 *   maxRetries: 3
 * });
 * ```
 */

import type {
  ValidateResponseConfig,
  ValidateResponseResult,
  ValidationResult,
  ValidationFailure,
  ResponseValidator,
} from "../types/response-validation";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";

/**
 * Run validators on a response
 */
async function runValidation<TResponse>(
  response: TResponse,
  validators: ResponseValidator<TResponse>[],
  attempt: number,
  config: ValidateResponseConfig<TResponse>
): Promise<ValidationResult<TResponse>> {
  const { parallel = false, onValidationFailed, onValidatorPassed, logger = defaultLogger } = config;

  // Sort validators by priority (higher priority first)
  const sortedValidators = [...validators].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  const failures: ValidationFailure[] = [];
  let passedCount = 0;
  let shouldStop = false;

  if (parallel) {
    // Run all validators in parallel
    const results = await Promise.all(
      sortedValidators.map(async (validator) => {
        try {
          const isValid = await validator.validate(response);
          return { validator, isValid };
        } catch (error) {
          logger.error(`Validator "${validator.name}" threw an error`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return { validator, isValid: false };
        }
      })
    );

    for (const { validator, isValid } of results) {
      if (isValid) {
        passedCount++;
        if (onValidatorPassed) {
          await onValidatorPassed(validator, response);
        }
      } else {
        failures.push({
          validatorName: validator.name,
          errorMessage: validator.errorMessage,
          timestamp: Date.now(),
          attempt,
        });

        if (onValidationFailed) {
          await onValidationFailed(validator, attempt, response);
        }

        logger.warn(`Validation failed: ${validator.name}`, {
          message: validator.errorMessage,
          attempt,
        });
      }
    }
  } else {
    // Run validators sequentially
    for (const validator of sortedValidators) {
      if (shouldStop) break;

      try {
        const isValid = await validator.validate(response);

        if (isValid) {
          passedCount++;
          if (onValidatorPassed) {
            await onValidatorPassed(validator, response);
          }
        } else {
          failures.push({
            validatorName: validator.name,
            errorMessage: validator.errorMessage,
            timestamp: Date.now(),
            attempt,
          });

          if (onValidationFailed) {
            await onValidationFailed(validator, attempt, response);
          }

          logger.warn(`Validation failed: ${validator.name}`, {
            message: validator.errorMessage,
            attempt,
          });

          if (validator.stopOnFailure) {
            shouldStop = true;
          }
        }
      } catch (error) {
        logger.error(`Validator "${validator.name}" threw an error`, {
          error: error instanceof Error ? error.message : String(error),
        });

        failures.push({
          validatorName: validator.name,
          errorMessage: `Validator error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
          attempt,
        });

        if (validator.stopOnFailure) {
          shouldStop = true;
        }
      }
    }
  }

  const valid = failures.length === 0;

  return {
    valid,
    response: valid ? response : undefined,
    failures,
    passedCount,
    totalCount: validators.length,
  };
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate a response against a set of validators
 */
export async function validateResponse<TResponse>(
  config: ValidateResponseConfig<TResponse>
): Promise<ValidateResponseResult<TResponse>> {
  const {
    execute,
    validators,
    maxRetries = 0,
    retryDelayMs = 0,
    onValidationSuccess,
    onAllRetriesFailed,
    logger = defaultLogger,
  } = config;

  // Validate configuration
  if (!validators || validators.length === 0) {
    throw new PatternError(
      "At least one validator is required",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  let attempt = 0;
  const maxAttempts = maxRetries + 1;
  const allFailures: ValidationFailure[] = [];

  while (attempt < maxAttempts) {
    attempt++;

    logger.debug(`Validation attempt ${attempt}/${maxAttempts}`);

    try {
      // Execute the function
      const response = await execute();

      // Run validators
      const validationResult = await runValidation(response, validators, attempt, config);

      if (validationResult.valid) {
        // Validation succeeded
        if (onValidationSuccess) {
          await onValidationSuccess(response, validationResult);
        }

        logger.info(`Validation succeeded on attempt ${attempt}`, {
          passedCount: validationResult.passedCount,
          totalCount: validationResult.totalCount,
        });

        return {
          value: response,
          validation: validationResult,
          attempts: attempt,
          isFallback: false,
          timestamp: Date.now(),
        };
      }

      // Validation failed
      allFailures.push(...validationResult.failures);

      logger.warn(`Validation failed on attempt ${attempt}`, {
        failureCount: validationResult.failures.length,
        passedCount: validationResult.passedCount,
        totalCount: validationResult.totalCount,
      });

      // Check if we should retry
      if (attempt < maxAttempts) {
        if (retryDelayMs > 0) {
          logger.debug(`Waiting ${retryDelayMs}ms before retry`);
          await delay(retryDelayMs);
        }
      }
    } catch (error) {
      const execError = error instanceof Error ? error : new Error(String(error));

      logger.error(`Execution failed on attempt ${attempt}`, {
        error: execError.message,
      });

      // If execution itself fails, we should retry (if retries remain)
      if (attempt < maxAttempts) {
        if (retryDelayMs > 0) {
          await delay(retryDelayMs);
        }
        continue;
      }

      // No more retries, throw the error
      throw new PatternError(
        `Response validation execution failed after ${attempt} attempts: ${execError.message}`,
        ErrorCode.EXECUTION_FAILED,
        execError,
        { attempts: attempt, failures: allFailures }
      );
    }
  }

  // All retries exhausted
  logger.error(`All validation attempts failed`, {
    attempts: maxAttempts,
    totalFailures: allFailures.length,
  });

  // Try fallback if provided
  if (onAllRetriesFailed) {
    logger.info("Attempting fallback response");

    try {
      const fallbackResponse = await onAllRetriesFailed(allFailures);

      // Validate the fallback response
      const fallbackValidation = await runValidation(
        fallbackResponse,
        validators,
        attempt + 1,
        config
      );

      if (!fallbackValidation.valid) {
        logger.warn("Fallback response also failed validation", {
          failures: fallbackValidation.failures.length,
        });
      }

      return {
        value: fallbackResponse,
        validation: fallbackValidation,
        attempts: maxAttempts,
        isFallback: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const fallbackError = error instanceof Error ? error : new Error(String(error));
      logger.error("Fallback handler failed", { error: fallbackError.message });

      throw new PatternError(
        `Validation failed after ${maxAttempts} attempts and fallback failed: ${fallbackError.message}`,
        ErrorCode.ALL_RETRIES_FAILED,
        fallbackError,
        { attempts: maxAttempts, failures: allFailures }
      );
    }
  }

  // No fallback, throw error
  throw new PatternError(
    `Response validation failed after ${maxAttempts} attempts`,
    ErrorCode.ALL_RETRIES_FAILED,
    undefined,
    {
      attempts: maxAttempts,
      failures: allFailures,
      failedValidators: allFailures.map((f) => f.validatorName),
    }
  );
}
