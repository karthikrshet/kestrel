import { randomBytes } from "node:crypto";
import type { DbPool } from "./pool.js";

const TOKEN_TTL_MS = 15 * 60_000;

export async function createInstallLinkToken(
  pool: DbPool,
  args: { orgId: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await pool.query(
    `INSERT INTO install_link_tokens (token, org_id, expires_at) VALUES ($1, $2, $3)`,
    [token, args.orgId, expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Validates and immediately consumes a token in one atomic statement — the
 * WHERE clause (unused, unexpired) and the UPDATE happen together, so a
 * replayed or concurrently-processed callback can't consume the same token
 * twice (no separate check-then-update race).
 */
export async function consumeInstallLinkToken(
  pool: DbPool,
  args: { token: string }
): Promise<{ orgId: string } | null> {
  const { rows } = await pool.query<{ org_id: string }>(
    `UPDATE install_link_tokens
     SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING org_id`,
    [args.token]
  );
  return rows[0] ? { orgId: rows[0].org_id } : null;
}
