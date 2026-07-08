import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  // Fallback matches the non-owner kestrel_app role from
  // apps/api/migrations/0004_app_role.sql — see
  // docs/architecture/09-security-architecture.md for why connecting as the
  // table-owning role would silently disable RLS.
  DATABASE_URL: z.string().default("postgresql://kestrel_app:kestrel_app_dev_password_change_me@localhost:5432/kestrel"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("dev-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GITHUB_WEBHOOK_SECRET: z.string().default("changeme"),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  // The App's URL-friendly name, e.g. from https://github.com/apps/<slug> —
  // needed to build the "install this app" link in the OAuth-style flow
  // (routes/integrations.ts). Distinct from GITHUB_APP_ID (a numeric ID).
  GITHUB_APP_SLUG: z.string().optional(),
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
