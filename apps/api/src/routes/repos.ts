import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { repoIndexRequestedEvent, QUEUE_NAMES } from "@kestrel/event-schemas";
import type { DbPool } from "../db/pool.js";
import type { Queues } from "../queue/client.js";
import { insertRepository, getRepository } from "../db/repositories-repository.js";
import { getLatestRepoSummary } from "../db/repo-summaries-repository.js";

const registerRepoSchema = z.object({
  provider: z.enum(["github", "gitlab", "bitbucket"]),
  external_id: z.string().min(1),
  full_name: z.string().min(1),
  default_branch: z.string().min(1).default("main"),
  installation_id: z.string().optional(),
});

export async function reposRoutes(app: FastifyInstance, opts: { db: DbPool; queues: Queues }) {
  app.post(
    "/v1/repos",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const parsed = registerRepoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "validation_error",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        });
      }

      const orgId = request.user!.org_id;
      const repo = await insertRepository(opts.db, {
        orgId,
        provider: parsed.data.provider,
        externalId: parsed.data.external_id,
        fullName: parsed.data.full_name,
        defaultBranch: parsed.data.default_branch,
        installationId: parsed.data.installation_id,
      });

      // Kick off a best-effort repository index in the background. If the
      // repo has no installation_id yet (GitHub App not installed, or
      // installed after this call — see docs/api-docs.md), the orchestrator
      // records a `skipped_no_installation` summary rather than failing
      // loudly; the org owner can trigger a re-index later by re-registering
      // or via a future POST /v1/repos/:id/reindex endpoint (not yet built).
      const event = repoIndexRequestedEvent.parse({
        event_id: randomUUID(),
        event_version: 1,
        occurred_at: new Date().toISOString(),
        org_id: orgId,
        trace_id: randomUUID(),
        event_type: "repo.index.requested",
        payload: { repository_id: repo.id },
      });
      await opts.queues.repoIndexQueue.add(QUEUE_NAMES.repoIndexRequested, event, {
        attempts: 2,
        removeOnComplete: 500,
        removeOnFail: 2000,
      });

      return reply.status(201).send(repo);
    }
  );

  app.get(
    "/v1/repos/:repoId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { repoId } = request.params as { repoId: string };
      const repo = await getRepository(opts.db, { repositoryId: repoId, orgId: request.user!.org_id });
      if (!repo) {
        return reply.status(404).send({
          error: { code: "repo_not_found", message: `No repository found with id ${repoId}.` },
        });
      }
      return repo;
    }
  );

  app.get(
    "/v1/repos/:repoId/summary",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { repoId } = request.params as { repoId: string };
      const orgId = request.user!.org_id;

      const repo = await getRepository(opts.db, { repositoryId: repoId, orgId });
      if (!repo) {
        return reply.status(404).send({
          error: { code: "repo_not_found", message: `No repository found with id ${repoId}.` },
        });
      }

      const summary = await getLatestRepoSummary(opts.db, { repositoryId: repoId, orgId });
      if (!summary) {
        return reply.status(404).send({
          error: {
            code: "summary_not_ready",
            message: "No index has completed for this repository yet.",
          },
        });
      }
      return summary;
    }
  );
}
