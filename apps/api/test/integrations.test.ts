import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { integrationsRoutes } from "../src/routes/integrations.js";
import type { DbPool } from "../src/db/pool.js";
import type { Queues } from "../src/queue/client.js";
import type { Env } from "../src/config/env.js";

const dbStub = {} as DbPool;
const queuesStub = {} as Queues;

describe("integrations routes — validation", () => {
  it("returns 503 for install-url when GITHUB_APP_SLUG is not configured", async () => {
    const app = Fastify();
    app.decorate("authenticate", async (request: { user?: unknown }) => {
      request.user = { sub: "user-1", org_id: "11111111-1111-1111-1111-111111111111", role: "owner" };
    });
    await app.register(integrationsRoutes, {
      db: dbStub,
      queues: queuesStub,
      env: {} as Env, // no GITHUB_APP_SLUG
    });

    const response = await app.inject({ method: "POST", url: "/v1/integrations/github/install-url" });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("github_app_not_configured");
  });

  it("rejects the install callback when required query params are missing", async () => {
    const app = Fastify();
    app.decorate("authenticate", async () => undefined);
    await app.register(integrationsRoutes, { db: dbStub, queues: queuesStub, env: {} as Env });

    const response = await app.inject({ method: "GET", url: "/v1/integrations/github/callback" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});
