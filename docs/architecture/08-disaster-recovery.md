# Disaster Recovery Plan

## Objectives

| Failure scope | RTO (target recovery time) | RPO (max data loss) |
|---|---|---|
| Single AZ outage | < 2 min (automatic failover) | 0 (synchronous replication within region) |
| Single region outage | < 15 min (semi-automated failover) | < 60 sec (async cross-region replication lag) |
| Execution fleet host failure | < 5 sec (job retried on another host) | 0 for completed steps; in-progress step re-run |
| Kafka broker failure | 0 (replication factor 3, automatic leader election) | 0 |
| Accidental data deletion (application bug) | < 4 hr (restore from point-in-time backup) | Up to last backup / WAL point |

## Failure domains and mitigations

### AZ failure
- Postgres: synchronous replica in a second AZ, automatic failover via a managed service (e.g., RDS Multi-AZ or equivalent) or Patroni.
- Execution fleet: pool spans ≥3 AZs; scheduler avoids concentrating a tenant's concurrent jobs in a single AZ.
- Redis: Sentinel-managed cluster with replicas in separate AZs.

### Region failure
- Each region has a **warm standby** of the control plane (scaled down, not zero) in a designated partner region.
- Postgres cross-region replica (async) is promotable to primary; DNS/global routing layer repoints affected tenants after a health-check-triggered decision (semi-automated: alerts an on-call engineer who confirms failover rather than a fully automatic trigger, to avoid flapping on transient network partitions).
- Kafka: MirrorMaker2 (or equivalent) replicates critical topics cross-region for the same failover path; in-flight runs at the moment of failure are resumed from last committed step, not restarted from scratch, since step-level events are durable.
- In-progress agent runs during a regional failover: the run is marked `interrupted`, and on recovery the Orchestrator resumes from the last `run.step.completed` event rather than re-running completed work — this is the direct payoff of the event-sourced step model.

### Data corruption / bad deploy
- Point-in-time recovery (PITR) on Postgres via continuous WAL archiving; restore to any point in the last 7 days.
- Object storage (run logs, diffs) versioned with lifecycle rules; accidental overwrite/delete is recoverable within the versioning retention window.
- All schema migrations are backward-compatible for one release (expand/contract pattern) so a rollback of application code never requires an emergency migration rollback.

### LLM provider outage
- Not a "disaster" in the infra sense, but a real availability risk: Kestrel is model-agnostic at the Orchestrator's planner interface, with a configured fallback provider. A provider outage degrades to "runs queue and wait" or "fail over to secondary provider" per tenant configuration, rather than a platform-wide outage.

## Testing

- **Game days:** quarterly simulated region failover exercises.
- **Chaos testing:** execution fleet host termination injected in staging continuously (not just during game days) to catch regressions in retry/resume logic.
- **Backup restore drills:** monthly restore of a Postgres backup to a scratch environment, verified against a checksum of expected row counts.

## Communication plan

- Status page (public) updated within 5 minutes of a confirmed incident affecting customer-visible functionality.
- Tenant-level incident notifications for anything affecting their specific region/run, via the Notification Service's existing webhook/email path — reusing production infrastructure for incident comms, not a separate bolted-on system.
