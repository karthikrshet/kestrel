# Installation Guide

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (recommended path)
- pnpm (`corepack enable` will provide it on Node 20+)

## Option A: Docker Compose (recommended)

```bash
git clone <your-fork-url> kestrel
cd kestrel
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
pnpm migrate   # applies apps/api/migrations/*.sql, including creating the non-owner kestrel_app role
```

This starts:
- `web` — Next.js app on http://localhost:3000
- `api` — Fastify API on http://localhost:4000
- `postgres` — on localhost:5432
- `redis` — on localhost:6379

**Note on database roles:** `pnpm migrate` connects using `MIGRATION_DATABASE_URL` (the table-owning `kestrel` role, needed to run DDL and create roles). The running API and orchestrator connect using `DATABASE_URL` (the non-owner `kestrel_app` role that `0004_app_role.sql` creates), so Postgres row-level security policies actually apply to them — see `docs/architecture/09-security-architecture.md` for why this split exists. If you run `pnpm migrate` before the containers have connected once, that's fine; just make sure it runs before you exercise any API routes that touch the database.

## Option B: Run apps individually

First, from the repo root, install all workspace packages and build the shared event-schemas package (both `apps/api` and `apps/orchestrator` depend on it as a real compiled package, not raw TypeScript source):
```bash
pnpm install
pnpm --filter @kestrel/event-schemas build
```

### API

```bash
cd apps/api
pnpm install
cp .env.example .env   # edit DATABASE_URL / REDIS_URL to point at local instances
pnpm dev
```

### Web

```bash
cd apps/web
pnpm install
pnpm dev
```

## Environment variables

See `.env.example` at the repo root for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `LLM_PROVIDER` | `anthropic` \| `openai` \| `self_hosted` |
| `LLM_API_KEY` | Provider API key (never committed; use `.env`, not source) |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | For the GitHub App integration (Phase 1) |
| `NEXT_PUBLIC_API_URL` | API base URL the web app calls |

## Verifying the setup

```bash
curl http://localhost:4000/health
# => {"status":"ok"}
```

Visit http://localhost:3000 — you should see the Kestrel landing page.

## Running tests / lint / typecheck locally (same checks as CI)

```bash
pnpm -w lint
pnpm -w typecheck
pnpm -w test
pnpm -w build
```
