# Services

Business logic and external API interactions. Services are pure TypeScript — no Express types.

## Design Principles

- **No Express imports.** Services never import `Request`, `Response`, or any Express type. This keeps them testable without HTTP.
- **Dependencies via constructor.** Services receive what they need through Awilix injection. No global accessor calls inside service methods.
- **Throw AppError subclasses.** Services communicate failure through the error hierarchy (`NotFoundError`, `ValidationError`, etc.). Route handlers don't need to catch or translate these — the error middleware handles it.
- **Module-specific logging.** Each service creates its own child logger.

## Example Service

```typescript
// server/services/exampleService.ts
import { getChildLogger } from '../logger';
import { NotFoundError } from '../errors';
import type { DataSource } from 'typeorm';

const log = getChildLogger('ExampleService');

export class ExampleService {
  constructor(private readonly dataSource: DataSource) {}

  async getById(id: number) {
    log.debug('Fetching example', { id });
    const result = await this.dataSource.getRepository(Example).findOneBy({ id });
    if (!result) throw new NotFoundError(`Example ${id} not found`);
    return result;
  }
}
```

## Registering a Service

Add the service to the container in `server/container.ts`:

```typescript
import { asClass } from 'awilix';
import { ExampleService } from './services/exampleService';

// In buildContainer():
container.register({
  exampleService: asClass(ExampleService).scoped(),
});
```

Update the `Cradle` interface:

```typescript
export interface Cradle {
  config: AppConfig;
  dataSource: DataSource;
  exampleService: ExampleService;
}
```

## Using Services in Handlers

Services are injected via the cradle in handler factories. **No manual resolution needed.**

```typescript
// server/modules/example/example.handler.ts
import { defineRoute } from '@server/utils/defineRoute';
import { exampleSchemas } from './example.schemas';
import type { ExampleService } from '@server/services/exampleService';

export function createExampleHandlers({ exampleService }: { exampleService: ExampleService }) {
  return {
    getItem: defineRoute({
      schemas: exampleSchemas.getItem,
      handler: async ({ params }) => {
        // exampleService is directly available — no req.scope.resolve()
        return exampleService.getById(params.id);
      },
    }),
  };
}
```

**Pattern:**
- Handler factory receives `{ exampleService }` via destructuring from cradle
- Services are available in closure scope for all handlers returned by the factory
- No need to call `req.scope.resolve('exampleService')` inside handlers

## Testing Services

Services are tested without Express. Pass mock dependencies via constructor:

```typescript
const mockDataSource = {
  getRepository: vi.fn().mockReturnValue({
    findOneBy: vi.fn().mockResolvedValue(null),
  }),
} as unknown as DataSource;

const service = new ExampleService(mockDataSource);
await expect(service.getById(999)).rejects.toThrow(NotFoundError);
```

## Service Lifetime

Services are registered as `.scoped()` in Awilix, meaning:
- A new instance is created per HTTP request
- Each request gets its own isolated service instances
- Services can safely maintain per-request state (like request-specific logging metadata)

If you need a singleton service (e.g., caching, connection pools), use `.singleton()` instead.
