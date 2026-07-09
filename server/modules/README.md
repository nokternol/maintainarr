# Modules

Feature modules. Each module owns its schemas, handlers, and routes for one API surface (e.g., media, automations, providers), and — per the target design in `docs/intent/server-architecture-north-star.md` — its domain logic too, exposed through a deliberately crafted public interface (`index.ts`, never a wholesale re-export). `providers/`, `media/`, `mediaQueries/`, `automations/`, `auth/`, and `system/` have converged: each owns its services/jobs behind its `index.ts` and a `<module>.registrations.ts` (a `<Module>Cradle` + `register<Module>Dependencies()`, composed into `server/container.ts`); everything outside a module imports only its `index.ts`. `settings/` has no domain logic of its own — it's pure transport, consuming `providerSettingsService` from providers. Current convergence status is tracked in `docs/architecture/fracture-ledger.md`, "Server layering".

## Architecture

Each module separates three layers to prevent schema leakage and mixing of concerns:

| Layer | File | Responsibility | Dependencies |
|-------|------|----------------|--------------|
| **Schemas** | `*.schemas.ts` | Zod validation schemas (API contract) | `zod` only |
| **Handlers** | `*.handler.ts` | Business logic orchestration | schemas, services, errors |
| **Routes** | `*.routes.ts` | HTTP wiring (methods, paths) | handlers, express |

## Example Module Structure

The transport layer (schemas/handlers/routes) is the same for every module, domain-owning or not.
`settings/` is the simplest still-live example — pure transport, no domain logic of its own:

```
server/modules/
  settings/
    settings.schemas.ts   # Zod schemas (request/response types)
    settings.handler.ts   # Handler factory (business logic)
    settings.routes.ts    # Express router (HTTP wiring)
    index.ts               # Crafted public interface
  index.ts                 # Mounts all module routers
  README.md                # This file
```

## 1. Schemas Layer

Defines the API contract using Zod. This is the single source of truth for input validation and response types.

```typescript
// server/modules/settings/settings.schemas.ts
import { z } from 'zod';

export const settingsSchemas = {
  createProvider: {
    body: z.object({ type: z.string(), name: z.string(), url: z.string() }),
  },
};
```

**Rules:**
- Only import `zod`. No Express, no services, no database types.
- Export both the schemas object and inferred TypeScript types.
- Group schemas by endpoint (e.g., `getHealth`, `createUser`, `updateMedia`).

## 2. Handlers Layer

Factory functions that receive dependencies via Awilix cradle injection. Returns an object of `defineRoute()`-wrapped handlers.

```typescript
// server/modules/settings/settings.handler.ts
import { defineRoute } from '@server/kernel/defineRoute';
import type { ProviderSettingsService } from '@server/modules/providers';
import { settingsSchemas } from './settings.schemas';

export function createSettingsHandlers({ providerSettingsService }: { providerSettingsService: ProviderSettingsService }) {
  return {
    createProvider: defineRoute({
      schemas: settingsSchemas.createProvider,
      handler: async ({ body }) => providerSettingsService.create(body),
    }),
  };
}
```

**Rules:**
- Factory pattern: `createXHandlers(cradle)` receives dependencies via destructuring.
- Use `defineRoute()` to marry schemas to handler logic.
- Handlers return the response data directly — `defineRoute` wraps it in `{ status: 'ok', data: T }`.
- Services and config are injected via cradle, **not** resolved from `req.scope.resolve()`.

## 3. Routes Layer

Pure HTTP wiring. Receives cradle, calls handler factory, mounts handlers to paths.

```typescript
// server/modules/settings/settings.routes.ts
import { Router } from 'express';
import { createSettingsHandlers } from './settings.handler';
import type { Cradle } from '@server/container';

export function createSettingsRoutes(cradle: Cradle) {
  const router = Router();
  const { createProvider } = createSettingsHandlers(cradle);

  router.post('/providers', ...createProvider);

  return router;
}
```

**Rules:**
- Function signature: `createXRoutes(cradle: Cradle)`
- Call the handler factory with cradle to get handlers.
- Wire handlers to HTTP methods and paths.
- No business logic — that lives in handlers.

## 4. Module Index

Mounts all module routers under their respective paths.

