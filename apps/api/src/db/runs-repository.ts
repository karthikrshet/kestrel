import type { DbPool } from "./pool.js";
import { withOrgContext } from "./pool.js";

export interface RunRecord {
  id: string;
  org_id: string;
  repository_id: string;
  issue_ref: string | null;
  status: string;
  plan_summary: string | null;
  pr_url: string | null;
  created_at: string;
}

export async function insertRun(
  pool: DbPool,
  args: { runId: string; orgId: string; repositoryId: string; issueRef: string }
): Promise<RunRecord> {
  return withOrgContext(pool, args.orgId, async (client) => {
    const { rows } = await client.query<RunRecord>(
      `INSERT INTO runs (id, org_id, repository_id, issue_ref, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, org_id, repository_id, issue_ref, status, plan_summary, pr_url, created_at`,
      [args.runId, args.orgId, args.repositoryId, args.issueRef]
    );
    return rows[0];
  });
}

export async function getRun(
  pool: DbPool,
  args: { runId: string; orgId: string }
): Promise<RunRecord | null> {
  return withOrgContext(pool, args.orgId, async (client) => {
    const { rows } = await client.query<RunRecord>(
      `SELECT id, org_id, repository_id, issue_ref, status, plan_summary, pr_url, created_at
       FROM runs WHERE id = $1`,
      [args.runId]
    );
    return rows[0] ?? null;
  });
}
