# Database Design

## Principles

- **Tenant isolation at the schema level.** Every table carries `org_id`; row-level security (RLS) policies enforce isolation even if application code has a bug.
- **Postgres is region-pinned per tenant.** A tenant's control-plane writes always land in their home region. Cross-region reads (e.g., a dashboard showing global stats to Kestrel's own ops team) go through a read replica or an analytics warehouse, never the live OLTP path.
- **Hot/cold split.** Run logs, diffs, and step-level events are high-volume and append-only — they live in object storage + a time-series/log store, not Postgres. Postgres holds metadata and pointers.

## Core schema (control plane)

```sql
-- Organizations (tenants)
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  home_region TEXT NOT NULL, -- e.g. 'us-east-1', 'eu-west-1'
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);

CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  provider TEXT NOT NULL, -- github | gitlab | bitbucket
  external_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider, external_id)
);

-- One row per agent run (an "execution")
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  repository_id UUID NOT NULL REFERENCES repositories(id),
  triggered_by UUID REFERENCES users(id),
  issue_ref TEXT, -- external issue number/URL
  status TEXT NOT NULL DEFAULT 'queued', -- queued|planning|executing|reviewing|awaiting_approval|done|failed
  plan_summary TEXT,
  pr_url TEXT,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_org_status ON runs(org_id, status);

-- Individual plan/tool-call steps within a run (metadata only; full payload in object storage)
CREATE TABLE run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id),
  step_index INT NOT NULL,
  step_type TEXT NOT NULL, -- plan|tool_call|reflection
  status TEXT NOT NULL DEFAULT 'pending',
  log_object_key TEXT, -- pointer into object storage
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, step_index)
);

-- Semantic memory: durable facts about a repo/org (see docs/agents/memory-architecture.md)
CREATE TABLE semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  repository_id UUID REFERENCES repositories(id),
  fact TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_run_id UUID REFERENCES runs(id),
  embedding_id TEXT, -- pointer into vector store
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by UUID REFERENCES semantic_memory(id)
);

-- Row-level security example
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_runs ON runs
  USING (org_id = current_setting('app.current_org_id')::UUID);
```

## Data placement summary

| Data | Store | Reasoning |
|---|---|---|
| Org/user/repo/run metadata | Postgres (region-pinned) | Strong consistency, relational, moderate volume |
| Run step logs, diffs, LLM transcripts | Object storage (S3-compatible) | High volume, append-only, cheap, replicated async |
| Episodic memory (per-run) | Object storage + Postgres pointer | Same reasoning as logs |
| Semantic memory facts | Postgres + vector store | Needs both relational filtering and similarity search |
| Repository graph (dependency/symbol graph) | Graph-capable store (e.g., Postgres + recursive CTEs at small scale; Neo4j/Amazon Neptune at large scale) | Graph traversal queries |
| Job/step state for in-flight runs | Redis | Sub-millisecond reads for the orchestrator's hot path |
| Rate limits, idempotency keys | Redis | TTL-based, high write volume, disposable |

## Sharding strategy at 10M users

- **Postgres:** shard by `org_id` hash across N regional clusters. Each shard is a normal Postgres primary + read replicas; no cross-shard joins are needed because all core tables are tenant-scoped.
- **Vector store:** partition by `org_id` namespace; most similarity search is intra-tenant.
- **Object storage:** naturally scales; key prefix by `org_id/repo_id/run_id` for lifecycle policies (e.g., expire raw logs after 90 days, keep PR diffs indefinitely).
