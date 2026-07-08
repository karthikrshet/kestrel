# Kestrel

**The Open-Source Autonomous Software Engineer**

Understand repositories, solve issues, write code, run tests, create pull requests, and accelerate software development with coordinated AI agents.

> ⚠️ **Project status: early-stage scaffold.** This repository ships a working app skeleton (frontend + API + Docker + CI), a complete architecture and design documentation set, and a phased roadmap. The advanced capabilities described in `/docs` (multi-agent memory, repository intelligence, planetary-scale deployment) are **designs to build toward**, not claims about what's already running. See [`docs/roadmap.md`](docs/roadmap.md) for what's implemented today vs. planned.

---

## What is Kestrel?

Kestrel is an open-source platform for autonomous software engineering agents. Point it at a repository and an issue; it builds a working model of the codebase, plans a fix, writes code, runs tests, and opens a pull request — with a human in the loop at every checkpoint.

## Why "Kestrel"?

A kestrel hovers motionless over a field, reads the whole scene, then strikes with precision. That's the model: understand the repository as a whole system before touching a single line.

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/architecture/`](docs/architecture) | System architecture, C4 diagrams, DB design, service boundaries, events, queues, Redis, scaling, DR, security |
| [`docs/agents/`](docs/agents) | Multi-agent memory architecture and reasoning frameworks (Tree of Thoughts, debate, reflection, planning) |
| [`docs/repo-intelligence/`](docs/repo-intelligence) | Repository graph, dependency/security/tech-debt analysis engine design |
| [`docs/seo-aeo-geo/`](docs/seo-aeo-geo) | SEO / Answer-Engine-Optimization / Generative-Engine-Optimization strategy for the marketing site |
| [`docs/roadmap.md`](docs/roadmap.md) | Phased plan, what's built vs. planned |
| [`docs/installation.md`](docs/installation.md) | Local setup |
| [`docs/api-docs.md`](docs/api-docs.md) | API reference |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |

## Monorepo layout

```
kestrel/
├── apps/
│   ├── web/            # Next.js marketing site + dashboard shell
│   ├── api/            # Node/TypeScript backend (Fastify) — control plane
│   └── orchestrator/   # BullMQ worker — consumes job.created, drives the run state machine
├── packages/
│   └── event-schemas/  # Shared, versioned event/queue schemas (Zod)
├── docs/                # Architecture, agents, repo-intelligence, SEO, roadmap
├── infra/               # Docker Compose, env templates
└── .github/workflows/   # CI: lint, test, build, typecheck, security scan
```

## Quick start

```bash
git clone <your-fork-url> kestrel && cd kestrel
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
pnpm migrate   # applies apps/api/migrations/*.sql
```

Frontend: http://localhost:3000
API: http://localhost:4000/health

Try the pipeline end-to-end:
```bash
# 1. Register (creates an org + owner user, returns a JWT)
TOKEN=$(curl -s -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"org_name":"Acme Inc","email":"you@acme.com","password":"at-least-8-chars"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Register a repository (this also enqueues a background repo index)
REPO_ID=$(curl -s -X POST http://localhost:4000/v1/repos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"provider":"github","external_id":"123456","full_name":"acme/webapp","default_branch":"main"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Check the index result once it's completed (real GitHub App install required for a non-skipped result)
curl -H "Authorization: Bearer $TOKEN" "http://localhost:4000/v1/repos/$REPO_ID/summary"

# 3. Create a run
curl -X POST http://localhost:4000/v1/runs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"repository_id\":\"$REPO_ID\",\"issue_ref\":\"acme/webapp#412\"}"

# 4. Check status (org_id comes from the token, not the URL)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/v1/runs/<run_id>
```
Watch the orchestrator container logs — it picks up the job, plans (via your configured LLM, or a deterministic stub if `LLM_API_KEY` is unset), executes, and opens a real pull request if `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` are set and the repo has an `installation_id` on file — otherwise it falls back to a stub PR URL automatically, at every step writing status/plan/PR back to Postgres.

By default, test execution is *simulated* (logged, not actually run). To run real test commands in a container instead:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.sandbox.yml up --build
```
**Read the warning in `infra/docker-compose.sandbox.yml` first** — this mounts the host Docker socket, which is a real security trade-off appropriate for a trusted local setup, not multi-tenant use.

See [`docs/installation.md`](docs/installation.md) for the full setup guide, including running each app without Docker.

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Node.js, TypeScript, Fastify
- **Data:** PostgreSQL, Redis
- **Queue:** BullMQ (Redis-backed) — see [`docs/architecture/05-queue-architecture.md`](docs/architecture/05-queue-architecture.md) for the Kafka-based evolution path at scale
- **CI/CD:** GitHub Actions
- **Infra:** Docker, Docker Compose (local); Kubernetes + Terraform (production target, see architecture docs)

## License

MIT — see [`LICENSE`](LICENSE).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues labeled `good-first-issue` are a good place to start.
