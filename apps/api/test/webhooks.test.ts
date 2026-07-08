import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { webhooksRoutes, registerRawBodyCapture } from "../src/routes/webhooks.js";
import type { DbPool } from "../src/db/pool.js";
import type { Env } from "../src/config/env.js";

const SECRET = "test-webhook-secret";
const envStub = { GITHUB_WEBHOOK_SECRET: SECRET } as Env;
const dbStub = {} as DbPool; // ping events never touch the DB

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("GitHub webhook signature verification", () => {
  it("accepts a correctly signed ping event", async () => {
    const app = Fastify();
    registerRawBodyCapture(app);
    await app.register(webhooksRoutes, { db: dbStub, env: envStub });

    const payload = JSON.stringify({ zen: "Keep it logically awesome." });
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "ping",
        "x-hub-signature-256": sign(payload, SECRET),
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const app = Fastify();
    registerRawBodyCapture(app);
    await app.register(webhooksRoutes, { db: dbStub, env: envStub });

    const payload = JSON.stringify({ zen: "Keep it logically awesome." });
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "ping",
        "x-hub-signature-256": sign(payload, "wrong-secret"),
      },
      payload,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_signature");
  });

  it("rejects a request with no signature header at all", async () => {
    const app = Fastify();
    registerRawBodyCapture(app);
    await app.register(webhooksRoutes, { db: dbStub, env: envStub });

    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "ping" },
      payload: JSON.stringify({ zen: "no signature here" }),
    });

    expect(response.statusCode).toBe(401);
  });
});
