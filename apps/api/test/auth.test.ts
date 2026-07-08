import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { authRoutes } from "../src/routes/auth.js";
import type { DbPool } from "../src/db/pool.js";
import type { Env } from "../src/config/env.js";

// A pool stub that throws if a route tries to touch the DB — these tests
// only exercise validation paths that must fail before any query happens.
const dbStub = {
  connect: async () => {
    throw new Error("test should not reach the database");
  },
  query: async () => {
    throw new Error("test should not reach the database");
  },
} as unknown as DbPool;

const envStub = { JWT_SECRET: "test-secret", JWT_EXPIRES_IN: "1h" } as Env;

describe("auth routes — validation", () => {
  it("rejects registration with a short password before touching the DB", async () => {
    const app = Fastify();
    await app.register(authRoutes, { db: dbStub, env: envStub });

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        org_name: "Acme Inc",
        email: "person@example.com",
        password: "short",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });

  it("rejects login with a malformed email before touching the DB", async () => {
    const app = Fastify();
    await app.register(authRoutes, { db: dbStub, env: envStub });

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "not-an-email", password: "whatever" },
    });

    expect(response.statusCode).toBe(400);
  });
});
