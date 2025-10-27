/**
 * Conditional Branch Pattern - Multi-branch switch pattern in workflows
 */

import { AsyncFunction, defaultLogger, Logger, MaybePromise } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";

/**
 * A single branch in the conditional pattern
 */
export interface Branch<TInput = any, TResult = any> {
  condition: (input: TInput) => MaybePromise<boolean>;
  execute: AsyncFunction<TResult, [TInput]>;
}

/**
 * Options for conditional branch pattern
 */
export interface ConditionalBranchOptions<TInput = any, TResult = any> {
  branches: Branch<TInput, TResult>[];
  input: TInput;
  defaultBranch?: AsyncFunction<TResult, [TInput]>;
  logger?: Logger;
  onBranchSelected?: (branchIndex: number) => void;
}

/**
 * Result from conditional branch pattern
 */
export interface ConditionalBranchResult<TResult = any> {
  value: TResult;
  branchIndex: number;
}

export async function conditionalBranch<TInput = any, TResult = any>(
  options: ConditionalBranchOptions<TInput, TResult>
): Promise<ConditionalBranchResult<TResult>> {
  const {
    branches,
    input,
    defaultBranch,
    logger = defaultLogger,
    onBranchSelected,
  } = options;

  // Evaluate each branch condition in order
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    const conditionResult = await branch.condition(input);

    if (conditionResult) {
      logger.info(`Branch ${i} condition matched`);
      if (onBranchSelected) onBranchSelected(i);

      const value = await branch.execute(input);
      return {
        value,
        branchIndex: i,
      };
    }
  }

  // No branch matched - use default if available
  if (defaultBranch) {
    logger.info("No branch matched, executing default");
    if (onBranchSelected) onBranchSelected(-1);

    const value = await defaultBranch(input);
    return {
      value,
      branchIndex: -1,
    };
  }

  // No branch matched and no default - throw error
  throw new PatternError(
    "No matching branch found",
    ErrorCode.NO_MATCHING_BRANCH
  );
}
