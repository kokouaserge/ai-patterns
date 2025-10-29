/**
 * Reflection Loop Pattern
 *
 * Enables AI agents to self-critique and iteratively improve their responses.
 * The AI generates a response, reflects on it, and regenerates based on feedback
 * until a target quality score is reached or max iterations is hit.
 *
 * @example
 * ```typescript
 * const result = await reflectionLoop({
 *   execute: async (ctx) => {
 *     const prompt = ctx.iteration === 1
 *       ? 'Write a blog post about TypeScript'
 *       : `Previous: ${ctx.previousResponse}
 *          Feedback: ${ctx.previousCritique?.feedback}
 *          Improve based on this feedback.`;
 *     return await generateText({ prompt });
 *   },
 *   reflect: async (text) => {
 *     const critique = await generateText({
 *       prompt: `Rate this (1-10) and suggest improvements: ${text}`
 *     });
 *     return {
 *       score: extractScore(critique),
 *       feedback: critique,
 *       shouldContinue: extractScore(critique) < 8
 *     };
 *   },
 *   maxIterations: 5,
 *   targetScore: 8
 * });
 * ```
 */

import type {
  ReflectionLoopConfig,
  ReflectionLoopResult,
  ReflectionIteration,
  ReflectionHistory,
  ReflectionContext,
  ReflectionHistoryStorage,
  ReflectionStats,
} from "../types/reflection-loop";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";

/**
 * In-memory storage implementation for reflection history
 */
export class InMemoryReflectionStorage<TResponse>
  implements ReflectionHistoryStorage<TResponse>
{
  private storage = new Map<string, ReflectionIteration<TResponse>[]>();

  save(sessionId: string, iteration: ReflectionIteration<TResponse>): void {
    const existing = this.storage.get(sessionId) || [];
    existing.push(iteration);
    this.storage.set(sessionId, existing);
  }

  load(sessionId: string): ReflectionIteration<TResponse>[] {
    return this.storage.get(sessionId) || [];
  }

  delete(sessionId: string): void {
    this.storage.delete(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.storage.keys());
  }
}

/**
 * Create a ReflectionHistory object from iterations
 */
