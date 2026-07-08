import type { DbPool } from "./pool.js";
import { withOrgContext } from "./pool.js";

export interface RepoSummaryRecord {
  id: string;
  repository_id: string;
  status: string;
  file_count: number | null;
  loc_by_language: Record<string, number> | null;
  dependencies: Record<string, string[]> | null;
  notes: string[] | null;
  generated_at: string | null;
  created_at: string;
}

export async function getLatestRepoSummary(
  pool: DbPool,
  args: { repositoryId: string; orgId: string }
): Promise<RepoSummaryRecord | null> {
  return withOrgContext(pool, args.orgId, async (client) => {
    const { rows } = await client.query<RepoSummaryRecord>(
      `SELECT id, repository_id, status, file_count, loc_by_language, dependencies, notes, generated_at, created_at
       FROM repo_summaries
       WHERE repository_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [args.repositoryId]
    );
    return rows[0] ?? null;
  });
}
