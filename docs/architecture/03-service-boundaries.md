# Service Boundaries

## Guiding rule

A service boundary exists where **failure isolation** or **scaling rate** genuinely differ — not just because a diagram looks nicer with more boxes. Kestrel has seven services; each earns its place below.

| Service | Owns | Scales because | Fails independently by |
|---|---|---|---|
| **Control API** | Auth, orgs, repos, billing, job creation requests | Request volume tracks user count (10M), not execution count | Rejecting new requests with 503 while queue/executors keep draining existing work |
| **Orchestrator** | Run state machine, planning calls, memory reads/writes | Tracks active runs (up to 100k concurrent) | A crashed orchestrator worker resumes from last durable event; doesn't block other runs |
| **Execution Fleet** | Sandboxed tool execution (file IO, test runs, git operations) | The 100k-concurrent number lives here; needs the fastest horizontal scale-out | Each sandbox is isolated (microVM); one crashing sandbox never affects another |
| **Intelligence Service** | Repo graph construction, static analysis, embeddings | Scales with repo size × repo count, batch-oriented, not latency-sensitive | Falls back to "last known graph" if a re-index job fails; never blocks agent runs |
| **Memory Service** | Episodic + semantic memory read/write API | Scales with run volume; read-heavy | Read failures degrade gracefully to "no memory context" rather than blocking a run |
| **Notification/Webhook Service** | Outbound webhooks, email, Slack/GitHub status checks | Scales with event volume | Retries with backoff; never blocks the originating service (fire-and-forget via queue) |
| **Web App (BFF)** | Dashboard, run viewer, PR review UI, backend-for-frontend | Scales with concurrent human users, not agent load | Can degrade to cached/stale data if Control API is slow |

## Explicit non-boundaries

- Planning and reflection are **not** separate services from the Orchestrator — they're components within it (see C4 Level 3). Splitting them would add a network hop with no independent scaling or failure benefit.
- The Execution Fleet is intentionally "dumb" — it executes tool calls handed to it and reports results. It does not call the LLM directly. This keeps the blast radius of a compromised sandbox limited to "can it escape the sandbox," not "can it also make arbitrary LLM calls billed to the tenant."

## Communication patterns

- **Control API → Orchestrator:** async, via event bus (`JobCreated` event). The API never blocks waiting on a run.
- **Orchestrator → Execution Fleet:** async dispatch + result event; the orchestrator does not hold an open connection for the duration of a tool call (tool calls can take minutes).
- **Orchestrator → Memory Service:** synchronous gRPC/HTTP call on the planning hot path, with a strict timeout (e.g., 200ms) and graceful fallback to "no memory" on timeout.
- **Any service → Notification Service:** always async via event bus, never synchronous.
