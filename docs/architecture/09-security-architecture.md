# Security Architecture

## Threat model highlights specific to an autonomous coding agent

Kestrel's threat model is unusual compared to a typical SaaS app because it **executes AI-generated code and shell commands against real repositories with real credentials.** The two risks that dominate the design:

1. A sandbox escape from agent-executed code reaching other tenants' data or the host infrastructure.
2. A prompt-injection or malicious-issue scenario tricking the agent into exfiltrating secrets or committing malicious code that a human then merges without noticing.

## Sandboxing (mitigates risk 1)

- Every execution runs in a microVM (Firecracker) or gVisor sandbox with:
  - No network access by default; explicit allowlist per job (e.g., package registry, the specific git remote) rather than open egress.
  - Read-only mount of the base image; writable overlay scoped to the job, destroyed on completion.
  - No credentials baked into the sandbox image. Git credentials and API keys are injected just-in-time via a short-lived token (see below) and never written to disk in plaintext.
  - Resource limits (CPU, memory, disk, execution time) enforced at the VM/container level, not just application-level timeouts.

## Secrets management

- Tenant secrets (git tokens, API keys they provide) are encrypted at rest using envelope encryption: a per-tenant data key (encrypted by a master key in a KMS, e.g., AWS KMS/HashiCorp Vault) encrypts the actual secret.
- Secrets are decrypted only inside the orchestrator's secure step just before injection into a sandbox, as a short-lived, single-use token (e.g., a GitHub App installation token scoped to the one repository, expiring in under an hour) — never the tenant's long-lived credential itself.
- No secret is ever logged; log redaction middleware scans structured logs for known secret patterns before they leave the process.

## Prompt-injection mitigations (mitigates risk 2)

- Content from untrusted sources (issue bodies, PR comments, file contents) is treated as **data, not instructions** — the planner's system prompt explicitly distinguishes trusted operator instructions from untrusted repository/issue content, and the agent's tool-use permissions are the actual enforcement boundary, not the prompt wording alone.
- Tool calls that touch anything sensitive (pushing to a protected branch, modifying CI config, adding new dependencies) require an explicit human-approval gate by default — this is a policy default, not just a suggestion in the prompt.
- Outbound network access from the sandbox is allowlisted (see above), so even a successfully-injected instruction to "curl this URL with the environment variables" has nowhere to send the data.

## AuthN/AuthZ

- Human users: OAuth via git provider (GitHub/GitLab App) + short-lived session JWTs; SSO/SAML for enterprise tier.
- Service-to-service: mTLS within the cluster; every internal call carries the originating tenant's `org_id`, checked against the resource's `org_id` at every data access layer (defense in depth beyond just Postgres RLS).
- Role model: `owner` / `admin` / `member` at the org level; per-repository permission overrides for larger orgs.

## Correction: a Postgres RLS gotcha this scaffold doesn't yet fix

The migrations enable row-level security and define `USING (org_id = current_setting('app.current_org_id', true)::UUID)` policies, and the application code sets that config before every tenant-scoped query (`withOrgContext` in `apps/api/src/db/pool.ts`). **However:** by default, Postgres RLS policies do not apply to a table's owner — and in the Docker Compose scaffold, the same `kestrel` role both runs migrations (creating the tables) and runs the application (querying them), so it owns the tables and RLS is silently a no-op for it right now. The application-level scoping (every query includes `WHERE id = $1` derived from an authenticated `org_id`, and repository/run lookups join through org-owned rows) is still the actual enforcement boundary in this scaffold today.

To make RLS a real second layer of defense (not just a policy that looks correct on paper), a production deployment needs:
1. A separate, non-owner application role (e.g., `kestrel_app`) that only has `SELECT`/`INSERT`/`UPDATE`/`DELETE` grants, distinct from the migration role that owns the tables.
2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` if the app role ever does need owner-equivalent privileges for some reason.

This is called out explicitly rather than left as an implied property of "RLS is enabled" — a security control that silently doesn't apply is worse than no control, if someone reasonably assumes it's covering them.

## Compliance-relevant controls

- **Encrypted secrets** at rest and in transit (TLS 1.2+ everywhere, envelope encryption as above).
- **Audit logging:** every action that reads/writes tenant data, every human approval decision, and every agent tool call is written to an append-only audit log (separate from application logs, retained per the tenant's compliance tier — e.g., 1 year default, 7 years for enterprise/regulated tenants).
- **Data residency:** enforced by the region-pinning described in `07-scaling-strategy.md` — a tenant configured for EU residency never has repo content or run logs written to a US region.
- **Least privilege for the GitHub/GitLab App:** requests only the scopes needed (contents, pull requests, checks) — never org-wide admin scopes.

## Dependency and supply-chain security

- All CI pipelines run a security scan step (SAST + dependency vulnerability scan) before merge — see `.github/workflows/ci.yml`.
- Execution fleet base images are rebuilt on a fixed cadence and on every CVE alert affecting included packages, not just on a calendar schedule.
