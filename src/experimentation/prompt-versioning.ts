/**
 * Prompt Versioning & Experimentation Pattern
 *
 * Manages prompt versions with rollback, gradual rollout, and performance comparison.
 * Enables safe experimentation with different prompt formulations.
 *
 * @example
 * ```typescript
 * const result = await versionedPrompt({
 *   promptId: 'product-summary',
 *   versions: {
 *     'v1.0': {
 *       prompt: 'Summarize this product in 2 sentences',
 *       active: false,
 *       performance: { satisfaction: 0.75, avgTokens: 50 }
 *     },
 *     'v2.0': {
 *       prompt: 'Create engaging 2-sentence product summary',
 *       active: true,
 *       rolloutPercentage: 50
 *     }
 *   },
 *   execute: async (prompt, version) => {
 *     return await generateText({ model, prompt: prompt + '\n\n' + productData });
 *   },
 *   onVersionUsed: (version, result) => {
 *     analytics.track('prompt_version_used', { version, tokens: result.tokens });
 *   },
 *   autoRollback: {
 *     enabled: true,
 *     conditions: [
 *       { metric: 'satisfaction', threshold: 0.7, window: '1h', operator: 'lt' }
 *     ]
 *   }
 * });
 * ```
 */

import type {
  PromptVersioningConfig,
  PromptVersionExecutionResult,
  PromptVersionStorage,
  PromptVersionMetrics,
  VersionManagementResult,
} from "../types/prompt-versioning";
import { defaultLogger } from "../types/common";
import { PatternError, ErrorCode } from "../types/errors";
import { InMemoryStorage } from "../common/storage";

/**
 * Simple in-memory storage for prompt version metrics
 */
export class InMemoryPromptVersionStorage
  extends InMemoryStorage<string, PromptVersionMetrics | string | string[]>
  implements PromptVersionStorage
{
  constructor() {
    super({ autoCleanup: false });
  }

  private getMetricsKey(promptId: string, version: string): string {
    return `metrics:${promptId}:${version}`;
  }

  private getActiveVersionKey(promptId: string): string {
    return `active:${promptId}`;
  }

  private getHistoryKey(promptId: string): string {
    return `history:${promptId}`;
  }

  async getMetrics(
    promptId: string,
    version: string
  ): Promise<PromptVersionMetrics | null> {
    const key = this.getMetricsKey(promptId, version);
    const value = await this.get(key);
    return (value as PromptVersionMetrics) ?? null;
  }

  async updateMetrics(
    promptId: string,
    version: string,
    metrics: Partial<PromptVersionMetrics>
  ): Promise<void> {
    const key = this.getMetricsKey(promptId, version);
    const existing = (await this.get(key)) as PromptVersionMetrics | undefined;
    const baseMetrics = existing || ({} as PromptVersionMetrics);
    await this.set(key, { ...baseMetrics, ...metrics } as PromptVersionMetrics);
  }

  async getActiveVersion(promptId: string): Promise<string | null> {
    const key = this.getActiveVersionKey(promptId);
    const value = await this.get(key);
    return (value as string) ?? null;
  }

  async setActiveVersion(promptId: string, version: string): Promise<void> {
    const activeKey = this.getActiveVersionKey(promptId);
    const historyKey = this.getHistoryKey(promptId);

    const previous = await this.get(activeKey);
    await this.set(activeKey, version);

    // Update history
    const versions = ((await this.get(historyKey)) as string[]) || [];
    if (previous && previous !== version) {
      versions.push(previous as string);
    }
    await this.set(historyKey, versions);
  }

  async getVersionHistory(promptId: string): Promise<string[]> {
    const key = this.getHistoryKey(promptId);
    const value = await this.get(key);
    return (value as string[]) || [];
  }
}

/**
 * Default storage instance
 */
const defaultStorage = new InMemoryPromptVersionStorage();

/**
 * Select a version based on rollout percentages
 */
function selectVersion(
  versions: Record<string, any>,
  _promptId: string,
  random: number = Math.random()
): string {
  const activeVersions = Object.entries(versions)
    .filter(([_, config]) => config.active)
    .map(([name, config]) => ({
      name,
      rolloutPercentage: config.rolloutPercentage ?? 100,
    }));

  if (activeVersions.length === 0) {
    throw new PatternError(
      "No active versions found",
      ErrorCode.NO_VARIANTS
    );
  }

  // If only one version, return it
  if (activeVersions.length === 1) {
    return activeVersions[0].name;
  }

  // Calculate total percentage
  const totalPercentage = activeVersions.reduce(
    (sum, v) => sum + v.rolloutPercentage,
    0
  );

  // Normalize percentages
  const normalized = activeVersions.map((v) => ({
    name: v.name,
    percentage: (v.rolloutPercentage / totalPercentage) * 100,
  }));

  // Select based on random value
  const randomPercentage = random * 100;
  let cumulative = 0;

  for (const version of normalized) {
    cumulative += version.percentage;
    if (randomPercentage <= cumulative) {
      return version.name;
    }
  }

  // Fallback to first version
  return normalized[0].name;
}

/**
 * Check if rollback conditions are met
 */
