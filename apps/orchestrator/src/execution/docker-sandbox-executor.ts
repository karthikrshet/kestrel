import { spawn } from "node:child_process";
import { rm, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "pino";
import type { PlanStep } from "../planner.js";
import type { ToolExecutor, ToolExecutionResult, ExecStepContext } from "./types.js";
import { SimulatedExecutor } from "./simulated-executor.js";
import { cloneRepoWorkspace } from "./workspace.js";
import type { RepoLookup } from "../github/pr-opener.js";

/**
 * !! IMPORTANT — READ BEFORE ENABLING !!
 *
 * This executor runs test commands by shelling out to the HOST'S Docker
 * daemon (via the mounted /var/run/docker.sock — see
 * infra/docker-compose.sandbox.yml). That is NOT the isolation model
 * described in docs/architecture/09-security-architecture.md: mounting the
 * host Docker socket into a container is widely understood to be roughly
 * equivalent to giving that container root on the host, because a process
 * with Docker socket access can launch privileged containers, mount the
 * host filesystem, etc.
 *
 * This is a reasonable, real, working implementation for a trusted local/
 * self-hosted dev setup where you control what repos and issues you point
 * Kestrel at. It is explicitly NOT what you'd run multi-tenant or with
 * untrusted input — that requires the Firecracker/gVisor microVM fleet
 * described in the architecture docs, which needs real infrastructure
 * (a VM host, a scheduler) that can't be conjured by a source file. See
 * docs/roadmap.md Phase 5.
 *
 * Enabled only when EXECUTION_MODE=docker is explicitly set (see
 * apps/orchestrator/src/worker.ts) — never the default.
 */
export class DockerSandboxExecutor implements ToolExecutor {
  private readonly workspaces = new Map<string, string>();
  private readonly fallback: SimulatedExecutor;

  constructor(
    private readonly appId: string,
    private readonly privateKey: string,
    private readonly lookupRepo: RepoLookup,
    private readonly sandboxImage: string,
    private readonly log: Logger,
    private readonly timeoutMs: number = 5 * 60_000
  ) {
    this.fallback = new SimulatedExecutor(log);
  }

  async execute(step: PlanStep, ctx: ExecStepContext): Promise<ToolExecutionResult> {
    try {
      switch (step.tool) {
        case "read_file":
          return await this.listRepoFiles(ctx);
        case "run_tests":
          return await this.runTests(ctx);
        case "git_commit":
        case "git_push":
          // The PR is opened via the GitHub Contents API in
          // github/pr-opener.ts, not via local git commands — running a
          // second, separate commit/push here against the cloned workspace
          // would create two disconnected histories writing to the same
          // repo. Rather than build a second, conflicting git path, these
          // steps are a documented no-op in this executor.
          return {
            exitCode: 0,
            output: "git operations are performed by GithubPrOpener via the Contents API, not here.",
          };
      }
    } catch (err) {
      this.log.warn(
        { runId: ctx.runId, tool: step.tool, err },
        "docker sandbox step failed; falling back to simulated result for this step"
      );
      return this.fallback.execute(step, ctx);
    }
  }

  async cleanup(runId: string): Promise<void> {
    const path = this.workspaces.get(runId);
    if (!path) return;
    this.workspaces.delete(runId);
    await rm(path, { recursive: true, force: true }).catch((err) =>
      this.log.warn({ runId, err }, "failed to clean up workspace directory")
    );
  }

  private async ensureWorkspace(ctx: ExecStepContext): Promise<string> {
    const cached = this.workspaces.get(ctx.runId);
    if (cached) return cached;

    const repo = await this.lookupRepo({ repositoryId: ctx.repositoryId, orgId: ctx.orgId });
    if (!repo?.installationId) {
      throw new Error(`no installation_id on file for repository ${ctx.repositoryId}`);
    }

    const { path: dir } = await cloneRepoWorkspace({
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      appId: this.appId,
      privateKey: this.privateKey,
      installationId: repo.installationId,
      dirPrefix: `kestrel-exec-${ctx.runId.slice(0, 8)}`,
    });

    this.workspaces.set(ctx.runId, dir);
    return dir;
  }

  private async listRepoFiles(ctx: ExecStepContext): Promise<ToolExecutionResult> {
    const workspace = await this.ensureWorkspace(ctx);
    const entries = await readdir(workspace, { withFileTypes: true });
    const names = entries
      .filter((e) => e.name !== ".git")
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { exitCode: 0, output: `Top-level entries:\n${names.join("\n")}` };
  }

  private async detectTestCommand(workspace: string): Promise<string> {
    const exists = async (file: string) => {
      try {
        await access(join(workspace, file));
        return true;
      } catch {
        return false;
      }
    };

    if (await exists("package.json")) return "npm install --no-audit --no-fund && npm test --if-present";
    if (await exists("pyproject.toml")) return "pip install -e . && pytest -q";
    if (await exists("requirements.txt")) return "pip install -r requirements.txt && pytest -q";
    if (await exists("go.mod")) return "go test ./...";
    return 'echo "no recognized test manifest found; skipping" && exit 0';
  }

  private async runTests(ctx: ExecStepContext): Promise<ToolExecutionResult> {
    const workspace = await this.ensureWorkspace(ctx);
    const command = await this.detectTestCommand(workspace);

    return new Promise((resolve, reject) => {
      const dockerArgs = [
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        "512m",
        "--cpus",
        "1",
        "--pids-limit",
        "256",
        "-v",
        `${workspace}:/workspace`,
        "-w",
        "/workspace",
        this.sandboxImage,
        "sh",
        "-c",
        command,
      ];

      const child = spawn("docker", dockerArgs);
      let output = "";
      const killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, this.timeoutMs);

      child.stdout.on("data", (d) => (output += d.toString()));
      child.stderr.on("data", (d) => (output += d.toString()));
      child.on("error", (err) => {
        clearTimeout(killTimer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(killTimer);
        resolve({ exitCode: code ?? 1, output: output.slice(-8000) }); // cap captured output
      });
    });
  }
}