function createHistory<TResponse>(
  iterations: ReflectionIteration<TResponse>[]
): ReflectionHistory<TResponse> {
  if (iterations.length === 0) {
    throw new PatternError(
      "Cannot create history from empty iterations array",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  const scores = iterations.map((i) => i.critique.score);
  const best = iterations.reduce((best, curr) =>
    curr.critique.score > best.critique.score ? curr : best
  );
  const last = iterations[iterations.length - 1];

  const stats: ReflectionStats = {
    totalIterations: iterations.length,
    totalTime: iterations.reduce((sum, i) => sum + i.metrics.totalTime, 0),
    totalCost:
      iterations.reduce((sum, i) => sum + (i.metrics.cost || 0), 0) || undefined,
    totalTokens:
      iterations.reduce((sum, i) => sum + (i.metrics.tokens || 0), 0) ||
      undefined,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    scoreImprovement: best.critique.score - iterations[0].critique.score,
    bestScore: Math.max(...scores),
    worstScore: Math.min(...scores),
  };

  return {
    iterations,
    stats,
    best,
    last,
    getIteration: (n: number) => iterations.find((i) => i.iteration === n),
    getScoreProgression: () => scores,
    wasImproving: () => {
      if (iterations.length < 2) return false;
      const first = iterations[0].critique.score;
      const lastScore = iterations[iterations.length - 1].critique.score;
      return lastScore > first;
    },
  };
}

/**
 * Execute a reflection loop where the AI iteratively improves its response
 * through self-critique and regeneration.
 */
export async function reflectionLoop<TResponse>(
  config: ReflectionLoopConfig<TResponse>
): Promise<ReflectionLoopResult<TResponse>> {
  const {
    execute,
    reflect,
    maxIterations = 5,
    targetScore = 10,
    onMaxIterationsReached = "return-best",
    onStart,
    onBeforeExecute,
    onAfterExecute,
    onBeforeReflect,
    onAfterReflect,
    onIterationComplete,
    onImprovement,
    onStagnation,
    onTargetReached,
    onMaxIterations,
    onError,
    onComplete,
    enableHistory = true,
    historyStorage,
    sessionId = `reflection-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    
    costPerToken,
    
    includeHistoryInContext = false,
    maxHistoryInContext = 3,
    logger = defaultLogger,
  } = config;

  // Validate configuration
  if (maxIterations < 1) {
    throw new PatternError(
      "maxIterations must be at least 1",
      ErrorCode.INVALID_ARGUMENT,
      undefined,
      { maxIterations }
    );
  }

  if (!execute || typeof execute !== "function") {
    throw new PatternError(
      "execute must be a function",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  if (!reflect || typeof reflect !== "function") {
    throw new PatternError(
      "reflect must be a function",
      ErrorCode.INVALID_ARGUMENT
    );
  }

  const loopStartTime = performance.now();
  const iterations: ReflectionIteration<TResponse>[] = [];
  const storage =
    historyStorage || new InMemoryReflectionStorage<TResponse>();

  // Hook: onStart
  if (onStart) {
    try {
      await onStart(config);
    } catch (error) {
      logger.error("onStart hook failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let iteration = 0;
  let bestIteration: ReflectionIteration<TResponse> | null = null;

  try {
    while (iteration < maxIterations) {
      iteration++;
      const iterationStartTime = performance.now();

      logger.debug(`Reflection iteration ${iteration}/${maxIterations}`);

      // Build context
      const previousIterations = includeHistoryInContext
        ? iterations.slice(-maxHistoryInContext).map((iter) => ({
            response: iter.response,
            critique: iter.critique,
          }))
        : [];

      const context: ReflectionContext<TResponse> = {
        iteration,
        previousResponse: iterations[iterations.length - 1]?.response,
        previousCritique: iterations[iterations.length - 1]?.critique,
        history: previousIterations,
      };

      // Hook: onBeforeExecute
      if (onBeforeExecute) {
        try {
          await onBeforeExecute(context);
        } catch (error) {
          logger.error("onBeforeExecute hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Execute
      const executeStart = performance.now();
      let response: TResponse;

      try {
        response = await execute(context);
      } catch (error) {
        const execError =
          error instanceof Error ? error : new Error(String(error));

        logger.error(`Execution failed at iteration ${iteration}`, {
          error: execError.message,
        });

        // Hook: onError
        if (onError) {
          try {
            await onError(execError, context, iteration);
          } catch (hookError) {
            logger.error("onError hook failed", {
              error:
                hookError instanceof Error
                  ? hookError.message
                  : String(hookError),
            });
          }
        }

        throw new PatternError(
          `Execution failed at iteration ${iteration}: ${execError.message}`,
          ErrorCode.EXECUTION_FAILED,
          execError,
          { iteration, sessionId }
        );
      }

      const executeEnd = performance.now();
      const executionTime = executeEnd - executeStart;

      // Hook: onAfterExecute
      if (onAfterExecute) {
        try {
          await onAfterExecute(response, context, executionTime);
        } catch (error) {
          logger.error("onAfterExecute hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Hook: onBeforeReflect
      if (onBeforeReflect) {
        try {
          await onBeforeReflect(response, context);
        } catch (error) {
          logger.error("onBeforeReflect hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Reflect
      const reflectStart = performance.now();
      let critique;

      try {
        critique = await reflect(response, context);
      } catch (error) {
        const reflectError =
          error instanceof Error ? error : new Error(String(error));

        logger.error(`Reflection failed at iteration ${iteration}`, {
          error: reflectError.message,
        });

        // Hook: onError
        if (onError) {
          try {
            await onError(reflectError, context, iteration);
          } catch (hookError) {
            logger.error("onError hook failed", {
              error:
                hookError instanceof Error
                  ? hookError.message
                  : String(hookError),
            });
          }
        }

        throw new PatternError(
          `Reflection failed at iteration ${iteration}: ${reflectError.message}`,
          ErrorCode.EXECUTION_FAILED,
          reflectError,
          { iteration, sessionId }
        );
      }

      const reflectEnd = performance.now();
      const reflectionTime = reflectEnd - reflectStart;

      // Hook: onAfterReflect
      if (onAfterReflect) {
        try {
          await onAfterReflect(critique, context, reflectionTime);
        } catch (error) {
          logger.error("onAfterReflect hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Calculate metrics
      const iterationEndTime = performance.now();
      const totalTime = iterationEndTime - iterationStartTime;

      // Extract tokens from response if available (like costTracking pattern)
      let tokens: number | undefined = undefined;
      let cost: number | undefined = undefined;

      if (response && typeof response === "object" && "tokens" in response) {
        tokens = (response as any).tokens;

        // Calculate cost if costPerToken is provided
        if (tokens !== undefined && costPerToken !== undefined) {
          cost = tokens * costPerToken;
        }
      }

      // Create iteration record
      const currentIteration: ReflectionIteration<TResponse> = {
        iteration,
        response,
        critique,
        metrics: {
          executionTime,
          reflectionTime,
          totalTime,
          tokens,
          cost,
        },
        startTime: iterationStartTime,
        endTime: iterationEndTime,
      };

      iterations.push(currentIteration);

      // Save to storage
      if (enableHistory) {
        try {
          await storage.save(sessionId, currentIteration);
        } catch (error) {
          logger.warn("Failed to save iteration to storage", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Hook: onIterationComplete
      if (onIterationComplete) {
        try {
          await onIterationComplete(currentIteration);
        } catch (error) {
          logger.error("onIterationComplete hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(`Iteration ${iteration} complete`, {
        score: critique.score,
        executionTime,
        reflectionTime,
        totalTime,
        tokens,
        cost,
      });

      // Check for improvement
      if (!bestIteration || critique.score > bestIteration.critique.score) {
        const previousBest = bestIteration;
        bestIteration = currentIteration;

        logger.info(`New best score: ${critique.score}`);

        // Hook: onImprovement
        if (onImprovement && previousBest) {
          try {
            await onImprovement(currentIteration, previousBest);
          } catch (error) {
            logger.error("onImprovement hook failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else if (onStagnation && iterations.length > 1) {
        // Hook: onStagnation
        const previousScore =
          iterations[iterations.length - 2]?.critique.score || 0;
        try {
          await onStagnation(critique.score, previousScore, iteration);
        } catch (error) {
          logger.error("onStagnation hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Check if target reached
      if (critique.score >= targetScore) {
        logger.info(`Target score ${targetScore} reached at iteration ${iteration}`);

        const history = createHistory(iterations);

        // Hook: onTargetReached
        if (onTargetReached) {
          try {
            await onTargetReached(currentIteration, history);
          } catch (error) {
            logger.error("onTargetReached hook failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const loopEndTime = performance.now();
        const result: ReflectionLoopResult<TResponse> = {
          value: response,
          finalScore: critique.score,
          iterations: iteration,
          targetReached: true,
          history,
          timestamp: Date.now(),
          metrics: {
            totalTime: loopEndTime - loopStartTime,
            totalCost: history.stats.totalCost,
            totalTokens: history.stats.totalTokens,
            averageIterationTime: history.stats.totalTime / iteration,
            scoreProgression: history.getScoreProgression(),
          },
        };

        // Hook: onComplete
        if (onComplete) {
          try {
            await onComplete(result, history);
          } catch (error) {
            logger.error("onComplete hook failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return result;
      }

      // Check if should continue
      if (!critique.shouldContinue) {
        logger.info(`Reflection stopped by reflect function at iteration ${iteration}`);
        break;
      }
    }

    // Max iterations reached
    logger.warn(`Max iterations (${maxIterations}) reached`);

    const history = createHistory(iterations);

    // Hook: onMaxIterations
    if (onMaxIterations) {
      try {
        await onMaxIterations(history);
      } catch (error) {
        logger.error("onMaxIterations hook failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (onMaxIterationsReached === "throw") {
      throw new PatternError(
        `Reflection loop failed to reach target score (${targetScore}) after ${maxIterations} iterations`,
        ErrorCode.ALL_RETRIES_FAILED,
        undefined,
        {
          maxIterations,
          bestScore: bestIteration?.critique.score,
          targetScore,
          sessionId,
          stats: history.stats,
        }
      );
    }

    const finalIteration =
      onMaxIterationsReached === "return-best"
        ? bestIteration!
        : iterations[iterations.length - 1];

    const loopEndTime = performance.now();
    const result: ReflectionLoopResult<TResponse> = {
      value: finalIteration.response,
      finalScore: finalIteration.critique.score,
      iterations: iteration,
      targetReached: false,
      history,
      timestamp: Date.now(),
      metrics: {
        totalTime: loopEndTime - loopStartTime,
        totalCost: history.stats.totalCost,
        totalTokens: history.stats.totalTokens,
        averageIterationTime: history.stats.totalTime / iteration,
        scoreProgression: history.getScoreProgression(),
      },
    };

    // Hook: onComplete
    if (onComplete) {
      try {
        await onComplete(result, history);
      } catch (error) {
        logger.error("onComplete hook failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  } catch (error) {
    // If error wasn't already handled, handle it here
    if (!(error instanceof PatternError)) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error("Unexpected error in reflection loop", {
        error: err.message,
      });

      throw new PatternError(
        `Reflection loop encountered an unexpected error: ${err.message}`,
        ErrorCode.EXECUTION_FAILED,
        err,
        { iteration, sessionId }
      );
    }

    throw error;
  }
}
