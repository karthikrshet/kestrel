import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { jobCreatedEvent, QUEUE_NAMES } from "@kestrel/event-schemas";
import type { Queues } from "../queue/client.js";
import type { DbPool } from "../db/pool.js";
import { insertRun, getRun } from "../db/runs-repository.js";
import { getRepository } from "../db/repositories-repository.js";

const createRunSchema = z.object({
  repository_id: z.string().uuid(),
  issue_ref: z.string().min(1),
});

/**
 * All routes here require `app.authenticate` (see plugins/auth.ts), so
 * `request.user.org_id` comes from a verified JWT — never from the request
 * body/query. `repository_id` is now validated against the `repositories`
 * table (and implicitly scoped to the caller's org via RLS) before a run
 * is created — closing the gap where any UUID was previously accepted.
 */
export async function runsRoutes(app: FastifyInstance, opts: { queues: Queues; db: DbPool }) {
  app.post(
    "/v1/runs",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const parsed = createRunSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "validation_error",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        });
      }

      const orgId = request.user!.org_id;

      const repo = await getRepository(opts.db, { repositoryId: parsed.data.repository_id, orgId });
      if (!repo) {
        return reply.status(404).send({
          error: {
            code: "repo_not_found",
            message: `No repository found with id ${parsed.data.repository_id} for this org. Register it via POST /v1/repos first.`,
          },
        });
      }

      const run_id = randomUUID();

      const run = await insertRun(opts.db, {
        runId: run_id,
        orgId,
        repositoryId: parsed.data.repository_id,
        issueRef: parsed.data.issue_ref,
      });

      const event = jobCreatedEvent.parse({
        event_id: randomUUID(),
        event_version: 1,
        occurred_at: new Date().toISOString(),
        org_id: orgId,
        trace_id: randomUUID(),
        event_type: "job.created",
        payload: {
          run_id,
          repository_id: parsed.data.repository_id,
          issue_ref: parsed.data.issue_ref,
        },
      });

      await opts.queues.jobCreatedQueue.add(QUEUE_NAMES.jobCreated, event, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });

      request.log.info({ run_id, orgId }, "run persisted to Postgres and enqueued to job.created");

      return reply.status(201).send({ run_id, status: run.status });
    }
  );

  app.get(
    "/v1/runs/:runId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const orgId = request.user!.org_id;

      const run = await getRun(opts.db, { runId, orgId });
      if (!run) {
        return reply.status(404).send({
          error: { code: "run_not_found", message: `No run found with id ${runId}.` },
        });
      }
      return run;
    }
  );
}
