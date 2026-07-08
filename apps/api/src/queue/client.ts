import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@kestrel/event-schemas";
import type { Env } from "../config/env.js";

/**
 * Phase 0-1 queue: BullMQ on Redis. See docs/architecture/05-queue-architecture.md
 * for why this is replaced by Kafka at Phase 5 (100k concurrent executions).
 */
export function createQueues(env: Env) {
  // BullMQ requires maxRetriesPerRequest: null on the underlying ioredis connection.
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const jobCreatedQueue = new Queue(QUEUE_NAMES.jobCreated, { connection });
  const repoIndexQueue = new Queue(QUEUE_NAMES.repoIndexRequested, { connection });

  return { jobCreatedQueue, repoIndexQueue, connection };
}

export type Queues = ReturnType<typeof createQueues>;
