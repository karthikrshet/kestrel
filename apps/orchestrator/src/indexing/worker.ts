import { Worker } from "bullmq";
import type IORedis from "ioredis";
import type pg from "pg";
import type { Logger } from "pino";
import { repoIndexRequestedEvent, QUEUE_NAMES } from "@kestrel/event-schemas";
import { getRepoForRun } from "../db/repo-reader.js";
import { writeRepoSummary } from "../db/repo-summary-writer.js";
import { cloneRepoWorkspace, cleanupWorkspace } from "../execution/workspace.js";
import { indexRepository } from "./repo-indexer.js";

export function createIndexingWorker(args: {
  connection: IORedis;
  dbPool: pg.Pool;
  log: Logger;
  githubAppId?: string;
  githubPrivateKey?: string;
}): Worker {
  return new Worker(
    QUEUE_NAMES.repoIndexRequested,
    async (job) => {
      const event = repoIndexRequestedEvent.parse(job.data);
      const { repository_id } = event.payload;
      const orgId = event.org_id;

      const repo = await getRepoForRun(args.dbPool, { repositoryId: repository_id, orgId });

      if (!repo?.installationId || !args.githubAppId || !args.githubPrivateKey) {
        args.log.info(
          { repository_id },
          "skipping index: no GitHub App configured or no installation_id on file for this repo"
        );
        await writeRepoSummary(args.dbPool, {
          orgId,
          repositoryId: repository_id,
          status: "skipped_no_installation",
        });
        return;
      }

      let workspace: string | undefined;
      try {
        const cloned = await cloneRepoWorkspace({
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          appId: args.githubAppId,
          privateKey: args.githubPrivateKey,
          installationId: repo.installationId,
          dirPrefix: `kestrel-index-${repository_id.slice(0, 8)}`,
        });
        workspace = cloned.path;

        args.log.info({ repository_id }, "indexing repository");
        const result = await indexRepository(workspace);

        await writeRepoSummary(args.dbPool, {
          orgId,
          repositoryId: repository_id,
          status: "completed",
          result,
        });
        args.log.info(
          { repository_id, fileCount: result.fileCount },
          "repository index completed"
        );
      } catch (err) {
        args.log.error({ repository_id, err }, "repository indexing failed");
        await writeRepoSummary(args.dbPool, {
          orgId,
          repositoryId: repository_id,
          status: "failed",
        });
      } finally {
        if (workspace) await cleanupWorkspace(workspace).catch(() => undefined);
      }
    },
    { connection: args.connection, concurrency: 3 } // indexing is more resource-intensive per job than run steps; lower concurrency
  );
}
