# Roadmap

Kestrel is built in phases. Each phase is usable on its own — nothing here is vaporware-by-design; it's sequenced because each layer depends on the one before it.

## Phase 0 — Scaffold (this repository, today)

- [x] Monorepo structure (frontend, API, docs, infra)
- [x] Landing page (Hero, Features, Architecture, Demo, Open Source, Roadmap, Testimonials, Pricing, FAQ)
- [x] API skeleton with health check, config, and route structure
- [x] Docker Compose for local dev (Postgres, Redis, API, Web)
- [x] GitHub Actions CI (lint, test, build, typecheck, security scan)
- [x] Full architecture documentation (C4, DB, events, queues, scaling, DR, security)
- [x] Agent memory + reasoning framework design docs
- [x] Repository intelligence engine design doc
- [x] SEO / AEO / GEO strategy and assets
- [ ] **No `pnpm-lock.yaml` is committed** — this scaffold was generated without running a real `pnpm install` against the npm registry, so there's no lockfile yet. The first real `pnpm install` in a working clone should commit it; CI currently uses `--no-frozen-lockfile` to accommodate this and should switch to `--frozen-lockfile` once a lockfile exists (see `.github/workflows/ci.yml`'s header comment).

## Phase 1 — Single-repo agent (MVP)

- [x] Postgres schema + migration runner for orgs, users, repos, runs, run_steps, semantic_memory
- [x] Real event-driven job pipeline: API enqueues `job.created` (BullMQ), orchestrator worker consumes it
- [x] Run state machine (queued → planning → executing → reviewing → awaiting_human_approval → done/failed) with a stubbed planner
- [x] Shared, versioned event schemas (`packages/event-schemas`) so producer/consumer can't silently drift
- [x] Runs persisted to Postgres (API writes on creation, orchestrator updates status/plan/PR on each transition), replacing the earlier in-memory map
- [x] Real LLM-backed planner (`LlmPlanner`, calls the Anthropic API per `LLM_API_KEY`/`LLM_MODEL`) with automatic fallback to the deterministic stub if no key is configured or the call fails
- [x] Auth: email/password registration and login issuing JWTs; `org_id` is derived from a verified token on every run-related request, never accepted from the caller
- [x] `POST /v1/repos` and repository validation — `POST /v1/runs` now returns `404 repo_not_found` for any repository not registered under the caller's org
- [x] GitHub App integration — `GithubPrOpener` mints an installation access token, creates a branch, commits a run-notes file, and opens a real PR via Octokit, with automatic fallback to a stub PR URL if the app isn't configured or a repo has no `installation_id` on file
- [x] Sandboxed execution (opt-in) — `DockerSandboxExecutor` clones the real repo with a short-lived installation token and actually runs the detected test command in a container (network disabled, memory/CPU/pids limits). **Caveat, stated plainly:** this uses the host Docker socket, which is a materially weaker isolation boundary than the Firecracker/gVisor microVM fleet described in `docs/architecture/09-security-architecture.md` — appropriate for a trusted local/self-hosted setup, not for multi-tenant or untrusted input. Disabled by default; requires `EXECUTION_MODE=docker` and `infra/docker-compose.sandbox.yml`. `git_commit`/`git_push` plan steps are a documented no-op in this executor since the actual commit happens via the GitHub Contents API in `GithubPrOpener`, not a second local-git path.
- [x] Postgres RLS actually enforced, not just declared — `0004_app_role.sql` creates a non-owner `kestrel_app` role (Postgres RLS silently doesn't apply to a table's owner, which the app's DB role had been by default; see `docs/architecture/09-security-architecture.md` for the full correction). `0005_link_installation_function.sql` adds one narrow `SECURITY DEFINER` function for the single legitimate cross-tenant lookup the webhook receiver needs, rather than a broad bypass.
- [x] GitHub webhook receiver — verifies `X-Hub-Signature-256` (constant-time comparison), handles `ping` and `installation`/`installation_repositories` events to auto-populate `installation_id` on repos already registered via `POST /v1/repos`
- [x] Basic repository indexing — registering a repo enqueues a `repo.index.requested` job; the orchestrator clones it and computes real file counts, LOC-by-language, and manifest-based dependency lists (`GET /v1/repos/:id/summary`). This is the "repository summary" slice of `docs/repo-intelligence/engine-design.md`, not the full graph/dependency/reachability engine described there — no symbol graph, call graph, or SAST integration yet.
- [x] OAuth-style install flow — `POST /v1/integrations/github/install-url` + `GET /v1/integrations/github/callback` let an org install the GitHub App first; the callback lists and auto-registers every granted repo via a one-time, single-use link token. The webhook-based flow (repo registered first, then App installed) still works too — both are supported.
- [ ] Full repository intelligence engine (dependency/call graph, architecture analysis, dead code detection, vulnerability scanning) — the indexer built earlier is real but intentionally modest
- [ ] Multi-org membership (this scaffold models one org per user — see `apps/api/migrations/0002_add_auth.sql`)
- [ ] Production-grade sandboxing (Firecracker/gVisor microVM fleet) to replace the Docker-socket approach above for any non-trusted-local deployment

## Phase 2 — Repository intelligence engine

- [ ] Dependency graph construction (per-language parsers)
- [ ] Static analysis integrations (security, dead code, complexity)
- [ ] Architecture diagram auto-generation from the graph
- [ ] Technical debt scoring and reporting

## Phase 3 — Multi-agent collaboration

- [ ] Planner / Coder / Reviewer / Tester agent roles
- [ ] Debate framework for conflicting proposals
- [ ] Tree-of-Thoughts search for non-trivial fixes
- [ ] Reflection loop after each run (what worked, what didn't)

## Phase 4 — Memory across runs

- [ ] Episodic memory (per-run history, retrievable)
- [ ] Semantic memory (facts about a repo/org that persist across runs)
- [ ] Long-term memory store with retrieval-augmented planning
- [ ] Cross-repository / cross-org learning (with tenant isolation)

## Phase 5 — Scale-out

- [ ] Move job queue from BullMQ/Redis to Kafka for durability at 100k+ concurrent executions
- [ ] Multi-region deployment (active-active read, region-pinned writes)
- [ ] Horizontal sandbox execution fleet (Firecracker microVMs or gVisor)
- [ ] Full observability stack (traces, metrics, logs, cost-per-run tracking)

## Explicitly out of scope for now

- Fully autonomous merges without human approval (safety gate stays on by default)
- Training or fine-tuning custom models (Kestrel is model-agnostic; bring your own provider/key)
