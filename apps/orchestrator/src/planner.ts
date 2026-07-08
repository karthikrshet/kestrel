/**
 * Planner interface. This scaffold ships a deterministic stub so the
 * orchestrator pipeline is runnable and testable without an LLM API key.
 * Swap `StubPlanner` for a real implementation that calls your configured
 * LLM_PROVIDER (see docs/agents/reasoning-frameworks.md for the planning
 * loop this should implement, including re-planning and Tree-of-Thoughts
 * branching for non-trivial steps).
 */
export interface PlanStep {
  index: number;
  description: string;
  tool: "read_file" | "run_tests" | "git_commit" | "git_push";
}

export interface Planner {
  plan(input: { issueRef: string; repositoryId: string }): Promise<PlanStep[]>;
}

export class StubPlanner implements Planner {
  async plan(input: { issueRef: string }): Promise<PlanStep[]> {
    return [
      { index: 0, description: `Read repository context for ${input.issueRef}`, tool: "read_file" },
      { index: 1, description: "Run existing test suite to establish baseline", tool: "run_tests" },
      { index: 2, description: "Commit proposed fix", tool: "git_commit" },
      { index: 3, description: "Push branch and open pull request", tool: "git_push" },
    ];
  }
}

const TOOLS = ["read_file", "run_tests", "git_commit", "git_push"] as const;

/**
 * Calls the configured LLM provider to produce a plan, falling back to
 * StubPlanner if no API key is configured or the call fails — a run should
 * never crash outright just because planning intelligence is unavailable;
 * it should degrade to a safe, generic plan and let the reflection loop
 * (docs/agents/reasoning-frameworks.md) flag the degraded run for review.
 */
export class LlmPlanner implements Planner {
  private readonly fallback = new StubPlanner();

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string = "claude-sonnet-4-6"
  ) {}

  async plan(input: { issueRef: string; repositoryId: string }): Promise<PlanStep[]> {
    if (!this.apiKey) {
      return this.fallback.plan(input);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system:
            "You are a software engineering planner. Given an issue reference, respond with ONLY a JSON array of plan steps. " +
            `Each step: {"index": number, "description": string, "tool": one of ${JSON.stringify(TOOLS)}}. No prose, no markdown fences.`,
          messages: [
            {
              role: "user",
              content: `Issue: ${input.issueRef}\nRepository ID: ${input.repositoryId}\nProduce a plan.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API returned ${response.status}`);
      }

      const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
      const text = data.content.find((c) => c.type === "text")?.text ?? "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as PlanStep[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("LLM returned an empty or invalid plan");
      }
      return parsed;
    } catch {
      // Degrade to the deterministic stub rather than failing the run.
      return this.fallback.plan(input);
    }
  }
}
