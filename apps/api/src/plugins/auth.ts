import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifySession, type SessionClaims } from "../auth/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionClaims;
  }
}

export interface AuthPluginOptions {
  jwtSecret: string;
}

/**
 * Registers a request decorator (`request.user`) and an `authenticate`
 * preHandler. Routes opt in explicitly by adding
 * `{ preHandler: app.authenticate }` rather than authenticating globally —
 * keeps public routes (health, auth itself) obviously public.
 */
export default fp<AuthPluginOptions>(async (app: FastifyInstance, opts) => {
  app.decorateRequest("user", undefined);

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Missing or malformed Authorization header." },
      });
    }

    const token = header.slice("Bearer ".length);
    try {
      request.user = verifySession(token, opts.jwtSecret);
    } catch {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Invalid or expired session token." },
      });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
