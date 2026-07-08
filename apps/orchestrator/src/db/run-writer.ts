import pg from "pg";

/**
 * The orchestrator owns run-state transitions (see
 * docs/architecture/03-service-boundaries.md), so it writes directly to the
 * `runs` table rather than round-tripping through the Control API. Uses the
 * same RLS pattern as apps/api/src/db/pool.ts.
 */
export function createDbPool(databaseUrl: string) {
  return new pg.Pool({ connectionString: databaseUrl, max: 5 });
}

export async function updateRunStatus(
  pool: pg.Pool,
  args: { runId: string; orgId: string; status: string; planSummary?: string; prUrl?: string }
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [args.orgId]);
    await client.query(
      `UPDATE runs
       SET status = $1,
           plan_summary = COALESCE($2, plan_summary),
           pr_url = COALESCE($3, pr_url),
           started_at = CASE WHEN started_at IS NULL AND $1 != 'queued' THEN now() ELSE started_at END,
           finished_at = CASE WHEN $1 IN ('done', 'failed') THEN now() ELSE finished_at END
       WHERE id = $4`,
      [args.status, args.planSummary ?? null, args.prUrl ?? null, args.runId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
