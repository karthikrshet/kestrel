import pg from "pg";
import type { Env } from "../config/env.js";

/**
 * Thin pool wrapper. Every query that touches tenant-scoped tables should
 * go through `withOrgContext`, which sets `app.current_org_id` for the
 * duration of the connection so the RLS policies in
 * apps/api/migrations/0001_init.sql actually apply — see
 * docs/architecture/09-security-architecture.md ("defense in depth beyond
 * just Postgres RLS").
 */
export function createDbPool(env: Env) {
  return new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
}

export type DbPool = pg.Pool;

export async function withOrgContext<T>(
  pool: DbPool,
  orgId: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