```typescript
// server/modules/index.ts
import { Router } from 'express';
import { createSettingsRoutes } from './settings';
import type { Cradle } from '@server/container';

export function createApiRouter(cradle: Cradle) {
  const router = Router();

  router.use('/settings', createSettingsRoutes(cradle));
  // router.use('/your-domain', createYourDomainRoutes(cradle));

  return router;
}
```

Route creators are imported through each module's crafted `index.ts`, not a deep path into the
module's internals — the one exception is a module's own transport files importing each other
(`settings.routes.ts` importing `./settings.handler` directly, for example).

## Adding a New Module

1. **Create the directory**: `server/modules/yourDomain/`

2. **Create schemas**: `yourDomain.schemas.ts`
   ```typescript
   import { z } from 'zod';

   export const yourDomainSchemas = {
     getItem: {
       params: z.object({ id: z.coerce.number() }),
       response: z.object({ id: z.number(), name: z.string() }),
     },
   };
   ```

3. **Create handler factory**: `yourDomain.handler.ts`. Domain logic that belongs to this module
   lives in the module itself (e.g. `yourDomainService.ts`, beside the transport files) — there is no
   `server/services/` to import it from anymore. A handler consuming another module's logic imports
   only that module's crafted interface (e.g. `@server/modules/providers`), never a deep path into it.
   ```typescript
   import { defineRoute } from '@server/kernel/defineRoute';
   import { yourDomainSchemas } from './yourDomain.schemas';
   import type { YourDomainService } from './yourDomainService';

   export function createYourDomainHandlers({ yourDomainService }: { yourDomainService: YourDomainService }) {
     return {
       getItem: defineRoute({
         schemas: yourDomainSchemas.getItem,
         handler: async ({ params }) => {
           return yourDomainService.getById(params.id);
         },
       }),
     };
   }
   ```

4. **Create router**: `yourDomain.routes.ts`
   ```typescript
   import { Router } from 'express';
   import { createYourDomainHandlers } from './yourDomain.handler';
   import type { Cradle } from '@server/container';

   export function createYourDomainRoutes(cradle: Cradle) {
     const router = Router();
     const { getItem } = createYourDomainHandlers(cradle);

     router.get('/:id', getItem);

     return router;
   }
   ```

5. **Mount in index**: Add to `server/modules/index.ts`
   ```typescript
   router.use('/your-domain', createYourDomainRoutes(cradle));
   ```

6. **Add the module's registrations file** (if it owns a service): `yourDomain.registrations.ts`,
   mirroring `providers.registrations.ts` — a `YourDomainCradle` interface and a
   `registerYourDomainDependencies()` function:
   ```typescript
   import { type AwilixContainer, type NameAndRegistrationPair, asClass } from 'awilix';
   import { YourDomainService } from './yourDomainService';

   export interface YourDomainCradle {
     yourDomainService: YourDomainService;
   }

   export function registerYourDomainDependencies<TCradle extends YourDomainCradle>(
     container: AwilixContainer<TCradle>
   ): void {
     const registrations: NameAndRegistrationPair<YourDomainCradle> = {
       yourDomainService: asClass(YourDomainService).scoped(),
     };
     container.register(registrations as NameAndRegistrationPair<TCradle>);
   }
   ```

7. **Export from the module's `index.ts`** and compose into `server/container.ts`'s `Cradle`
   (`extends ... YourDomainCradle`) and `buildContainer()` (`registerYourDomainDependencies(container)`)
   — `server/container.ts` never registers a module's services inline.

## Error Flow

1. **Zod validation fails** → `ValidationError` (400) with field-specific errors
2. **Handler throws `AppError` subclass** → Appropriate status code + structured JSON
3. **Handler throws unknown error** → 500 + generic message (in production)
4. **All errors logged** with `requestId` for tracing

## Benefits of This Pattern

- **No schema leakage**: Schemas live in one place, imported where needed, not scattered across files.
- **Direct dependency injection**: Handler factories receive what they need via cradle — no manual `req.scope.resolve()` calls.
- **Layer independence**: Routes can change HTTP wiring without touching business logic. Handlers can be tested without Express.
- **Type safety**: Zod schemas drive TypeScript types for request/response throughout the handler.
- **Scalability**: Each domain is self-contained. Adding a feature means adding a module, not editing shared files.
