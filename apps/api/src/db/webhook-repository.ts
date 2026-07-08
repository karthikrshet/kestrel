import type pg from "pg";
import type { DbPool } from "./pool.js";

/**
 * Called by the webhook receiver (routes/webhooks.ts), which is authenticated
 * by HMAC signature verification rather than a user JWT — there's no
 * `org_id` to scope an RLS session to yet, since GitHub's payload only
 * carries the provider's own repo/installation IDs. This calls the
 * `link_installation` SECURITY DEFINER function (see
 * apps/api/migrations/0005_link_installation_function.sql) rather than a
 * raw UPDATE, because a raw UPDATE from the non-owner `kestrel_app` role
 * would be silently blocked by RLS (matching zero rows) now that RLS
 * actually applies to that role. Requires the org owner to have already
 * called POST /v1/repos with the repo's external_id *before* installing the
 * GitHub App — documented in docs/api-docs.md.
 */
export async function linkInstallation(
  pool: DbPool,
  args: { provider: string; externalId: string; installationId: string }
): Promise<{ orgId: string; repositoryId: string } | null> {
  const client: pg.PoolClient = await pool.connect();
  try {
    const { rows } = await client.query<{ id: string; org_id: string }>(
      `SELECT * FROM link_installation($1, $2, $3)`,
      [args.provider, args.externalId, args.installationId]
    );
    if (!rows[0]) return null;
    return { orgId: rows[0].org_id, repositoryId: rows[0].id };
  } finally {
    client.release();
  }
}
