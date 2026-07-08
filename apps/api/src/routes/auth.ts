import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { DbPool } from "../db/pool.js";
import { createOrgAndOwner, findUserByEmail } from "../db/auth-repository.js";
import { signSession } from "../auth/jwt.js";
import type { Env } from "../config/env.js";

const registerSchema = z.object({
  org_name: z.string().min(2),
  home_region: z.string().min(2).default("us-east-1"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const BCRYPT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance, opts: { db: DbPool; env: Env }) {
  app.post("/v1/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: parsed.error.errors.map((e) => e.message).join(", "),
        },
      });
    }

    const existing = await findUserByEmail(opts.db, parsed.data.email);
    if (existing) {
      return reply.status(409).send({
        error: { code: "email_taken", message: "An account with this email already exists." },
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
    const { orgId, userId } = await createOrgAndOwner(opts.db, {
      orgName: parsed.data.org_name,
      homeRegion: parsed.data.home_region,
      email: parsed.data.email,
      passwordHash,
    });

    const token = signSession(
      { sub: userId, org_id: orgId, role: "owner" },
      opts.env.JWT_SECRET,
      opts.env.JWT_EXPIRES_IN
    );

    return reply.status(201).send({ token, org_id: orgId, user_id: userId });
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: "validation_error", message: "Valid email and password are required." },
      });
    }

    const user = await findUserByEmail(opts.db, parsed.data.email);
    // Same error for "no such user" and "wrong password" — don't leak which
    // one it was, that's an account-enumeration vector.
    const invalidCredentials = () =>
      reply.status(401).send({
        error: { code: "invalid_credentials", message: "Invalid email or password." },
      });

    if (!user || !user.password_hash) {
      return invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordMatches) {
      return invalidCredentials();
    }

    const token = signSession(
      { sub: user.id, org_id: user.org_id, role: user.role },
      opts.env.JWT_SECRET,
      opts.env.JWT_EXPIRES_IN
    );

    return reply.send({ token, org_id: user.org_id, user_id: user.id });
  });
}
