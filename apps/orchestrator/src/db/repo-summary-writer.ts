import type pg from "pg";
import type { RepoSummaryResult } from "../indexing/repo-indexer.js";

export async function writeRepoSummary(
  pool: pg.Pool,
  args: {
    orgId: string;
    repositoryId: string;
    status: "completed" | "failed" | "skipped_no_installation";
    result?: RepoSummaryResult;
  }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [args.orgId]);
    await client.query(
      `INSERT INTO repo_summaries (org_id, repository_id, status, file_count, loc_by_language, dependencies, notes, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        args.orgId,
        args.repositoryId,
        args.status,
        args.result?.fileCount ?? null,
        args.result ? JSON.stringify(args.result.locByLanguage) : null,
        args.result ? JSON.stringify(args.result.dependencies) : null,
        args.result?.notes ?? null,
      ]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
