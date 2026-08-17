# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# Install workspace deps (all workspace manifests required for npm ci).
COPY package.json package-lock.json .npmrc* ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci

# Prisma generated client (part of web build + prisma migrate).
COPY tsconfig.base.json tsconfig.json ./
COPY packages/core ./packages/core
COPY packages/db ./packages/db
RUN npm -w @fun/db run db:generate

# Web source.
COPY apps/web ./apps/web
# Route handlers import Prisma client from packages/db/generated — make it resolvable.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm -w @fun/web run build

EXPOSE 3000
CMD ["npm", "-w", "@fun/web", "run", "start"]