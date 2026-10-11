# cloudDSP website. Pair it with the GPU worker image in worker/Dockerfile;
# compose.yaml runs both. See docs/self-hosting.md.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which needs the schema copied above.
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Shown in the footer; the image doesn't contain the .git folder.
ARG COMMIT_SHA=""
ENV COMMIT_SHA=$COMMIT_SHA \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Used by compose's one-shot `migrate` service when running with Postgres.
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Jobs and files live here when no database or object storage is configured.
RUN mkdir -p .data && chown -R node:node /app
USER node
VOLUME /app/.data
EXPOSE 3000
CMD ["node", "server.js"]
