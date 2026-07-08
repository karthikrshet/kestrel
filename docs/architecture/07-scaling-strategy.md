# Scaling Strategy

## Target numbers (design targets, not current metrics)

- 10,000,000 registered users
- 100,000 concurrent agent executions at peak
- p99 API latency < 300ms for control-plane requests
- Multi-region: at minimum US + EU, expandable to APAC

## Scaling the four planes independently

### Control plane
Stateless API nodes behind a load balancer, autoscaled on CPU/request-latency. Postgres read replicas absorb read-heavy dashboard traffic; writes go to the tenant's home-region primary. This plane scales the way any consumer SaaS API scales — nothing exotic.

### Orchestration plane
Stateless workers consuming from Kafka consumer groups. Horizontal scaling = adding consumers to the group, bounded by partition count (partition by `org_id`, so partition count should be set with future tenant growth in mind — repartitioning live topics is painful). Target: partition count sized for 3-5x current peak tenant concurrency.

### Execution plane (the 100k number)
This is the plane that actually needs to hit 100k concurrent. Approach:
- Sandboxes are short-lived microVMs (Firecracker) or gVisor containers, scheduled by a pool manager (e.g., Kubernetes with a custom scheduler, or Firecracker's own jailer + a thin orchestration layer).
- **Pre-warmed pool:** keep a standing pool of ready-to-use sandboxes sized to recent p95 demand, to avoid cold-start latency on every run; scale the pool up/down on a leading indicator (queue depth in `run.step.dispatched`), not a lagging one (current CPU usage).
- **Bin-packing:** most agent tool calls are I/O-bound (file reads, test runs) rather than CPU-bound, so moderate over-subscription per host is safe; this is tuned empirically per workload profile, not asserted here as a fixed ratio.
- **Regional pools:** execution happens in the same region as the tenant's repo data to avoid cross-region latency on every file read.

### Intelligence plane
Batch-oriented; scales with a standard job queue + worker pool pattern, autoscaled on queue depth. Large repo indexing jobs (millions of LOC) are chunked by directory/module so a single job never becomes an unbounded unit of work — see `../repo-intelligence/engine-design.md`.

## Multi-region model

- **Region-pinned tenants:** each org has a home region (data residency, not just latency). All control-plane and orchestration-plane state for that org lives there.
- **Active-active at the region level, not the tenant level:** every region runs a full stack; a tenant is active in exactly one region at a time, but the platform overall serves traffic from all regions simultaneously.
- **Global routing layer** (e.g., GeoDNS + Anycast, or a global load balancer) directs a request to the tenant's home region based on org lookup at the edge (cached at CDN/edge-function layer to avoid a round trip per request).
- **Cross-region failover:** if a region goes down, tenants pinned there are failed over to a designated secondary region using the async-replicated Postgres standby (see `08-disaster-recovery.md`) — this is a recovery path, not a normal operating mode, and comes with an RPO of a few seconds to a minute depending on replication lag.

## Capacity model (back-of-envelope)

- 10M users, assume ~5% MAU actively trigger runs in a given week, ~2 runs/week per active user → roughly single-digit millions of runs/week, i.e., low-to-mid tens of runs/second average, with peak-to-average ratios typical of daytime-business-hours usage (peaks well above average, not evenly distributed across 24h).
- 100k *concurrent* executions is a peak-burst design target (e.g., large orgs running batch triage across many issues at once) rather than the steady-state number implied by average run rate — the execution plane is sized for burst, with the pre-warmed pool strategy above absorbing the difference between average and peak.
