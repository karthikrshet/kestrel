import { Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
import { jobCreatedEvent, QUEUE_NAMES } from "@kestrel/event-schemas";
import { LlmPlanner } from "./planner.js";
import { RunStateMachine } from "./run-state-machine.js";
import { createDbPool, updateRunStatus } from "./db/run-writer.js";
import { getRepoForRun } from "./db/repo-reader.js";
import { StubPrOpener, GithubPrOpener, type PrOpener } from "./github/pr-opener.js";
import { SimulatedExecutor } from "./execution/simulated-executor.js";
import { DockerSandboxExecutor } from "./execution/docker-sandbox-executor.js";
import type { ToolExecutor } from "./execution/types.js";
import { createIndexingWorker } from "./indexing/worker.js";
import { loadRootEnv } from "./load-root-env.js";

// Must run before any of the top-level `process.env.*` reads below — this
// file (unlike apps/api/src/index.ts) reads env vars directly at module
// top level rather than inside a main() function, so load order matters.
loadRootEnv(import.meta.url, 3); // apps/orchestrator/src -> monorepo root

const log = pino({ level: process.env.NODE_ENV === "production" ? "info" : "debug" });

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
// Fallback matches the non-owner kestrel_app role from
// apps/api/migrations/0004_app_role.sql — connecting as the owner `kestrel`
// role here would silently disable RLS for this service, the exact gotcha
// documented in docs/architecture/09-security-architecture.md.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kestrel_app:kestrel_app_dev_password_change_me@localhost:5432/kestrel";

// BullMQ Workers use blocking Redis commands internally; sharing one
// ioredis connection across two Workers can cause one worker's blocking
// read to delay the other's. Each Worker gets its own connection — Queue
// instances (non-blocking) are fine to share, but there's only one Queue
// client in this process anyway (this worker only consumes).
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const indexingConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const dbPool = createDbPool(DATABASE_URL);

// Falls back to a deterministic stub plan automatically if LLM_API_KEY is unset.
const planner = new LlmPlanner(process.env.LLM_API_KEY, process.env.LLM_MODEL);

// Falls back to a stub PR URL automatically if the GitHub App isn't configured,
// or if a specific repository has no installation_id on file.
// dotenv/.env files can't hold real newlines, so the PEM key is stored with
// literal "\n" sequences (see .env.example) and unescaped here.
const githubPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

const prOpener: PrOpener =
  process.env.GITHUB_APP_ID && githubPrivateKey
    ? new GithubPrOpener(
        process.env.GITHUB_APP_ID,
        githubPrivateKey,
        (args) => getRepoForRun(dbPool, args),
        log
      )
    : new StubPrOpener();

// EXECUTION_MODE=docker is an explicit opt-in — it mounts the host Docker
// socket into this container (see infra/docker-compose.sandbox.yml) and
// runs real test commands. Read the large warning comment at the top of
// execution/docker-sandbox-executor.ts before enabling this in anything
// other than a trusted local/self-hosted setup.
const executor: ToolExecutor =
  process.env.EXECUTION_MODE === "docker" && process.env.GITHUB_APP_ID && githubPrivateKey
    ? new DockerSandboxExecutor(
        process.env.GITHUB_APP_ID,
        githubPrivateKey,
        (args) => getRepoForRun(dbPool, args),
        process.env.EXECUTION_SANDBOX_IMAGE ?? "node:20-alpine",
        log
      )
    : new SimulatedExecutor(log);

const worker = new Worker(
  QUEUE_NAMES.jobCreated,
  async (job) => {
    const event = jobCreatedEvent.parse(job.data);
    const { run_id, repository_id, issue_ref } = event.payload;

    log.info({ run_id }, "picked up job.created");

    const machine = new RunStateMachine(
      { runId: run_id, orgId: event.org_id, repositoryId: repository_id, issueRef: issue_ref },
      planner,
      log,
      prOpener,
      executor,
      async (status, extra) => {
        try {
          await updateRunStatus(dbPool, {
            runId: run_id,
            orgId: event.org_id,
            status,
            planSummary: extra?.planSummary,
            prUrl: extra?.prUrl,
          });
        } catch (err) {
          // A failed status write shouldn't crash the run itself — log and
          // continue; the run's in-memory state machine is still the source
          // of truth for this execution, and the reflection loop can flag
          // runs whose persisted status looks stale.
          log.error({ run_id, status, err }, "failed to persist run status");
        }
      }
    );

    const finalStatus = await machine.run();
    log.info({ run_id, finalStatus }, "run finished");
    return { run_id, finalStatus };
  },
  { connection, concurrency: 10 }
);

worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "job failed after retries");
});

log.info(`Kestrel orchestrator worker listening on queue "${QUEUE_NAMES.jobCreated}"`);

const indexingWorker = createIndexingWorker({
  connection: indexingConnection,
  dbPool,
  log,
  githubAppId: process.env.GITHUB_APP_ID,
  githubPrivateKey,
});

indexingWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "indexing job failed after retries");
});

log.info(`Kestrel orchestrator worker listening on queue "${QUEUE_NAMES.repoIndexRequested}"`);

async function shutdown() {
  log.info("shutting down orchestrator worker...");
  await worker.close();
  await indexingWorker.close();
  connection.disconnect();
  indexingConnection.disconnect();
  await dbPool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
