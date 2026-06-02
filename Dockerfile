# ── Stage 1: Install all dependencies ────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# dumb-init: lightweight init that properly forwards signals as PID 1.
# Ensures SIGTERM reaches the Node process for graceful shutdown.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

# Production dependencies only (nodemon is in dependencies, so it's included)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Next.js compiled output and static assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Express compiled output
COPY --from=builder /app/dist ./dist

# Drizzle migration SQL files — tsc does not copy non-.ts files
COPY --from=builder /app/server/database/migrations ./dist/database/migrations

# config/ is mounted as a volume at runtime for SQLite db and logs.
# DB_PATH defaults to ./config/db/warden.db
# LOG_DIR defaults to ./config/logs
VOLUME ["/app/config"]

EXPOSE 5057

# dumb-init wraps node so signals are forwarded correctly.
# Override CMD with "nodemon dist/index.js" for container-local hot reload
# when source files are mounted as a volume.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
