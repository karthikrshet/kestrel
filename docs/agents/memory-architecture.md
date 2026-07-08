# Agent Memory Architecture

Kestrel's agents improve across runs through three memory types, each with a distinct storage strategy and a distinct failure mode if it degrades (important: memory should make runs *better*, and its absence should degrade gracefully rather than break a run).

## 1. Working memory (within a single run)

Not persisted beyond the run. Holds the current plan, tool results so far, and the repo context loaded for this specific issue. Lives in the Orchestrator's run state (Redis) and is discarded — or rather, folded into episodic memory — when the run ends.

## 2. Episodic memory (per-run history)

A durable record of what happened in a specific run: the plan, each step, the outcome, and the reflection (see `reasoning-frameworks.md`). Stored as structured logs in object storage, indexed in Postgres (`run_steps` table) for retrieval by run ID.

**Use:** "Show me what happened on run X" (debugging, audit) and as raw material that semantic memory extraction reads from — episodic memory itself is not searched during planning; it's too voluminous and too specific to one run.

## 3. Semantic memory (durable, cross-run facts)

Distilled, reusable facts about a repository or organization, extracted from episodic memory after a run completes. Examples: *"This repo's test suite requires `DATABASE_URL` to be set even for unit tests,"* or *"PRs to `payments/` always need a second reviewer per CODEOWNERS."*

- Stored in the `semantic_memory` table (see `../architecture/02-database-design.md`) with a `confidence` score and an embedding for similarity retrieval.
- **Confidence decays and is reinforced:** a fact confirmed by multiple runs gains confidence; a fact contradicted by a later run is marked `superseded_by` rather than deleted, preserving history for debugging why an agent believed something.
- **Retrieval:** before planning, the Memory Client fetches the top-K semantically relevant facts for the current repo/org via vector similarity + a confidence floor, and injects them into the planner's context — this is retrieval-augmented planning, not a full memory dump.
- **Cross-org learning is opt-in and anonymized:** a fact like "this class of dependency-update PR commonly breaks type checking" can generalize across orgs, but only facts explicitly marked as safe to generalize (no tenant-specific code/identifiers) are eligible, and only for orgs that opt into aggregate learning.

## Why not just "long context window"

A large context window doesn't substitute for structured memory: (a) cost scales with context size on every single planning call, (b) irrelevant history actively degrades planning quality ("lost in the middle" effects), and (c) a context window resets between runs regardless of size — it can't carry a fact forward to next week's run without an explicit memory write. Retrieval-augmented semantic memory is the mechanism that actually crosses run boundaries.

## Memory hygiene

- Facts have provenance (`source_run_id`) — always traceable to the run that produced them, so a bad fact can be traced back and its consequences audited.
- A scheduled job periodically re-validates high-traffic facts against the current repo state (e.g., "does this test command still exist?") and demotes confidence on facts that no longer hold.
