# C4 Diagrams

Rendered in Mermaid. Paste into any Mermaid-compatible viewer (GitHub renders these natively).

## Level 1 — System Context

```mermaid
C4Context
title Kestrel — System Context

Person(dev, "Developer / Org Admin", "Owns repositories, triages issues, reviews PRs")
System(kestrel, "Kestrel", "Autonomous software engineering platform")
System_Ext(git, "Git Hosting", "GitHub / GitLab / Bitbucket")
System_Ext(llm, "LLM Providers", "Anthropic, OpenAI, or self-hosted models")
System_Ext(ci, "CI Provider", "GitHub Actions / CircleCI, used to validate agent-produced PRs")

Rel(dev, kestrel, "Assigns issues, reviews runs, approves PRs")
Rel(kestrel, git, "Reads repos, opens branches/PRs, posts status checks")
Rel(kestrel, llm, "Sends planning/coding prompts, receives completions")
Rel(kestrel, ci, "Triggers test runs, reads results")
```

## Level 2 — Containers

```mermaid
C4Container
title Kestrel — Containers

Person(dev, "Developer")

System_Boundary(kestrel, "Kestrel"){
  Container(web, "Web App", "Next.js", "Dashboard, run monitor, PR review UI")
  Container(api, "Control API", "Node/Fastify", "Auth, orgs, repos, job creation")
  Container(orchestrator, "Orchestrator", "Node worker fleet", "Agent state machine, step scheduling")
  Container(executor, "Execution Fleet", "Firecracker microVMs", "Sandboxed tool execution: file IO, test runs, git ops")
  Container(intel, "Intelligence Service", "Python/Node worker", "Repo graph, static analysis, embeddings")
  ContainerDb(pg, "Postgres (per-region)", "Tenant metadata, jobs, runs, PR records")
  ContainerDb(redis, "Redis Cluster", "Cache, rate limits, short-lived job state")
  ContainerQueue(kafka, "Event Bus", "Kafka", "Job lifecycle events, agent step events")
  ContainerDb(vector, "Vector Store", "pgvector / Qdrant", "Embeddings for repo + memory retrieval")
  ContainerDb(objstore, "Object Storage", "S3-compatible", "Repo snapshots, run logs, diffs")
}

System_Ext(git, "Git Hosting")
System_Ext(llm, "LLM Providers")

Rel(dev, web, "HTTPS")
Rel(web, api, "REST/GraphQL, HTTPS")
Rel(api, pg, "Reads/writes tenant + job metadata")
Rel(api, kafka, "Publishes JobCreated")
Rel(orchestrator, kafka, "Consumes/produces step events")
Rel(orchestrator, redis, "Job state, distributed locks")
Rel(orchestrator, llm, "Planning/coding completions")
Rel(orchestrator, executor, "Dispatches tool-call execution")
Rel(executor, objstore, "Reads repo snapshot, writes diffs/logs")
Rel(executor, git, "Clones, commits, opens PR")
Rel(intel, vector, "Writes/reads embeddings")
Rel(intel, objstore, "Reads repo snapshots")
Rel(intel, kafka, "Consumes RepoIndexRequested")
```

## Level 3 — Components (Orchestrator)

```mermaid
C4Component
title Orchestrator — Components

Container_Boundary(orch, "Orchestrator Service"){
  Component(stateMachine, "Run State Machine", "Tracks run status: planning → executing → reviewing → done/failed")
  Component(planner, "Planner Component", "Calls LLM to produce/update plan; supports Tree-of-Thoughts branching")
  Component(memoryClient, "Memory Client", "Reads episodic/semantic memory before planning, writes after")
  Component(toolDispatcher, "Tool Dispatcher", "Translates plan steps into Execution Fleet jobs")
  Component(reflector, "Reflection Component", "Post-run analysis: what failed, what to remember")
  Component(retryPolicy, "Retry/Backoff Policy", "Idempotent step retries, dead-letter on exhaustion")
}

Rel(stateMachine, planner, "Requests next step")
Rel(planner, memoryClient, "Fetch relevant memory")
Rel(planner, toolDispatcher, "Emits tool call")
Rel(toolDispatcher, retryPolicy, "Wraps dispatch with retry")
Rel(stateMachine, reflector, "On run completion")
Rel(reflector, memoryClient, "Writes reflection to memory")
```

## Level 4 — Code (illustrative, Run State Machine)

```mermaid
stateDiagram-v2
[*] --> Queued
Queued --> Planning: worker picks up JobCreated
Planning --> Executing: plan step ready
Executing --> Planning: step done, re-plan
Executing --> Reviewing: plan marked complete
Reviewing --> AwaitingHumanApproval: PR opened
AwaitingHumanApproval --> Done: approved & merged
AwaitingHumanApproval --> Executing: changes requested
Executing --> Failed: unrecoverable error
Planning --> Failed: planning exhausted retries
Failed --> [*]
Done --> [*]
```
