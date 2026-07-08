import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { repoIndexRequestedEvent, QUEUE_NAMES } from "@kestrel/event-schemas";
import type { DbPool } from "../db/pool.js";
import type { Queues } from "../queue/client.js";
import type { Env } from "../config/env.js";
import { createInstallLinkToken, consumeInstallLinkToken } from "../db/install-link-repository.js";
import { insertRepository } from "../db/repositories-repository.js";

const callbackQuerySchema = z.object({
  installation_id: z.string(),
  state: z.string(),
  setup_action: z.string().optional(),
});

/**
 * Reverses the order the earlier flow required: previously an org had to
 * register a repo via POST /v1/repos *before* installing the GitHub App, so
 * the webhook receiver (routes/webhooks.ts) had something to match against.
 * This lets an org install the App first — Kestrel generates a one-time
 * link token, the org visits GitHub's install page with it as `state`,
 * and this callback (hit by GitHub's redirect) uses that state to know
 * which org the resulting installation belongs to, then lists and
 * registers every repo the installation was granted access to.
 */
export async function integrationsRoutes(
  app: FastifyInstance,
  opts: { db: DbPool; queues: Queues; env: Env }
) {
  app.post(
    "/v1/integrations/github/install-url",
    { preHandler: app.authenticate },
    async (request, reply) => {
      if (!opts.env.GITHUB_APP_SLUG) {
        return reply.status(503).send({
          error: {
            code: "github_app_not_configured",
            message: "GITHUB_APP_SLUG is not set — the GitHub App install flow isn't configured on this server.",
          },
        });
      }

      const { token, expiresAt } = await createInstallLinkToken(opts.db, {
        orgId: request.user!.org_id,
      });

      const url = `https://github.com/apps/${opts.env.GITHUB_APP_SLUG}/installations/new?state=${token}`;
      return reply.send({ url, expires_at: expiresAt.toISOString() });
    }
  );

  app.get("/v1/integrations/github/callback", async (request, reply) => {
    const parsed = callbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: "Missing installation_id or state." },
      });
    }

    const consumed = await consumeInstallLinkToken(opts.db, { token: parsed.data.state });
    if (!consumed) {
      request.log.warn({ state: parsed.data.state }, "install callback with invalid/expired/reused state token");
      return reply.status(400).send({
        error: {
          code: "invalid_or_expired_link",
          message: "This installation link is invalid, expired, or already used. Start the install flow again.",
        },
      });
    }

    if (!opts.env.GITHUB_APP_ID || !opts.env.GITHUB_APP_PRIVATE_KEY) {
      return reply.status(503).send({
        error: { code: "github_app_not_configured", message: "GitHub App credentials are not configured." },
      });
    }

    const privateKey = opts.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
    const orgId = consumed.orgId;
    const installationId = parsed.data.installation_id;

    try {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: { appId: opts.env.GITHUB_APP_ID, privateKey, installationId },
      });

      const { data } = await octokit.request("GET /installation/repositories");

      const registered = await Promise.all(
        data.repositories.map(async (repo) => {
          const record = await insertRepository(opts.db, {
            orgId,
            provider: "github",
            externalId: String(repo.id),
            fullName: repo.full_name,
            defaultBranch: repo.default_branch ?? "main",
            installationId,
          });

          const event = repoIndexRequestedEvent.parse({
            event_id: randomUUID(),
            event_version: 1,
            occurred_at: new Date().toISOString(),
            org_id: orgId,
            trace_id: randomUUID(),
            event_type: "repo.index.requested",
            payload: { repository_id: record.id },
          });
          await opts.queues.repoIndexQueue.add(QUEUE_NAMES.repoIndexRequested, event, {
            attempts: 2,
            removeOnComplete: 500,
            removeOnFail: 2000,
          });

          return { id: record.id, full_name: record.full_name };
        })
      );

      request.log.info({ orgId, installationId, count: registered.length }, "GitHub App installed and repos registered");

      return reply.send({ ok: true, installation_id: installationId, repositories: registered });
    } catch (err) {
      request.log.error({ orgId, installationId, err }, "failed to complete GitHub App install callback");
      return reply.status(502).send({
        error: {
          code: "github_api_error",
          message: "The installation was linked to your org, but listing repositories from GitHub failed. Try POST /v1/repos manually, or retry the install flow.",
        },
      });
    }
  });
}
