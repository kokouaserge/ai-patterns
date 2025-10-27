/**
 * Conditional Branch Pattern - If/Else in workflows
 */

import { AsyncFunction, defaultLogger, Logger, MaybePromise } from "../types/common";

export interface ConditionalBranchOptions<TInput = any, TResult = any> {
  condition: (input: TInput) => MaybePromise<boolean>;
  onTrue: AsyncFunction<TResult, [TInput]>;
  onFalse: AsyncFunction<TResult, [TInput]>;
  logger?: Logger;
  onBranchSelected?: (branch: "true" | "false") => void;
}

export async function conditionalBranch<TInput = any, TResult = any>(
  options: ConditionalBranchOptions<TInput, TResult>,
  input: TInput
): Promise<TResult> {
  const {
    condition,
    onTrue,
    onFalse,
    logger = defaultLogger,
    onBranchSelected,
  } = options;

  const result = await condition(input);

  if (result) {
    logger.info("Condition evaluated to true");
    if (onBranchSelected) onBranchSelected("true");
    return await onTrue(input);
  } else {
    logger.info("Condition evaluated to false");
    if (onBranchSelected) onBranchSelected("false");
    return await onFalse(input);
  }
}
