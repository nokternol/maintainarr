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

Services are tested without Express. There are two patterns depending on service type:

### Internal Services (DataSource-backed)

Pass mock dependencies via constructor:

```typescript
const mockDataSource = {
  getRepository: vi.fn().mockReturnValue({
    findOneBy: vi.fn().mockResolvedValue(null),
  }),
} as unknown as DataSource;

const service = new ExampleService(mockDataSource);
await expect(service.getById(999)).rejects.toThrow(NotFoundError);
```

### External Services (extending `BaseMetadataProvider`)

External service tests use **MSW** to mock the network layer — not the `ky` client itself. This tests actual URL construction, headers, and response parsing against a real HTTP shape.

```typescript
// tests/mocks/handlers/example.ts
import { http, HttpResponse } from 'msw';
export const exampleHandlers = [
  http.get('http://localhost:1234/api/v1/items', () =>
    HttpResponse.json([{ id: 1, name: 'foo' }])
  ),
];

// server/__tests__/services/exampleService.test.ts
// MSW is started automatically via tests/setup/vitest.server.ts
it('fetches items', async () => {
  const service = new ExampleService(mockProvider, logger);
  const items = await service.getItems();
  expect(items[0].name).toBe('foo');
});
```

The MSW node server is started for all server tests via `tests/setup/vitest.server.ts`. Handlers are declared in `tests/mocks/handlers/` and registered in `tests/mocks/handlers/index.ts`.

## Service Lifetime

Services registered in Awilix can be:
- **`.scoped()`** — new instance per HTTP request (default; safe for per-request state)
- **`.singleton()`** — shared across all requests (use for caches, connection pools)

## External Service Integrations

Media server integrations (Radarr, Sonarr, Tautulli, Jellyfin, Overseerr, Seerr) extend `BaseMetadataProvider` rather than the standard pattern above.

- **`BaseMetadataProvider`** (`server/services/baseMetadataProvider.ts`) — abstract base class providing a pre-configured [`ky`](https://github.com/sindresorhus/ky) instance (Node 24 native `fetch` wrapper). Handles `prefixUrl` construction from the stored URL + optional `urlBase` setting, 10s timeout, JSON `Accept` header, and error logging hooks.
- Individual services extend it and call `this.client.get('endpoint').json<T>()` — no auth boilerplate needed per-method.
- **Auth patterns**:
  - Radarr/Sonarr/Tautulli: API key as `?apikey=` query param
  - Jellyfin: `X-Emby-Authorization` header
  - Overseerr/Seerr: `X-Api-Key` header
- Connection config (URL, API key, settings) is stored in the `MetadataProvider` database entity.
