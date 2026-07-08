# Build context is the monorepo root (see infra/docker-compose.yml) — same
# reasoning as apps/api/Dockerfile: this app depends on the
# @kestrel/event-schemas workspace package.
FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable
# Only needed if EXECUTION_MODE=docker (see docker-compose.sandbox.yml) — the
# CLI itself is small; it's inert if the socket isn't mounted. `git` is
# needed unconditionally (repo cloning for both indexing and, if enabled,
# sandboxed execution).
RUN apk add --no-cache docker-cli git

FROM base AS build
COPY package.json pnpm-workspace.yaml ./
COPY packages/event-schemas ./packages/event-schemas
COPY apps/orchestrator ./apps/orchestrator
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @kestrel/event-schemas run build
RUN pnpm --filter @kestrel/orchestrator run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo ./
WORKDIR /repo/apps/orchestrator
CMD ["node", "dist/worker.js"]
