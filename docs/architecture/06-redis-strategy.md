# Redis Strategy

Redis is used for four distinct purposes at Kestrel; each gets its own logical cluster so that a spike in one doesn't evict cache entries needed by another.

| Cluster | Purpose | Data | Eviction policy |
|---|---|---|---|
| `redis-cache` | API response cache, repo metadata cache | Read-heavy, tolerant of staleness (TTL 30-300s) | `allkeys-lru` |
| `redis-state` | In-flight run/step state for the Orchestrator hot path | Small, latency-critical | `noeviction` (this data must not be dropped) |
| `redis-ratelimit` | Token buckets, idempotency keys | TTL-based, disposable | `volatile-ttl` |
| `redis-queue` (Phase 0-1 only) | BullMQ job queues | Superseded by Kafka in Phase 5 | `noeviction` |

## Topology

- **Regional Redis Cluster (not single-node)** per region, sharded by tenant hash, with replicas for read scaling and automatic failover (Redis Sentinel or a managed equivalent).
- **No cross-region Redis replication.** Redis here is a fast local cache/state layer, not a source of truth — the source of truth is Postgres/Kafka, which do replicate across regions. This avoids the consistency headaches of multi-region Redis.

## Caching patterns

- **Cache-aside** for repo metadata and user/org lookups: read Redis, fall back to Postgres on miss, write-through on fetch.
- **Write-through** for run state that the dashboard polls frequently: the Orchestrator writes to Redis synchronously and to Postgres asynchronously (Postgres remains the durable record; Redis is the fast read path).
- **Explicit invalidation** on repo settings changes (webhook on save clears the relevant cache keys) rather than relying purely on TTL, since stale repo config could misdirect an agent run.

## Capacity planning at 100k concurrent executions

- Each active run holds a small state hash (~1-2KB) in `redis-state`. 100k concurrent runs → ~100-200MB of hot state, comfortably within a single well-provisioned cluster shard's memory, with headroom built in for spikes.
- Rate-limit keys are the highest cardinality (one per tenant per time window); TTL keeps this bounded regardless of tenant count.
