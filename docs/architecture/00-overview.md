# Architecture Overview

**Prepared as a Series A technical review document.**
Scope: redesign for 10M registered users, 100,000 concurrent agent executions, multi-region, high availability, event-driven.

## Design goals, ranked

1. **Correctness under partial failure.** An agent job that dies mid-run must never corrupt repo state or leave a PR half-written.
2. **Elastic execution, not elastic control plane.** The expensive, spiky resource is sandboxed code execution (100k concurrent). The control plane (API, auth, metadata) is comparatively cheap and should scale independently.
3. **Tenant isolation.** Org A's code, memory, and secrets must never be reachable from Org B's execution context — enforced at the infra layer, not just application logic.
4. **Multi-region without split-brain.** Reads scale horizontally across regions; writes are region-pinned per tenant with async replication.
5. **Graceful degradation.** If the LLM provider, a queue, or a region is down, the system fails to a smaller feature set (e.g., "read-only repo browsing") rather than fully down.

## High-level shape

Kestrel is split into four planes:

| Plane | Responsibility | Scaling axis |
|---|---|---|
| **Control plane** | Auth, orgs, repos, job metadata, billing | Requests/sec — scales like a normal SaaS API |
| **Orchestration plane** | Job scheduling, agent state machine, retries, memory reads/writes | Jobs/sec — scales with active executions |
| **Execution plane** | Sandboxed code execution (running agent tool calls: read file, run test, git diff) | Concurrent executions — the 100k number lives here |
| **Intelligence plane** | Repository graph, static analysis, embeddings, memory store | Data volume (repo size × repo count) |

Each plane is a separate deployable unit with its own datastore ownership. See `03-service-boundaries.md` for the service breakdown and `01-c4-diagrams.md` for the visual architecture.

## Why event-driven

Agent runs are naturally a sequence of discrete steps (plan → tool call → observation → next step) with unpredictable duration per step (seconds to minutes) and a need for durability (a crashed worker must resume, not restart from scratch). That maps directly to an event log + worker pool pattern rather than long-lived synchronous requests. See `04-event-schemas.md` and `05-queue-architecture.md`.

## Non-goals of this document

This is an architecture and design document, not a deployment record. Capacity numbers (10M users, 100k concurrent executions) are **design targets** used to size the architecture, not current production metrics — Kestrel Phase 0 is a scaffold (see `../roadmap.md`).
