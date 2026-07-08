import { z } from "zod";

/**
 * Shared event envelope + payload schemas. Both producers (API, Intelligence
 * Service) and consumers (Orchestrator, Notification Service) import from
 * here, so a schema change is a single-package version bump, not a silent
 * drift between services. Mirrors docs/architecture/04-event-schemas.md —
 * keep both in sync when changing either.
 */

export const eventEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  event_version: z.number().int().default(1),
  occurred_at: z.string().datetime(),
  org_id: z.string().uuid(),
  trace_id: z.string().uuid(),
});

export const jobCreatedPayload = z.object({
  run_id: z.string().uuid(),
  repository_id: z.string().uuid(),
  issue_ref: z.string(),
  requested_by: z.string().uuid().optional(),
});
export const jobCreatedEvent = eventEnvelopeSchema.extend({
  event_type: z.literal("job.created"),
  payload: jobCreatedPayload,
});

export const runStepDispatchedPayload = z.object({
  run_id: z.string().uuid(),
  step_id: z.string().uuid(),
  tool: z.enum(["read_file", "write_file", "run_tests", "git_commit", "git_push"]),
  args: z.record(z.unknown()),
  timeout_ms: z.number().int().positive().default(300_000),
});
export const runStepDispatchedEvent = eventEnvelopeSchema.extend({
  event_type: z.literal("run.step.dispatched"),
  payload: runStepDispatchedPayload,
});

export const runStepCompletedPayload = z.object({
  run_id: z.string().uuid(),
  step_id: z.string().uuid(),
  exit_code: z.number().int(),
  log_object_key: z.string().optional(),
  duration_ms: z.number().int().nonnegative(),
});
export const runStepCompletedEvent = eventEnvelopeSchema.extend({
  event_type: z.literal("run.step.completed"),
  payload: runStepCompletedPayload,
});

export const runTerminalPayload = z.object({
  run_id: z.string().uuid(),
  final_status: z.enum(["done", "failed"]),
  cost_usd: z.number().nonnegative().default(0),
  duration_ms: z.number().int().nonnegative(),
});
export const runTerminalEvent = eventEnvelopeSchema.extend({
  event_type: z.literal("run.completed").or(z.literal("run.failed")),
  payload: runTerminalPayload,
});

export const repoIndexRequestedPayload = z.object({
  repository_id: z.string().uuid(),
});
export const repoIndexRequestedEvent = eventEnvelopeSchema.extend({
  event_type: z.literal("repo.index.requested"),
  payload: repoIndexRequestedPayload,
});

export type JobCreatedEvent = z.infer<typeof jobCreatedEvent>;
export type RunStepDispatchedEvent = z.infer<typeof runStepDispatchedEvent>;
export type RunStepCompletedEvent = z.infer<typeof runStepCompletedEvent>;
export type RunTerminalEvent = z.infer<typeof runTerminalEvent>;
export type RepoIndexRequestedEvent = z.infer<typeof repoIndexRequestedEvent>;

/** Queue/topic names, centralized so a rename is a one-line change. */
export const QUEUE_NAMES = {
  jobCreated: "job.created",
  runStepDispatched: "run.step.dispatched",
  runStepCompleted: "run.step.completed",
  runTerminal: "run.terminal",
  repoIndexRequested: "repo.index.requested",
} as const;
