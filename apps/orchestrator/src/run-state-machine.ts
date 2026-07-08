import type { Logger } from "pino";
import type { Planner, PlanStep } from "./planner.js";
import type { PrOpener } from "./github/pr-opener.js";
import type { ToolExecutor } from "./execution/types.js";

/**
 * Implements the state diagram in docs/architecture/01-c4-diagrams.md
 * (Level 4 — Run State Machine). Each step's execution is stubbed (logs +
 * a short delay) rather than dispatching to a real sandboxed Execution
 * Fleet — see docs/architecture/03-service-boundaries.md for what that
 * plane would look like in production.
 */
export type RunStatus =
  | "queued"
  | "planning"
  | "executing"
  | "reviewing"
  | "awaiting_human_approval"
  | "done"
  | "failed";

export interface RunContext {
  runId: string;
  orgId: string;
  repositoryId: string;
  issueRef: string;
}

export class RunStateMachine {
  private status: RunStatus = "queued";

  constructor(
    private readonly ctx: RunContext,
    private readonly planner: Planner,
    private readonly log: Logger,
    private readonly prOpener: PrOpener,
    private readonly executor: ToolExecutor,
    private readonly onTransition?: (status: RunStatus, extra?: { planSummary?: string; prUrl?: string }) => Promise<void>
  ) {}

  getStatus() {
    return this.status;
  }

  async run(): Promise<RunStatus> {
    try {
      await this.transition("planning");
      const plan: PlanStep[] = await this.planner.plan({
        issueRef: this.ctx.issueRef,
        repositoryId: this.ctx.repositoryId,
      });
      const planSummary = plan.map((s) => `${s.index + 1}. ${s.description}`).join(" ");
      this.log.info({ runId: this.ctx.runId, stepCount: plan.length }, "plan produced");

      await this.transition("executing", { planSummary });
      for (const step of plan) {
        const result = await this.executeStep(step);
        if (result.exitCode !== 0 && step.tool === "run_tests") {
          // A real failing test suite is meaningful signal, not just noise —
          // surface it distinctly rather than silently continuing as if
          // everything passed. A fuller implementation would re-plan here
          // (docs/agents/reasoning-frameworks.md); this scaffold logs and
          // proceeds so the pipeline remains demonstrable end-to-end.
          this.log.warn(
            { runId: this.ctx.runId, step: step.index, exitCode: result.exitCode },
            "test step reported a non-zero exit code"
          );
        }
      }

      await this.transition("reviewing");
      const { prUrl } = await this.prOpener.openPr({
        runId: this.ctx.runId,
        repositoryId: this.ctx.repositoryId,
        orgId: this.ctx.orgId,
        issueRef: this.ctx.issueRef,
        planSummary,
      });
      this.log.info({ runId: this.ctx.runId, prUrl }, "PR opened");

      await this.transition("awaiting_human_approval", { prUrl });
      // In production this pauses here until a human calls
      // POST /v1/runs/:runId/approve. The scaffold auto-completes so the
      // pipeline is demonstrable end-to-end without a human in the loop.
      await this.transition("done");
      return this.status;
    } catch (err) {
      this.log.error({ runId: this.ctx.runId, err }, "run failed");
      await this.transition("failed");
      return this.status;
    } finally {
      await this.executor.cleanup(this.ctx.runId);
    }
  }

  private async executeStep(step: PlanStep) {
    this.log.info({ runId: this.ctx.runId, step: step.index, tool: step.tool }, step.description);
    const result = await this.executor.execute(step, {
      runId: this.ctx.runId,
      repositoryId: this.ctx.repositoryId,
      orgId: this.ctx.orgId,
    });
    this.log.debug({ runId: this.ctx.runId, step: step.index, result }, "step result");
    return result;
  }

  private async transition(next: RunStatus, extra?: { planSummary?: string; prUrl?: string }) {
    this.log.debug({ runId: this.ctx.runId, from: this.status, to: next }, "state transition");
    this.status = next;
    if (this.onTransition) {
      await this.onTransition(next, extra);
    }
  }
}
