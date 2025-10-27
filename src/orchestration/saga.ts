/**
 * Saga Pattern - Distributed transaction orchestration with compensation
 */

import { MaybePromise, Logger, defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import { SagaOptions, SagaResult, SagaStep } from "../types/saga";

/**
 * Internal options for saga execution (without context and steps)
 */
interface SagaInternalOptions<TContext = any> {
  logger?: Logger;
  onStepStart?: (stepName: string, index: number) => void;
  onStepComplete?: (stepName: string, result: unknown) => void;
  onStepFailed?: (stepName: string, error: Error) => void;
  onCompensate?: (stepName: string) => void;
  onComplete?: (context: TContext) => void;
  onFailure?: (error: Error, context: TContext) => void;
}

/**
 * Saga - Distributed transaction orchestrator
 */
export class Saga<TContext = any> {
  private steps: SagaStep<TContext>[] = [];
  private context: TContext;
  private logger: Logger;
  private options: SagaInternalOptions<TContext>;

  constructor(initialContext: TContext, options: SagaInternalOptions<TContext> = {}) {
    this.context = initialContext;
    this.logger = options.logger ?? defaultLogger;
    this.options = options;
  }

  /**
   * Add a step to the saga
   */
  addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps
   */
  addSteps(steps: SagaStep<TContext>[]): this {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Execute the saga
   */
  async execute(): Promise<SagaResult<TContext>> {
    const startTime = Date.now();
    const stepResults: unknown[] = [];
    const executedSteps: Array<{
      step: SagaStep<TContext>;
      result: unknown;
      index: number;
    }> = [];
    let compensatedSteps = 0;

    this.logger.info(`Starting saga with ${this.steps.length} step(s)`);

    try {
      // Execute each step
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];

        // Check condition
        if (step.condition) {
          const shouldExecute = await step.condition(this.context);
          if (!shouldExecute) {
            this.logger.debug(
              `Step ${i + 1} "${step.name}" skipped (condition not met)`
            );
            stepResults.push(null);
            continue;
          }
        }

        this.logger.info(`Step ${i + 1}/${this.steps.length}: ${step.name}`);

        if (this.options.onStepStart) {
          this.options.onStepStart(step.name, i);
        }

        try {
          // Execute with optional timeout
          const result = step.timeout
            ? await this.executeWithTimeout(step.execute, step.timeout)
            : await step.execute(this.context);

          stepResults.push(result);
          executedSteps.push({ step, result, index: i });

          this.logger.info(`Step ${i + 1} "${step.name}" completed`);

          if (this.options.onStepComplete) {
            this.options.onStepComplete(step.name, result);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          this.logger.error(`Step ${i + 1} "${step.name}" failed`, {
            error: err.message,
          });

          if (this.options.onStepFailed) {
            this.options.onStepFailed(step.name, err);
          }

          // Start compensation
          await this.compensate(executedSteps);
          compensatedSteps = executedSteps.filter((s) => s.step.compensate)
            .length;

          if (this.options.onFailure) {
            this.options.onFailure(err, this.context);
          }

          return {
            success: false,
            context: this.context,
            stepResults,
            completedSteps: i,
            compensatedSteps,
            error: err,
            duration: Date.now() - startTime,
          };
        }
      }

      // All steps completed
      this.logger.info("Saga completed successfully");

      if (this.options.onComplete) {
        this.options.onComplete(this.context);
      }

      return {
        success: true,
        context: this.context,
        stepResults,
        completedSteps: this.steps.length,
        compensatedSteps: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.logger.error("Saga failed", { error: err.message });

      return {
        success: false,
        context: this.context,
        stepResults,
        completedSteps: executedSteps.length,
        compensatedSteps: 0,
        error: err,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compensate executed steps (in reverse order)
   */
  private async compensate(
    executedSteps: Array<{
      step: SagaStep<TContext>;
      result: unknown;
      index: number;
    }>
  ): Promise<void> {
    this.logger.warn(`Compensating ${executedSteps.length} step(s)`);

    // Compensate in reverse order
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const { step, result, index } = executedSteps[i];

      if (!step.compensate) {
        this.logger.debug(`No compensation for step "${step.name}"`);
        continue;
      }

      try {
        this.logger.info(`Compensating step ${index + 1}: ${step.name}`);

        if (this.options.onCompensate) {
          this.options.onCompensate(step.name);
        }

        await step.compensate(this.context, result);

        this.logger.info(`Compensation for "${step.name}" succeeded`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Compensation failed for "${step.name}"`, {
          error: err.message,
        });
        // Continue compensation even on error
      }
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: (context: TContext) => MaybePromise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new PatternError(
            `Timeout after ${timeoutMs}ms`,
            ErrorCode.SAGA_STEP_TIMEOUT,
            undefined,
            { timeout: timeoutMs }
          )
        );
      }, timeoutMs);

      Promise.resolve(fn(this.context))
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get current context
   */
  getContext(): TContext {
    return this.context;
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<TContext>): void {
    this.context = { ...this.context, ...updates };
  }
}

/**
 * Execute a saga with single parameter API
 */
export async function executeSaga<TContext>(
  options: SagaOptions<TContext>
): Promise<SagaResult<TContext>> {
  const {
    context: initialContext,
    steps,
    logger,
    onStepStart,
    onStepComplete,
    onStepFailed,
    onCompensate,
    onComplete,
    onFailure,
  } = options;

  const saga = new Saga(initialContext, {
    logger,
    onStepStart,
    onStepComplete,
    onStepFailed,
    onCompensate,
    onComplete,
    onFailure,
  });

  saga.addSteps(steps);
  return saga.execute();
}
