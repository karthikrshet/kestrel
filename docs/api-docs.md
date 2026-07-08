# API Reference

Base URL (local): `http://localhost:4000`

All endpoints under `/v1/runs` require `Authorization: Bearer <token>`, obtained from `/v1/auth/register` or `/v1/auth/login`. `org_id` is derived from this token — it is never accepted as a request parameter.

## Health

### `GET /health`
No auth required.
```json
{ "status": "ok" }
```

## Auth

### `POST /v1/auth/register`
Creates a new org and its first user (`role: owner`) in one step. This scaffold models one org per user — see the comment in `apps/api/migrations/0002_add_auth.sql` for the real multi-org caveat.
```json
{
  "org_name": "Acme Inc",
  "home_region": "us-east-1",
  "email": "person@acme.com",
  "password": "at-least-8-characters"
}
```
Response:
```json
{ "token": "eyJhbGciOi...", "org_id": "uuid", "user_id": "uuid" }
```

### `POST /v1/auth/login`
```json
{ "email": "person@acme.com", "password": "..." }
```
Response: same shape as register. Invalid credentials return `401` with a generic `invalid_credentials` message (deliberately not distinguishing "no such user" from "wrong password" — see `docs/architecture/09-security-architecture.md`).

## Organizations

### `GET /v1/orgs/:orgId`
Returns org metadata. *(Not yet implemented in this scaffold — planned for Phase 1.)*

## Repositories

### `POST /v1/repos`
Requires `Authorization: Bearer <token>`. Registers a repository under the caller's org. `installation_id` is the GitHub App installation ID for this repo — in a full implementation this would be populated automatically from a GitHub App webhook rather than supplied by the caller (see `apps/api/migrations/0003_add_repo_installation.sql`).
```json
{
  "provider": "github",
  "external_id": "123456",
  "full_name": "acme/webapp",
  "default_branch": "main",
  "installation_id": "78901234"
}
```

### `GET /v1/repos/:repoId`
Requires `Authorization: Bearer <token>`. Returns repo metadata including `last_indexed_at` and `installation_id`.

### `GET /v1/repos/:repoId/summary`
Requires `Authorization: Bearer <token>`. Returns the most recent repository index result — see `docs/repo-intelligence/engine-design.md` for what this is (a modest real implementation: file count, LOC by language, dependency lists) versus the fuller engine described there. Registering a repo automatically enqueues an index job; `404 summary_not_ready` if none has completed yet.
```json
{
  "id": "uuid",
  "repository_id": "uuid",
  "status": "completed",
  "file_count": 842,
  "loc_by_language": { "TypeScript": 41230, "Markdown": 3021 },
  "dependencies": { "package.json": ["react", "fastify", "zod"] },
  "notes": [],
  "generated_at": "2026-07-07T05:00:00.000Z"
}
```
`status` can also be `skipped_no_installation` (no GitHub App / `installation_id` configured for this repo) or `failed`.

## Runs

### `POST /v1/runs`
Requires `Authorization: Bearer <token>`. `repository_id` must reference a repository already registered via `POST /v1/repos` under the same org — otherwise returns `404 repo_not_found`.
```json
{
  "repository_id": "uuid",
  "issue_ref": "acme/webapp#412"
}
```
Response:
```json
{ "run_id": "uuid", "status": "queued" }
```

### `GET /v1/runs/:runId`
Requires `Authorization: Bearer <token>`. `org_id` comes from the token, so a token from one org can never read another org's run (enforced both at the query layer and by Postgres RLS).
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "repository_id": "uuid",
  "issue_ref": "acme/webapp#412",
  "status": "executing",
  "plan_summary": "1. Read repository context ... 2. Run existing test suite ...",
  "pr_url": null,
  "created_at": "2026-07-06T10:00:00.000Z"
}
```

### `GET /v1/runs/:runId/steps/:stepIndex/log`
Returns the raw step log (proxied from object storage).

### `POST /v1/runs/:runId/approve`
Human approval to proceed past a gated checkpoint (e.g., merge the PR).

### `POST /v1/runs/:runId/cancel`
Cancels an in-progress run.

## GitHub App install flow

### `POST /v1/integrations/github/install-url`
Requires `Authorization: Bearer <token>`. Generates a one-time, 15-minute link token and returns a URL to GitHub's App installation page. Requires `GITHUB_APP_SLUG` to be configured; returns `503 github_app_not_configured` otherwise.
```json
{ "url": "https://github.com/apps/kestrel-agent/installations/new?state=...", "expires_at": "2026-07-07T05:15:00.000Z" }
```
Redirect the user to `url`. After they install the App (choosing which repos to grant access to), GitHub redirects them to this server's configured Setup URL, which should point at the callback below.

### `GET /v1/integrations/github/callback`
No `Authorization` header — authenticated instead by the one-time `state` token, which GitHub passes back exactly as given. Public because it's hit by a browser redirect from GitHub, not an API client with a stored session.

Query params (set by GitHub's redirect): `installation_id`, `state`, `setup_action`.

On success: lists every repository the installation was granted, registers each one (upserting by `provider` + `external_id`, same as `POST /v1/repos`), sets `installation_id` on all of them, and enqueues a `repo.index.requested` job for each.
```json
{
  "ok": true,
  "installation_id": "78901234",
  "repositories": [{ "id": "uuid", "full_name": "acme/webapp" }]
}
```
`400 invalid_or_expired_link` if the state token is missing, expired, or already used. `502 github_api_error` if the installation was linked but the GitHub API call to list repos failed (repos can then be added manually via `POST /v1/repos`).

This is the reverse order from the webhook-based flow in the section below: here, the App can be installed *first*, and Kestrel discovers + registers the repos. In the webhook flow, the repo must be registered *first*, and the webhook only fills in `installation_id` for a match it finds. Both are supported; this one is the smoother UX when starting from scratch.

## Webhooks (incoming)

### `POST /v1/webhooks/github`
Verifies the `X-Hub-Signature-256` header against `GITHUB_WEBHOOK_SECRET` using constant-time HMAC-SHA256 comparison — requests with a missing or invalid signature get `401` before any payload processing happens.

Handled events:
- `ping` — acknowledged, no side effects.
- `installation` / `installation_repositories` — for each repository in the payload, looks up a matching row in `repositories` by `(provider='github', external_id)` and sets its `installation_id`. **This requires the repository to already be registered via `POST /v1/repos` before the GitHub App is installed** — this scaffold doesn't yet have an OAuth-style flow to create the org-to-installation link the other way around (see `docs/roadmap.md`).
- Any other event type is acknowledged (`200 {"ok": true, "handled": false}`) but not yet acted on.

## Error format

```json
{
  "error": {
    "code": "repo_not_found",
    "message": "No repository found with id abc123 for this org."
  }
}
```

Codes follow `snake_case`; HTTP status conveys the category (400 validation, 401/403 auth, 404 not found, 409 conflict, 429 rate limited, 500 unexpected).
