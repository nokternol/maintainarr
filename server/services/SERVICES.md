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

## Testing Services

Services are tested without Express. Pass mock dependencies via constructor:

```typescript
const service = new ExampleService(mockDataSource);
await expect(service.getById(999)).rejects.toThrow(NotFoundError);
```
