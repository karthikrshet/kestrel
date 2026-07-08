import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { healthRoutes } from "../src/routes/health.js";

describe("health route", () => {
  it("returns status ok", async () => {
    const app = Fastify();
    await app.register(healthRoutes);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
