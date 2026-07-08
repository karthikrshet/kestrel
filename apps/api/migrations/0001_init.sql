-- 0001_init.sql
-- Matches docs/architecture/02-database-design.md

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  home_region TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);

CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider, external_id)
);

CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES users(id),
  issue_ref TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  plan_summary TEXT,
  pr_url TEXT,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_org_status ON runs(org_id, status);

CREATE TABLE run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  log_object_key TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, step_index)
);

CREATE TABLE semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_run_id UUID REFERENCES runs(id),
  embedding_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by UUID REFERENCES semantic_memory(id)
);

-- Row-level security (app sets `app.current_org_id` per request/connection)
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_runs ON runs
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_repositories ON repositories
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_semantic_memory ON semantic_memory
  USING (org_id = current_setting('app.current_org_id', true)::UUID);
