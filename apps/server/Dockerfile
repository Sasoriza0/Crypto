# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# OpenSSL needed for Prisma engine
RUN apk add --no-cache openssl

# Copy root & workspace manifests for npm workspaces resolution
COPY package.json package-lock.json prisma.config.ts ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies deterministically
RUN npm ci

# Copy sources for shared contracts and server
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Generate Prisma Client for PostgreSQL
RUN npm run prisma:generate --workspace=@shiftcrack/server

# Build shared contracts and server TypeScript
RUN npm run build --workspace=@shiftcrack/shared \
 && npm run build --workspace=@shiftcrack/server

# -----------------------------------------------------------------------------
# Stage 2: Production Runner
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV JITI_CACHE=0

# OpenSSL for Prisma migrations & curl for container HEALTHCHECK
RUN apk add --no-cache openssl curl

# Copy runtime assets and dependencies
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder --chown=node:node /app/apps/server/prisma.config.ts ./apps/server/prisma.config.ts

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:4000/health || exit 1

CMD ["node", "apps/server/dist/index.js"]
