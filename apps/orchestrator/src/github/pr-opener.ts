import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import type { Logger } from "pino";

export interface OpenPrArgs {
  runId: string;
  repositoryId: string;
  orgId: string;
  issueRef: string;
  planSummary: string;
}

export interface PrOpener {
  openPr(args: OpenPrArgs): Promise<{ prUrl: string }>;
}

/**
 * No GitHub App configured (or repo has no installation_id on file) — used
 * automatically as a fallback so a run never fails outright just because
 * PR creation isn't wired up yet. Matches the LlmPlanner fallback pattern.
 */
export class StubPrOpener implements PrOpener {
  async openPr(args: OpenPrArgs): Promise<{ prUrl: string }> {
    return { prUrl: `https://github.com/example/example/pull/stub-${args.runId.slice(0, 8)}` };
  }
}

export interface RepoLookup {
  (args: { repositoryId: string; orgId: string }): Promise<{
    fullName: string;
    defaultBranch: string;
    installationId: string | null;
  } | null>;
}

/**
 * Opens a real pull request via a GitHub App installation token. Commits a
 * single notes file under `.kestrel/` summarizing the run's plan — this
 * scaffold does not yet generate real code diffs (that depends on the
 * sandboxed Execution Fleet described in docs/architecture/03-service-boundaries.md),
 * so what ships here is a genuinely working PR-creation path that a real
 * diff-producing agent can plug into later, not a simulation of one.
 */
export class GithubPrOpener implements PrOpener {
  constructor(
    private readonly appId: string,
    private readonly privateKey: string,
    private readonly lookupRepo: RepoLookup,
    private readonly log: Logger,
    private readonly fallback: PrOpener = new StubPrOpener()
  ) {}

  async openPr(args: OpenPrArgs): Promise<{ prUrl: string }> {
    const repo = await this.lookupRepo({ repositoryId: args.repositoryId, orgId: args.orgId });
    if (!repo?.installationId) {
      this.log.warn(
        { runId: args.runId, repositoryId: args.repositoryId },
        "no GitHub installation on file for this repository; falling back to stub PR"
      );
      return this.fallback.openPr(args);
    }

    try {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.appId,
          privateKey: this.privateKey,
          installationId: repo.installationId,
        },
      });

      const [owner, repoName] = repo.fullName.split("/");
      const branchName = `kestrel/run-${args.runId.slice(0, 8)}`;

      const { data: baseRef } = await octokit.rest.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${repo.defaultBranch}`,
      });

      await octokit.rest.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      const notesPath = `.kestrel/run-${args.runId}.md`;
      const notesContent = [
        `# Kestrel run ${args.runId}`,
        "",
        `Issue: ${args.issueRef}`,
        "",
        "## Plan",
        args.planSummary,
      ].join("\n");

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: notesPath,
        message: `Kestrel: notes for ${args.issueRef}`,
        content: Buffer.from(notesContent, "utf-8").toString("base64"),
        branch: branchName,
      });

      const { data: pr } = await octokit.rest.pulls.create({
        owner,
        repo: repoName,
        title: `Kestrel: ${args.issueRef}`,
        head: branchName,
        base: repo.defaultBranch,
        body: `Opened automatically by Kestrel for ${args.issueRef}.\n\n## Plan\n${args.planSummary}\n\n_This PR currently contains only run notes, not a code diff — see docs/roadmap.md for sandboxed execution status._`,
      });

      return { prUrl: pr.html_url };
    } catch (err) {
      this.log.error({ runId: args.runId, err }, "GitHub PR creation failed; falling back to stub");
      return this.fallback.openPr(args);
    }
  }
}
