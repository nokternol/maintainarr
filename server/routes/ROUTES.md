# Routes

Express routers that define API endpoints. One file per resource or domain.

## Pattern

Every route uses `defineRoute()` which provides:
- **Zod input validation** — body, query, and params schemas auto-validated before the handler runs
- **Typed handler context** — TypeScript infers request types from the schemas
- **Async error forwarding** — rejected promises automatically route to the error handler
- **Consistent response envelope** — handler return value wrapped in `{ status: 'ok', data: T }`

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { defineRoute } from '../utils/defineRoute';

const router = Router();

router.post(
  '/:id',
  defineRoute({
    schemas: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({ name: z.string().min(1) }),
      response: z.object({ id: z.number(), name: z.string() }),
    },
    handler: async ({ params, body }) => {
      // params.id is typed as number, body.name as string
      return { id: params.id, name: body.name };
    },
  }),
);

export default router;
```

## Adding a New Route Group

1. Create `server/routes/yourResource.ts` with a `Router()`.
2. Define routes using `defineRoute()` with Zod schemas.
3. Mount the router in `server/routes/index.ts`: `apiRouter.use('/your-resource', yourResourceRouter);`
4. The URL becomes `/api/your-resource/...`.

## Error Flow

1. Zod validation fails → `ValidationError` (400) with field errors
2. Handler throws `AppError` subclass → appropriate status code + structured response
3. Handler throws unknown error → 500 + generic message in production
4. All errors logged with `requestId` for tracing

## Accessing Services

Route handlers that need services should resolve them from the DI container:

```typescript
handler: async ({ req }) => {
  const someService = req.scope.resolve('someService');
  return someService.doWork();
},
```
