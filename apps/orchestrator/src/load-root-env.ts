import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * See apps/api/src/config/load-root-env.ts for the full rationale — this is
 * a deliberate small duplication rather than a cross-app import (apps only
 * share code via packages/*), since the logic is a few lines and importing
 * across app boundaries would blur the service-boundary lines documented in
 * docs/architecture/03-service-boundaries.md.
 */
export function loadRootEnv(importMetaUrl: string, levelsUpToRoot: number) {
  const here = dirname(fileURLToPath(importMetaUrl));
  const rootEnvPath = resolve(here, ...Array(levelsUpToRoot).fill(".."), ".env");
  config({ path: rootEnvPath });
}
