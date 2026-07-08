import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual, createHmac } from "node:crypto";
import type { DbPool } from "../db/pool.js";
import { linkInstallation } from "../db/webhook-repository.js";
import type { Env } from "../config/env.js";

/**
 * Fastify's default JSON parser doesn't preserve the raw request body, but
 * HMAC signature verification (below) must be computed over the exact raw
 * bytes GitHub signed — re-serializing the parsed JSON is not guaranteed to
 * byte-match. This installs a JSON content-type parser that captures the
 * raw buffer alongside the parsed body, used only by this route.
 */
export function registerRawBodyCapture(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body: Buffer, done) => {
      (_request as FastifyRequest & { rawBody?: Buffer }).rawBody = body;
      try {
        const json = body.length ? JSON.parse(body.toString("utf-8")) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface GithubInstallationPayload {
  action: string;
  installation: { id: number };
  repositories?: Array<{ id: number; full_name: string }>;
  repositories_added?: Array<{ id: number; full_name: string }>;
}

export async function webhooksRoutes(app: FastifyInstance, opts: { db: DbPool; env: Env }) {
  app.post("/v1/webhooks/github", async (request, reply) => {
    const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return reply.status(400).send({
        error: { code: "missing_body", message: "Expected a request body." },
      });
    }

    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    if (!verifySignature(rawBody, signature, opts.env.GITHUB_WEBHOOK_SECRET)) {
      request.log.warn("rejected webhook with invalid signature");
      return reply.status(401).send({
        error: { code: "invalid_signature", message: "Signature verification failed." },
      });
    }

    const event = request.headers["x-github-event"] as string | undefined;

    if (event === "ping") {
      return reply.send({ ok: true });
    }

    if (event === "installation" || event === "installation_repositories") {
      const payload = request.body as GithubInstallationPayload;
      const installationId = String(payload.installation.id);
      const repos = payload.repositories_added ?? payload.repositories ?? [];

      const results = await Promise.all(
        repos.map(async (repo) => {
          const linked = await linkInstallation(opts.db, {
            provider: "github",
            externalId: String(repo.id),
            installationId,
          });
          if (!linked) {
            request.log.info(
              { fullName: repo.full_name, installationId },
              "no matching repository found — register it via POST /v1/repos before installing the GitHub App"
            );
          } else {
            request.log.info(
              { fullName: repo.full_name, installationId, repositoryId: linked.repositoryId },
              "linked GitHub installation to repository"
            );
          }
          return { fullName: repo.full_name, linked: Boolean(linked) };
        })
      );

      return reply.send({ ok: true, results });
    }

    // Other event types (push, issues, issue_comment, etc.) are acknowledged
    // but not yet acted on — Phase 1 wiring (auto-triggering a run from an
    // issue comment, say) is a documented next step in docs/roadmap.md, not
    // built here.
    return reply.send({ ok: true, event, handled: false });
  });
}
