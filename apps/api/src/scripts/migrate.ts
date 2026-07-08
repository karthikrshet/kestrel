/**
 * Minimal migration runner: applies .sql files in ./migrations, in order,
 * tracked in a `schema_migrations` table. No rollback support by design —
 * migrations here follow an expand/contract pattern (see CONTRIBUTING.md),
 * so forward-only is intentional, not a shortcut.
 *
 * Usage: pnpm migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadRootEnv } from "../config/load-root-env.js";

loadRootEnv(import.meta.url, 4); // apps/api/src/scripts -> monorepo root

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main() {
  // Migrations need to run as the table-owning role (so ALTER ROLE/GRANT
  // statements like 0004_app_role.sql work); the app itself should connect
  // as the non-owner kestrel_app role once migrations have run — see
  // docs/architecture/09-security-architecture.md for why this split matters.
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL must be set.");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip (already applied): ${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`applying: ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