async function checkRollbackConditions(
  config: PromptVersioningConfig<any>,
  currentVersion: string,
  storage: PromptVersionStorage
): Promise<boolean> {
  if (!config.autoRollback?.enabled) {
    return false;
  }

  const metrics = await storage.getMetrics(config.promptId, currentVersion);
  if (!metrics) {
    return false;
  }

  for (const condition of config.autoRollback.conditions) {
    const value = metrics[condition.metric];
    if (value === undefined) {
      continue;
    }

    const operator = condition.operator || "lt";
    let shouldRollback = false;

    switch (operator) {
      case "lt":
        shouldRollback = value < condition.threshold;
        break;
      case "gt":
        shouldRollback = value > condition.threshold;
        break;
      case "lte":
        shouldRollback = value <= condition.threshold;
        break;
      case "gte":
        shouldRollback = value >= condition.threshold;
        break;
    }

    if (shouldRollback) {
      return true;
    }
  }

  return false;
}

/**
 * Perform automatic rollback
 */
async function performRollback(
  config: PromptVersioningConfig<any>,
  currentVersion: string,
  storage: PromptVersionStorage,
  logger: any
): Promise<VersionManagementResult> {
  const targetVersion =
    config.autoRollback?.targetVersion ||
    (await getPreviousStableVersion(config, storage));

  if (!targetVersion) {
    logger.warn("No stable version found for rollback");
    return {
      success: false,
      message: "No stable version available for rollback",
      currentVersion,
    };
  }

  await storage.setActiveVersion(config.promptId, targetVersion);
  logger.info(`Rolled back from ${currentVersion} to ${targetVersion}`);

  return {
    success: true,
    message: `Rolled back to version ${targetVersion}`,
    previousVersion: currentVersion,
    currentVersion: targetVersion,
  };
}

/**
 * Get the previous stable version
 */
async function getPreviousStableVersion(
  config: PromptVersioningConfig<any>,
  storage: PromptVersionStorage
): Promise<string | null> {
  const history = await storage.getVersionHistory(config.promptId);

  // Find the most recent version with good performance
  for (let i = history.length - 1; i >= 0; i--) {
    const version = history[i];
    const metrics = await storage.getMetrics(config.promptId, version);

    if (metrics && metrics.satisfaction && metrics.satisfaction >= 0.7) {
      return version;
    }
  }

  // If no stable version found, return the first version in history
  return history.length > 0 ? history[0] : null;
}

/**
 * Execute a prompt with version management
 */
export async function versionedPrompt<TResult = any>(
  config: PromptVersioningConfig<TResult>
): Promise<PromptVersionExecutionResult<TResult>> {
  const {
    promptId,
    versions,
    execute,
    onVersionUsed,
    onSuccess,
    onError,
    logger = defaultLogger,
    storage = defaultStorage,
  } = config;

  // Validate versions
  if (!versions || Object.keys(versions).length === 0) {
    throw new PatternError(
      "At least one version is required",
      ErrorCode.NO_VARIANTS
    );
  }

  // Select version
  const selectedVersionName = selectVersion(versions, promptId);
  const selectedVersion = versions[selectedVersionName];

  logger.debug(`Selected prompt version: ${selectedVersionName}`);

  const startTime = performance.now();

  try {
    // Execute the prompt
    const result = await execute(selectedVersion.prompt, selectedVersionName);
    const responseTime = Math.round(performance.now() - startTime);

    // Build execution result
    const executionResult: PromptVersionExecutionResult<TResult> = {
      value: result,
      version: selectedVersionName,
      timestamp: Date.now(),
      responseTime,
    };

    // Update metrics
    const currentMetrics = await storage.getMetrics(promptId, selectedVersionName);
    const newMetrics: Partial<PromptVersionMetrics> = {
      usageCount: (currentMetrics?.usageCount || 0) + 1,
      avgResponseTime: currentMetrics?.avgResponseTime
        ? (currentMetrics.avgResponseTime + responseTime) / 2
        : responseTime,
    };

    await storage.updateMetrics(promptId, selectedVersionName, newMetrics);
    await storage.setActiveVersion(promptId, selectedVersionName);

    // Call callbacks
    if (onVersionUsed) {
      await onVersionUsed(selectedVersionName, executionResult);
    }

    if (onSuccess) {
      await onSuccess(selectedVersionName, executionResult);
    }

    // Check rollback conditions
    const shouldRollback = await checkRollbackConditions(
      config,
      selectedVersionName,
      storage
    );

    if (shouldRollback) {
      await performRollback(config, selectedVersionName, storage, logger);
    }

    logger.info(
      `Prompt version ${selectedVersionName} executed successfully in ${responseTime}ms`
    );

    return executionResult;
  } catch (error) {
    const execError = error instanceof Error ? error : new Error(String(error));

    logger.error(
      `Prompt version ${selectedVersionName} execution failed`,
      { error: execError.message }
    );

    // Update error metrics
    const currentMetrics = await storage.getMetrics(promptId, selectedVersionName);
    const errorCount = (currentMetrics?.usageCount || 0) + 1;
    const newErrorRate = currentMetrics?.errorRate
      ? (currentMetrics.errorRate + 1) / errorCount
      : 1 / errorCount;

    await storage.updateMetrics(promptId, selectedVersionName, {
      errorRate: newErrorRate,
    });

    // Call error callback
    if (onError) {
      await onError(selectedVersionName, execError);
    }

    // Check if should rollback due to error
    const shouldRollback = await checkRollbackConditions(
      config,
      selectedVersionName,
      storage
    );

    if (shouldRollback) {
      await performRollback(config, selectedVersionName, storage, logger);
    }

    throw new PatternError(
      `Prompt version "${selectedVersionName}" execution failed: ${execError.message}`,
      ErrorCode.VARIANT_EXECUTION_FAILED,
      execError,
      { version: selectedVersionName, promptId }
    );
  }
}
