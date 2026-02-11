# Modules

Domain-organized API modules with separated concerns. Each module represents a feature or resource domain (e.g., health, users, media) and owns its schemas, handlers, routes, and services.

## Architecture

Each module separates three layers to prevent schema leakage and mixing of concerns:

| Layer | File | Responsibility | Dependencies |
|-------|------|----------------|--------------|
| **Schemas** | `*.schemas.ts` | Zod validation schemas (API contract) | `zod` only |
| **Handlers** | `*.handler.ts` | Business logic orchestration | schemas, services, errors |
| **Routes** | `*.routes.ts` | HTTP wiring (methods, paths) | handlers, express |

## Example Module Structure

```
server/modules/
  health/
    health.schemas.ts   # Zod schemas (request/response types)
    health.handler.ts   # Handler factory (business logic)
    health.routes.ts    # Express router (HTTP wiring)
  index.ts              # Mounts all module routers
  MODULES.md            # This file
```

## 1. Schemas Layer

Defines the API contract using Zod. This is the single source of truth for input validation and response types.

```typescript
// server/modules/health/health.schemas.ts
import { z } from 'zod';

export const healthSchemas = {
  getHealth: {
    response: z.object({
      status: z.string(),
      timestamp: z.string(),
      version: z.string(),
      environment: z.string(),
    }),
  },
};

export type HealthResponse = z.infer<typeof healthSchemas.getHealth.response>;
```

**Rules:**
- Only import `zod`. No Express, no services, no database types.
- Export both the schemas object and inferred TypeScript types.
- Group schemas by endpoint (e.g., `getHealth`, `createUser`, `updateMedia`).

## 2. Handlers Layer

Factory functions that receive dependencies via Awilix cradle injection. Returns an object of `defineRoute()`-wrapped handlers.

```typescript
// server/modules/health/health.handler.ts
import { defineRoute } from '@server/utils/defineRoute';
import { healthSchemas } from './health.schemas';
import type { AppConfig } from '@server/config';

export function createHealthHandlers({ config }: { config: AppConfig }) {
  return {
    getHealth: defineRoute({
      schemas: healthSchemas.getHealth,
      handler: async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.COMMIT_TAG,
        environment: config.NODE_ENV,
      }),
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
// server/modules/health/health.routes.ts
import { Router } from 'express';
import { createHealthHandlers } from './health.handler';
import type { Cradle } from '@server/container';

export function createHealthRoutes(cradle: Cradle) {
  const router = Router();
  const { getHealth } = createHealthHandlers(cradle);

  router.get('/', getHealth);

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
import { createHealthRoutes } from './health/health.routes';
import type { Cradle } from '@server/container';

export function createApiRouter(cradle: Cradle) {
  const router = Router();

  router.use('/health', createHealthRoutes(cradle));
  // router.use('/users', createUserRoutes(cradle));
  // router.use('/media', createMediaRoutes(cradle));

  return router;
}
```

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

3. **Create handler factory**: `yourDomain.handler.ts`
   ```typescript
   import { defineRoute } from '@server/utils/defineRoute';
   import { yourDomainSchemas } from './yourDomain.schemas';
   import type { YourService } from '@server/services/yourService';

   export function createYourDomainHandlers({ yourService }: { yourService: YourService }) {
     return {
       getItem: defineRoute({
         schemas: yourDomainSchemas.getItem,
         handler: async ({ params }) => {
           return yourService.getById(params.id);
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

6. **Register service** (if needed): Update `server/container.ts`
   ```typescript
   import { YourService } from './services/yourService';

   container.register({
     yourService: asClass(YourService).scoped(),
   });
   ```

7. **Update Cradle type**:
   ```typescript
   export interface Cradle {
     // ...existing
     yourService: YourService;
   }
   ```

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
