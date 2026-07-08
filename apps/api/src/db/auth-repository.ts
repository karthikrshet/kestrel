import type pg from "pg";
import type { DbPool } from "../db/pool.js";

export interface UserRecord {
  id: string;
  org_id: string;
  email: string;
  role: string;
  password_hash: string | null;
}

/**
 * Registration creates both the org and its first user in one transaction.
 * Unlike the RLS-scoped queries elsewhere, this runs without
 * `app.current_org_id` set — there's no org to scope to yet until the
 * INSERT completes within the same transaction.
 */
export async function createOrgAndOwner(
  pool: DbPool,
  args: { orgName: string; homeRegion: string; email: string; passwordHash: string }
): Promise<{ orgId: string; userId: string }> {
  const client: pg.PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const orgResult = await client.query<{ id: string }>(
      `INSERT INTO orgs (name, home_region) VALUES ($1, $2) RETURNING id`,
      [args.orgName, args.homeRegion]
    );
    const orgId = orgResult.rows[0].id;

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO users (org_id, email, role, password_hash)
       VALUES ($1, $2, 'owner', $3) RETURNING id`,
      [orgId, args.email, args.passwordHash]
    );
    const userId = userResult.rows[0].id;

    await client.query("COMMIT");
    return { orgId, userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Login lookup by email. Relies on the global unique constraint added in
 * 0002_add_auth.sql (this scaffold models one org per user — see that
 * migration's comment for the real multi-org caveat). Runs without RLS
 * context since we don't know the org until after this lookup succeeds.
 */
export async function findUserByEmail(pool: DbPool, email: string): Promise<UserRecord | null> {
  const { rows } = await pool.query<UserRecord>(
    `SELECT id, org_id, email, role, password_hash FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
}
