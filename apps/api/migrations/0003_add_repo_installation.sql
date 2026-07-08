-- 0003_add_repo_installation.sql
-- Tracks which GitHub App installation owns a repository, needed to mint an
-- installation access token when the orchestrator opens a real PR
-- (see apps/orchestrator/src/github/pr-opener.ts).

ALTER TABLE repositories ADD COLUMN installation_id TEXT;

-- In a full implementation this would be populated automatically from the
-- GitHub App's `installation_repositories` webhook event rather than
-- supplied by the caller on POST /v1/repos — noted as a Phase 1 follow-up
-- in docs/roadmap.md rather than built here, since it requires a live
-- webhook receiver to demonstrate meaningfully.
