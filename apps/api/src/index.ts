import { loadRootEnv } from "./config/load-root-env.js";
loadRootEnv(import.meta.url, 3); // apps/api/src -> monorepo root

import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { createQueues } from "./queue/client.js";
import { createDbPool } from "./db/pool.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { reposRoutes } from "./routes/repos.js";
import { runsRoutes } from "./routes/runs.js";
import { webhooksRoutes, registerRawBodyCapture } from "./routes/webhooks.js";
import { integrationsRoutes } from "./routes/integrations.js";

async function main() {
  const env = loadEnv();
  const queues = createQueues(env);
  const db = createDbPool(env);

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, { origin: true });
  registerRawBodyCapture(app);
  await app.register(authPlugin, { jwtSecret: env.JWT_SECRET });

  await app.register(healthRoutes);
  await app.register(authRoutes, { db, env });
  await app.register(reposRoutes, { db, queues });
  await app.register(runsRoutes, { queues, db });
  await app.register(webhooksRoutes, { db, env });
  await app.register(integrationsRoutes, { db, queues, env });

  app.addHook("onClose", async () => {
    await queues.jobCreatedQueue.close();
    await queues.repoIndexQueue.close();
    queues.connection.disconnect();
    await db.end();
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({
      error: { code: "internal_error", message: "Something went wrong." },
    });
  });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Kestrel API listening on port ${env.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting Kestrel API:", err);
  process.exit(1);
});
