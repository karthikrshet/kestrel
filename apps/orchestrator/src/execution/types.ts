import type { PlanStep } from "../planner.js";

export interface ExecStepContext {
  runId: string;
  repositoryId: string;
  orgId: string;
}

export interface ToolExecutionResult {
  exitCode: number;
  output: string;
}

/**
 * Executes a single plan step's tool call. Two implementations exist:
 * - SimulatedExecutor: logs and sleeps, no real tool call (default).
 * - DockerSandboxExecutor: clones the real repo and actually runs the test
 *   suite in a container — see docker-sandbox-executor.ts for the important
 *   caveat about what isolation this does and doesn't provide.
 */
export interface ToolExecutor {
  execute(step: PlanStep, ctx: ExecStepContext): Promise<ToolExecutionResult>;
  /** Called once after a run finishes (success or failure) to release any resources (e.g. a cloned workspace). */
  cleanup(runId: string): Promise<void>;
}
