import { describe, it, expect } from "vitest";
import pino from "pino";
import { RunStateMachine } from "../src/run-state-machine.js";
import { StubPlanner } from "../src/planner.js";
import { StubPrOpener } from "../src/github/pr-opener.js";
import { SimulatedExecutor } from "../src/execution/simulated-executor.js";

describe("RunStateMachine", () => {
  it("progresses from queued to done via the stub planner, stub PR opener, and simulated executor", async () => {
    const log = pino({ level: "silent" });
    const machine = new RunStateMachine(
      { runId: "test-run", orgId: "org-1", repositoryId: "repo-1", issueRef: "acme/webapp#1" },
      new StubPlanner(),
      log,
      new StubPrOpener(),
      new SimulatedExecutor(log)
    );

    expect(machine.getStatus()).toBe("queued");
    const finalStatus = await machine.run();
    expect(finalStatus).toBe("done");
  });
});
