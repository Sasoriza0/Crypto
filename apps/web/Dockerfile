# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Baked into Next.js bundle and CSP at build time
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy root & workspace manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies deterministically
RUN npm ci

# Copy sources for shared domain contracts and Next.js frontend
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Ensure public folder exists so COPY in runner won't fail
RUN mkdir -p /app/apps/web/public

# Build shared contracts
RUN npm run build --workspace=@shiftcrack/shared

# Build Next.js standalone bundle
ENV NODE_ENV=production
RUN npm run build --workspace=@shiftcrack/web

# -----------------------------------------------------------------------------
# Stage 2: Production Runner
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache curl

# Next.js standalone output mirrors workspace hierarchy:
# /app/apps/web/server.js and /app/node_modules/
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
