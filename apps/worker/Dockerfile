# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci

# Generate the Prisma client used by the worker.
COPY tsconfig.base.json tsconfig.json ./
COPY packages/core ./packages/core
COPY packages/db ./packages/db
RUN npm -w @telegraph/db run db:generate

COPY apps/worker ./apps/worker

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "-w", "@telegraph/worker", "run", "start"]