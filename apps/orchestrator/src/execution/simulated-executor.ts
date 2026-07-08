import type { Logger } from "pino";
import type { ToolExecutor, ToolExecutionResult, ExecStepContext } from "./types.js";
import type { PlanStep } from "../planner.js";

/**
 * Default executor. Does not touch a real repository or run real commands —
 * it exists so the run state machine and the rest of the pipeline
 * (planning, PR creation, Postgres status writes) are demonstrable without
 * requiring Docker socket access or a configured GitHub App. This is what
 * ships enabled by default; DockerSandboxExecutor is opt-in (see
 * docs/roadmap.md and infra/docker-compose.sandbox.yml).
 */
export class SimulatedExecutor implements ToolExecutor {
  constructor(private readonly log: Logger) {}

  async execute(step: PlanStep, ctx: ExecStepContext): Promise<ToolExecutionResult> {
    this.log.info({ runId: ctx.runId, step: step.index, tool: step.tool }, step.description);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { exitCode: 0, output: `(simulated) ${step.description}` };
  }

  async cleanup(): Promise<void> {
    // Nothing to release.
  }
}
