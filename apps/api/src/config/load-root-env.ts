import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `pnpm --filter @kestrel/api exec ...` (used by the root `migrate` script)
 * and some editor/CI invocations run with CWD set to the package directory,
 * not the monorepo root — so dotenv's default "look for .env in CWD"
 * behavior silently finds nothing, and every DATABASE_URL/REDIS_URL/etc.
 * falls back to (or errors on) defaults. This resolves the root .env path
 * relative to this file's own location instead of trusting CWD.
 *
 * Docker Compose doesn't need this (it injects env vars directly via
 * `env_file`), but it's harmless to call there too — dotenv doesn't
 * override already-set process.env values by default.
 */
export function loadRootEnv(importMetaUrl: string, levelsUpToRoot: number) {
  const here = dirname(fileURLToPath(importMetaUrl));
  const rootEnvPath = resolve(here, ...Array(levelsUpToRoot).fill(".."), ".env");
  config({ path: rootEnvPath });
}
