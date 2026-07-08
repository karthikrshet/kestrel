# Queue Architecture

## Two-tier approach: BullMQ now, Kafka at scale

**Phase 0–1 (scaffold, MVP):** BullMQ on Redis. Simple, fast to build, fine for hundreds of concurrent runs. This is what's implemented in `apps/api` today.

**Phase 5 (100k concurrent executions, multi-region):** Kafka as the durable event backbone, with BullMQ (or SQS) surviving only as a *local* dispatch mechanism between the Orchestrator and its own worker pool within a region.

Why the switch matters at scale:
- Redis-backed queues keep queue state in memory; at 100k concurrent jobs with multi-minute durations, the working set and replication overhead become the bottleneck.
- Kafka gives log-based replay: a crashed consumer group resumes from its committed offset rather than losing in-flight job state.
- Kafka's partition model maps cleanly onto tenant sharding (partition key = `org_id`), giving ordering guarantees *per tenant* without a global ordering bottleneck.

## Topic design (Kafka, Phase 5)

| Topic | Partition key | Retention | Consumers |
|---|---|---|---|
| `job.created` | `org_id` | 7 days | Orchestrator pool |
| `run.step.dispatched` | `run_id` | 3 days | Execution Fleet dispatcher |
| `run.step.completed` | `run_id` | 3 days | Orchestrator |
| `run.terminal` (completed/failed) | `org_id` | 30 days | Notification Service, Analytics, Memory Service |
| `repo.index.requested` | `repository_id` | 3 days | Intelligence Service |

Partitioning by `org_id` (rather than round-robin) means one noisy tenant can be throttled or isolated to specific partitions/consumers without affecting others — important at 10M users where usage is inevitably long-tail.

## Backpressure and fairness

- **Per-tenant rate limiting** at the Control API (token bucket in Redis) prevents one org from monopolizing the Orchestrator's consumption of `job.created`.
- **Priority lanes:** paid tiers get a separate high-priority topic/partition set; free tier runs are consumed at lower concurrency. This is a fairness mechanism, not a hard cap — no tenant is ever fully starved.
- **Dead-letter topics** (`*.dlq`) capture events that exhausted retries; a small on-call rotation reviews these, and the reflection component (see `docs/agents/reasoning-frameworks.md`) also inspects them for pattern-level fixes.

## Idempotency

Every consumer is written assuming at-least-once delivery:
- Step dispatch includes an idempotency key (`run_id:step_id`); the Execution Fleet checks a Redis set before re-running a step it has already completed.
- Terminal state transitions (`run.completed`) are guarded by a Postgres `WHERE status != 'done'` clause so a duplicate event can't double-fire a webhook.
