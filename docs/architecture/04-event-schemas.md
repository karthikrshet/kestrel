# Event Schemas

All events are versioned, published to Kafka (see `05-queue-architecture.md`), and follow this envelope:

```json
{
  "event_id": "uuid",
  "event_type": "run.step.completed",
  "event_version": 1,
  "org_id": "uuid",
  "occurred_at": "2026-07-06T10:00:00Z",
  "trace_id": "uuid",
  "payload": { }
}
```

## Core events

### `job.created`
Published by Control API when a user (or webhook) requests a run.
```json
{
  "payload": {
    "run_id": "uuid",
    "repository_id": "uuid",
    "issue_ref": "org/repo#1234",
    "requested_by": "uuid"
  }
}
```

### `run.planning.started` / `run.planning.completed`
Published by Orchestrator.
```json
{
  "payload": {
    "run_id": "uuid",
    "plan_step_count": 5,
    "strategy": "tree_of_thoughts" // or "linear", "debate"
  }
}
```

### `run.step.dispatched`
Orchestrator → Execution Fleet.
```json
{
  "payload": {
    "run_id": "uuid",
    "step_id": "uuid",
    "tool": "run_tests", // read_file | write_file | run_tests | git_commit | git_push
    "args": { "test_pattern": "src/**/*.test.ts" },
    "timeout_ms": 300000
  }
}
```

### `run.step.completed` / `run.step.failed`
Execution Fleet → Orchestrator.
```json
{
  "payload": {
    "run_id": "uuid",
    "step_id": "uuid",
    "exit_code": 0,
    "log_object_key": "logs/org123/run456/step7.jsonl",
    "duration_ms": 4210
  }
}
```

### `run.pr.opened`
```json
{
  "payload": {
    "run_id": "uuid",
    "pr_url": "https://github.com/org/repo/pull/42",
    "requires_human_approval": true
  }
}
```

### `run.completed` / `run.failed`
Terminal events. Trigger notification fan-out and reflection.
```json
{
  "payload": {
    "run_id": "uuid",
    "final_status": "done",
    "cost_usd": 0.87,
    "duration_ms": 182300
  }
}
```

### `repo.index.requested` / `repo.index.completed`
Consumed/produced by the Intelligence Service.
```json
{
  "payload": {
    "repository_id": "uuid",
    "commit_sha": "a1b2c3d",
    "loc_estimate": 1200000
  }
}
```

### `memory.fact.written`
Published by Memory Service when semantic memory is updated — allows other services (e.g., dashboards) to react without a direct dependency on the memory store.
```json
{
  "payload": {
    "org_id": "uuid",
    "repository_id": "uuid",
    "fact_id": "uuid",
    "confidence": 0.82
  }
}
```

## Schema governance

- Schemas are defined in a shared package (`packages/event-schemas`) using JSON Schema, checked in CI so producers/consumers can't drift silently.
- `event_version` is bumped on breaking changes; consumers declare which versions they support, and the bus retains dual-version support during migration windows (minimum 30 days).
