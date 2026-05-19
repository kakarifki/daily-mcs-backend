# syntax=docker/dockerfile:1.6

# ---------- deps ----------
FROM oven/bun:1.1.42-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# ---------- build (generate Prisma client) ----------
FROM oven/bun:1.1.42-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate

# ---------- runtime ----------
FROM oven/bun:1.1.42-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    UPLOAD_DIR=/app/storage/uploads \
    OUTPUT_DIR=/app/storage/outputs

# OpenSSL dibutuhkan Prisma engine di Alpine
RUN apk add --no-cache openssl ca-certificates && \
    mkdir -p /app/storage/uploads /app/storage/outputs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Migrasi otomatis jalan tiap container start — aman karena Prisma migrate
# deploy idempoten. Lalu hand-off ke Bun (PID 1).
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun run src/index.ts"]
