import type { DbPool } from "./pool.js";
import { withOrgContext } from "./pool.js";

export interface RepositoryRecord {
  id: string;
  org_id: string;
  provider: string;
  external_id: string;
  full_name: string;
  default_branch: string;
  installation_id: string | null;
  last_indexed_at: string | null;
  created_at: string;
}

export async function insertRepository(
  pool: DbPool,
  args: {
    orgId: string;
    provider: string;
    externalId: string;
    fullName: string;
    defaultBranch: string;
    installationId?: string;
  }
): Promise<RepositoryRecord> {
  return withOrgContext(pool, args.orgId, async (client) => {
    const { rows } = await client.query<RepositoryRecord>(
      `INSERT INTO repositories (org_id, provider, external_id, full_name, default_branch, installation_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, provider, external_id) DO UPDATE
         SET full_name = EXCLUDED.full_name, installation_id = EXCLUDED.installation_id
       RETURNING id, org_id, provider, external_id, full_name, default_branch, installation_id, last_indexed_at, created_at`,
      [args.orgId, args.provider, args.externalId, args.fullName, args.defaultBranch, args.installationId ?? null]
    );
    return rows[0];
  });
}

export async function getRepository(
  pool: DbPool,
  args: { repositoryId: string; orgId: string }
): Promise<RepositoryRecord | null> {
  return withOrgContext(pool, args.orgId, async (client) => {
    const { rows } = await client.query<RepositoryRecord>(
      `SELECT id, org_id, provider, external_id, full_name, default_branch, installation_id, last_indexed_at, created_at
       FROM repositories WHERE id = $1`,
      [args.repositoryId]
    );
    return rows[0] ?? null;
  });
}
