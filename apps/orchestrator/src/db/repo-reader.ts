import type pg from "pg";

export interface RepoForRun {
  fullName: string;
  defaultBranch: string;
  installationId: string | null;
}

/**
 * The orchestrator reads repository metadata directly from Postgres rather
 * than calling back into the Control API — same reasoning as
 * db/run-writer.ts: this is the orchestrator's own hot path, and an extra
 * network hop to the API for data it can read directly buys nothing.
 */
export async function getRepoForRun(
  pool: pg.Pool,
  args: { repositoryId: string; orgId: string }
): Promise<RepoForRun | null> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [args.orgId]);
    const { rows } = await client.query<{
      full_name: string;
      default_branch: string;
      installation_id: string | null;
    }>(
      `SELECT full_name, default_branch, installation_id FROM repositories WHERE id = $1`,
      [args.repositoryId]
    );
    if (!rows[0]) return null;
    return {
      fullName: rows[0].full_name,
      defaultBranch: rows[0].default_branch,
      installationId: rows[0].installation_id,
    };
  } finally {
    client.release();
  }
}
