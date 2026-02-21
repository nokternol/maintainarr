# Agent Architecture Context

## High-Level Stack
- **Frontend**: Next.js 15, React 18, Tailwind CSS, SWR
- **Backend**: Express (v4), SQLite, TypeORM, Zod
- **HTTP Client**: `ky` (lightweight TypeScript-first wrapper around Node 24 native `fetch`) — used by external media service integrations
- **Testing**: Vitest (Unit), Cypress (E2E), Ladle (Components), MSW (API Mocking — client *and* server-side)
- **Tooling**: Biome (Lint/Format), TypeScript, Yarn v1

## Backend Architecture (Server)
Located in `server/`. Clean architecture with strict separation of concerns.

### Core Principles
1. **Fail-Fast Initialization**: Systems like config (`loadConfig`) and database (`initializeDatabase`) are loaded synchronously at startup. If they fail, the server crashes immediately. Runtime code accesses them via getters (`getConfig`) which throw if not initialized.
2. **Dependency Injection**: Awilix provides DI (`server/container.ts`). Services and handlers explicitly declare their dependencies.
3. **Structured Logging**: Winston logger providing child loggers per module (`getChildLogger('ModuleName')`). `X-Request-Id` is traced through the request lifecycle.
4. **Standardized Errors**: `AppError` subclasses (e.g. `NotFoundError`, `ValidationError`) are thrown by services/handlers and caught by a global error handler to return standardized JSON.
5. **Route Definition**: Uses Zod for strict schema validation via a `defineRoute` utility. Handlers are async and type-safe.

### Request Flow
1. Middleware (RequestId -> Logger -> Body Parser)
2. Route handler (Zod validation via `defineRoute`) -> Service (business logic via DI)
3. Global Error Handler (if exceptions are thrown)

## Frontend Architecture (Src)
Located in `src/`. Standard Next.js pages router or app router (needs verification, but likely Pages based on structure or App router). Follows strict testing bounds.

### Styling Ecosystem
- **Teal & Slate**: Teal (Action color: `teal-600`), Slate/Gray (Neutrals: `slate-950`, `gray-50` to `gray-900`).
- **Surfaces**: `bg-gray-50` (floor), `bg-white` (card), `border-gray-200` (depth limits). Dark mode fully supported via `slate-950` and `gray-900`.
