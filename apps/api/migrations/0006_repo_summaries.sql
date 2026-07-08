-- 0006_repo_summaries.sql
-- Stores the output of the (intentionally modest) repository indexer —
-- see apps/orchestrator/src/indexing/repo-indexer.ts and
-- docs/repo-intelligence/engine-design.md for what this is and isn't.

CREATE TABLE repo_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed | skipped_no_installation
  file_count INT,
  loc_by_language JSONB,
  dependencies JSONB,
  notes TEXT[],
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_repo_summaries_repo ON repo_summaries(repository_id, created_at DESC);

ALTER TABLE repo_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_repo_summaries ON repo_summaries
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Explicit grant as a safety net alongside the ALTER DEFAULT PRIVILEGES in
-- 0004_app_role.sql, in case this table is ever created by a different
-- migration role in some environment.
GRANT SELECT, INSERT, UPDATE, DELETE ON repo_summaries TO kestrel_app;
