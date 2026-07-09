# Server

Express + Drizzle (libSQL/SQLite) backend for Warden. Organized for debugging, logging, and testing
first: fail-fast startup, request-scoped logging with trace ids, standardized errors, Awilix dependency
injection.

## Directory map

```
server/
  container.ts       # Awilix DI container with typed Cradle — buildContainer()
  index.ts           # Entry point and startup sequence
  kernel/            # Infrastructure with no domain meaning — the only home for it:
                     #   config (Zod-validated env), env, errors (AppError hierarchy),
                     #   logger (getChildLogger), eventBus, defineRoute,
                     #   middleware/ (requestId → requestLogger → … → errorHandler),
                     #   db (re-exports the DrizzleDb handle contract)
  database/          # Drizzle schema, migrations, session store (handle consumed via kernel/db)
  modules/           # Feature modules: schemas / handlers / routes; providers/ and media/
                     #   also own their domain logic behind a crafted public interface (index.ts)
  services/          # Business logic not yet moved into its module (tracked in
                     #   docs/architecture/fracture-ledger.md, "Server layering")
  cron/              # Automation scheduler (croner)
  health/            # System self-healing (ensureSystemJobs, failed-state middleware)
  types/             # Shared types and Express augmentations
  __tests__/         # Server unit + integration tests
```

## Core patterns

- **Fail-fast initialization.** Startup systems pair an initializer with a guarded accessor:
  `loadConfig()`/`getConfig()`, `initializeDatabase()`/`getDb()`. Initialization failure crashes the
  process; access before initialization throws. No silent fallbacks.
- **Child loggers.** Every module logs through `getChildLogger('Label')`; pass `requestId` in metadata
  to trace one request across subsystems.
- **Request lifecycle.** `requestId` → `requestLogger` → body parser → route handler (Zod validation
  via `defineRoute`, business logic via injected services) → `errorHandler` last.
- **Error propagation.** Handlers and services throw `AppError` subclasses; the global error handler
  maps them to structured JSON (`{ status: 'error', error: { type, message } }`). Unknown errors return
  a generic message in production.
- **Dependency injection.** `buildContainer()` registers services on a typed `Cradle`; handler
  factories receive dependencies by destructuring — no global accessors inside request code.

## Where things are documented

- [database/README.md](database/README.md) — Drizzle setup, schema, migrations
- [modules/README.md](modules/README.md) — the schemas/handlers/routes transport pattern
- [services/README.md](services/README.md) — business-logic conventions and testing
- `docs/architecture/` — the product model (`warden-core-model.md`), settled names (`VOCABULARY.md`),
  and the fracture ledger; read these before feature work
- [TESTING.md](../TESTING.md) — testing architecture

## Debugging

- `yarn dev:debug` starts the server with the inspector; attach from VS Code.
- `LOG_LEVEL=debug yarn dev` for verbose logs; filter by label: `yarn dev | grep '\[MediaQueryService\]'`.
