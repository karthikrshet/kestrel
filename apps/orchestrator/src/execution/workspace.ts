import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mintInstallationToken } from "../github/installation-token.js";

const execFileAsync = promisify(execFile);

export interface RepoWorkspace {
  path: string;
}

/**
 * Shallow-clones a repository into a fresh temp directory using a short-lived
 * GitHub App installation token. Shared by DockerSandboxExecutor (real test
 * execution) and the repository indexer (below) — both need "a real local
 * copy of the repo" and previously duplicated this; factored out once a
 * second real caller appeared, per the refactoring-opportunity guidance in
 * docs/repo-intelligence/engine-design.md.
 */
export async function cloneRepoWorkspace(args: {
  fullName: string;
  defaultBranch: string;
  appId: string;
  privateKey: string;
  installationId: string;
  dirPrefix: string;
}): Promise<RepoWorkspace> {
  const token = await mintInstallationToken(args.appId, args.privateKey, args.installationId);
  const dir = await mkdtemp(join(tmpdir(), `${args.dirPrefix}-`));
  const remoteUrl = `https://x-access-token:${token}@github.com/${args.fullName}.git`;

  await execFileAsync(
    "git",
    ["clone", "--depth", "1", "--branch", args.defaultBranch, remoteUrl, dir],
    { timeout: 60_000 }
  );

  return { path: dir };
}

export async function cleanupWorkspace(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
