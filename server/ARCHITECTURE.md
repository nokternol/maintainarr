# Server Architecture

This document explains the design intent behind the `server/` directory structure. Read this before adding new backend code.

## Directory Structure

```
server/
  config.ts          # Zod-validated configuration (env vars)
  errors.ts          # AppError hierarchy for standardized error handling
  index.ts           # Server entry point and startup sequence
  logger.ts          # Winston logger with child logger factory
  ARCHITECTURE.md    # This file
  database/          # TypeORM connection, entities, and migrations
  middleware/         # Express middleware (request pipeline)
  routes/            # Express routers (API endpoints)
  services/          # Business logic (no Express types)
  types/             # Shared TypeScript types and Express augmentations
  utils/             # Small utilities (e.g., asyncHandler)
  __tests__/         # Server-side unit and integration tests
```

## Core Patterns

### Fail-Fast Accessors

Modules that require initialization at startup follow a two-function pattern:

- **`loadX()` / `initializeX()`** — Called once during server startup. Validates inputs and throws on failure, crashing the process with a clear error message.
- **`getX()`** — Runtime accessor. Throws if the initialization function was never called. This catches programmer errors (importing a module before the server has fully started).

Examples: `loadConfig()`/`getConfig()`, `initializeDatabase()`/`getDataSource()`.

**Why:** Silent fallbacks and lazy initialization hide bugs. If the database connection fails, the server should not start. If config is invalid, the server should not start. Fail-fast means problems surface immediately, not when the first user request hits a broken path.

### Child Loggers

Every module creates its own child logger:

```typescript
import { getChildLogger } from './logger';
const log = getChildLogger('ModuleName');
```

The label appears in every log entry (`[ModuleName]`), making it trivial to filter logs by subsystem. Pass `requestId` as metadata on per-request operations to trace a single request across all modules.

### Request Lifecycle

```
Request arrives
  → requestIdMiddleware  (assigns or reads X-Request-Id)
  → requestLoggerMiddleware  (starts timer)
  → route handler
    → service (business logic)
    → response sent
  → requestLoggerMiddleware  (logs on 'finish' with duration)
  → errorHandlerMiddleware  (catches thrown errors, returns structured JSON)
```

### Error Propagation

Route handlers and services throw `AppError` subclasses. The global error handler catches them and returns a consistent JSON response. Unknown errors (programming bugs) get a generic message in production but the real message in development.

## Adding a New Module

1. Create the module file(s) in the appropriate directory.
2. Create a child logger: `const log = getChildLogger('YourModule');`
3. If the module needs initialization, use the fail-fast accessor pattern.
4. Add tests in `server/__tests__/`.
5. Wire it into `server/index.ts` startup if it needs initialization.
6. Update this doc if you're adding a new directory or pattern.
