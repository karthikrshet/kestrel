# Build context is the monorepo root (see infra/docker-compose.yml) — this
# app depends on the @kestrel/event-schemas workspace package in packages/,
# which wouldn't be resolvable if the build context were just apps/api.
FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS build
COPY package.json pnpm-workspace.yaml ./
COPY packages/event-schemas ./packages/event-schemas
COPY apps/api ./apps/api
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @kestrel/event-schemas run build
RUN pnpm --filter @kestrel/api run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo ./
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
