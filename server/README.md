# Server Architecture

Express + TypeORM backend for Maintainarr. This directory contains all server-side code organized for debugging, logging, and testing first.

## Purpose

Provide a structured backend framework with:
- Fail-fast configuration and database initialization
- Request-scoped logging with trace IDs
- Standardized error handling and API responses
- Dependency injection for testability
- Domain-organized modules for feature development

## Contents

```
server/
  config.ts          # Zod-validated configuration (env vars)
  container.ts       # Awilix DI container with typed Cradle
  errors.ts          # AppError hierarchy for standardized error handling
  index.ts           # Server entry point and startup sequence
  logger.ts          # Winston logger with child logger factory
  database/          # TypeORM connection, entities, and migrations
  middleware/        # Express middleware (request pipeline)
  modules/           # Domain-organized API modules (schemas/handlers/routes)
  services/          # Business logic (no Express types)
  types/             # Shared TypeScript types and Express augmentations
  utils/             # Small utilities (e.g., defineRoute)
  __tests__/         # Server-side unit and integration tests
```

## Core Patterns

### 1. Fail-Fast Initialization

Modules that require setup at startup use a two-function pattern:

**Initialization function** (\`loadX()\` / \`initializeX()\`)
- Called once during server startup in \`server/index.ts\`
- Validates inputs and throws on failure
- Crashes the process with a clear error message if setup fails

**Runtime accessor** (\`getX()\`)
- Used by other modules after initialization
- Throws if initialization never ran
- Catches programmer errors (accessing before initialization)

**Examples:**
- \`loadConfig()\` / \`getConfig()\` - Configuration
- \`initializeDatabase()\` / \`getDataSource()\` - Database connection

**Why:** Silent fallbacks hide bugs. If database connection fails or config is invalid, the server should not start. Problems surface immediately, not when the first request hits a broken code path.

### 2. Child Loggers

Every module creates its own child logger with a label:

\`\`\`typescript
import { getChildLogger } from './logger';
const log = getChildLogger('ModuleName');

log.info('Something happened', { userId: 123 });
// Output: [ModuleName] Something happened {"userId":123}
\`\`\`

Labels make it trivial to filter logs by subsystem. Pass \`requestId\` as metadata for per-request operations to trace a single request across all modules.

### 3. Request Lifecycle

\`\`\`
Request arrives
  → requestIdMiddleware          # Assigns or reads X-Request-Id
  → requestLoggerMiddleware      # Starts timer
  → JSON body parser
  → Route handler
    → Schema validation (Zod)
    → Service call (business logic)
    → Response sent
  → requestLoggerMiddleware      # Logs on 'finish' with duration
  → errorHandlerMiddleware       # Catches errors, returns structured JSON
\`\`\`

Middleware order matters:
1. \`requestId\` must be first (other middleware needs it for logging)
2. \`requestLogger\` needs requestId
3. Error handler must be last (catches errors from everything above)

### 4. Error Propagation

Route handlers and services throw \`AppError\` subclasses:
- \`NotFoundError\` (404)
- \`ValidationError\` (400, carries field errors)
- \`UnauthorizedError\` (401)
- \`ForbiddenError\` (403)
- \`ConflictError\` (409)

The global error handler catches them and returns:
\`\`\`json
{
  "status": "error",
  "error": {
    "type": "NOT_FOUND",
    "message": "User not found",
    "errors": { ... }  // Optional field errors
  }
}
\`\`\`

Unknown errors (programming bugs) return generic message in production, real message in development.

### 5. Dependency Injection

Awilix container manages dependencies:

\`\`\`typescript
// server/container.ts - Registration
container.register({
  config: asValue(config),
  dataSource: asValue(dataSource),
  userService: asClass(UserService).scoped(),
});

// Module handler factory - Automatic resolution via destructuring
export function createUserHandlers({ userService, config }: Cradle) {
  return {
    getUser: defineRoute({
      handler: async ({ params }) => userService.getById(params.id),
    }),
  };
}
\`\`\`

Dependencies are explicit and testable. No global accessors or singletons.

## Request Lifecycle

Full request flow showing middleware and service interaction:

\`\`\`typescript
// 1. Request arrives
POST /api/users HTTP/1.1
Content-Type: application/json
{"name": "John", "email": "john@example.com"}

// 2. requestIdMiddleware
req.requestId = 'abc-123'
X-Request-Id: abc-123

// 3. JSON parsing
req.body = { name: 'John', email: 'john@example.com' }

// 4. Route handler with validation
defineRoute({
  schemas: {
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  },
  handler: async ({ body }) => {
    // body is typed and validated
    return userService.create(body);
  },
})

// 5. Service business logic
class UserService {
  async create(data) {
    // Check for duplicates
    const existing = await this.repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictError('Email already exists');

    // Create user
    return this.repo.save(data);
  }
}

// 6. Response
HTTP/1.1 200 OK
X-Request-Id: abc-123
{"status": "ok", "data": {"id": 1, "name": "John", "email": "john@example.com"}}

// 7. Request logger
[HTTP][abc-123] POST /api/users 200 142ms
\`\`\`

## Adding New Code

### Add a New Service

Services contain business logic and are framework-agnostic (no Express types):

\`\`\`typescript
// server/services/userService.ts
import { getChildLogger } from '@server/logger';
import { NotFoundError } from '@server/errors';
import type { DataSource } from 'typeorm';

const log = getChildLogger('UserService');

export class UserService {
  constructor(private dataSource: DataSource) {}

  async getById(id: number) {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id });

    if (!user) {
      log.warn('User not found', { id });
      throw new NotFoundError('User not found');
    }

    return user;
  }
}

// server/container.ts - Register service
container.register({
  userService: asClass(UserService).scoped(),  // New instance per request
});
\`\`\`

### Add a New Module

Modules are organized by domain (users, tasks, etc.) with three layers:

\`\`\`typescript
// server/modules/users/users.schemas.ts
export const userSchemas = {
  getUser: {
    params: z.object({ id: z.coerce.number() }),
  },
};

// server/modules/users/users.handler.ts
export function createUserHandlers({ userService }: Cradle) {
  return {
    getUser: defineRoute({
      schemas: userSchemas.getUser,
      handler: async ({ params }) => userService.getById(params.id),
    }),
  };
}

// server/modules/users/users.routes.ts
export function createUserRoutes(cradle: Cradle) {
  const router = Router();
  const handlers = createUserHandlers(cradle);

  router.get('/:id', handlers.getUser);

  return router;
}

// server/modules/index.ts
export function createApiRouter(cradle: Cradle) {
  const router = Router();

  router.use('/health', createHealthRoutes(cradle));
  router.use('/users', createUserRoutes(cradle));  // Mount new routes

  return router;
}
\`\`\`

See [modules/README.md](modules/README.md) for detailed module structure.

### Add Middleware

Middleware intercepts requests before they reach route handlers:

\`\`\`typescript
// server/middleware/auth.ts
import { getChildLogger } from '@server/logger';
import { UnauthorizedError } from '@server/errors';
import type { Request, Response, NextFunction } from 'express';

const log = getChildLogger('Auth');

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    log.warn('Missing auth token', { requestId: req.requestId });
    throw new UnauthorizedError('Authentication required');
  }

  // Validate token...
  req.user = decoded;
  next();
}

// server/index.ts - Wire into pipeline
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use('/api', authMiddleware);  // Auth required for all /api routes
app.use('/api', createApiRouter(container.cradle));
\`\`\`

See [middleware/README.md](middleware/README.md) for middleware ordering.

## Testing

Server tests run in Node.js environment (not jsdom). Use test helpers for consistent patterns:

\`\`\`typescript
import { createApiClient, expectSuccessResponse } from '@tests/helpers/api';
import { createMockConfig } from '@tests/factories';

describe('User API', () => {
  let app: Express;
  let client: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    // Initialize test app with in-memory database
    const config = loadConfig();
    const dataSource = await initializeDatabase(config);
    const container = buildContainer({ config, dataSource });

    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use('/api', createApiRouter(container.cradle));
    app.use(errorHandlerMiddleware);

    client = createApiClient(app);
  });

  it('gets user by ID', async () => {
    const response = await client.get('/api/users/1');
    const data = expectSuccessResponse(response);

    expect(data).toMatchObject({
      id: 1,
      name: expect.any(String),
    });
  });
});
\`\`\`

See [TESTING.md](../TESTING.md) for full testing documentation.

## Debugging

### VS Code Debugger

Start server with inspector:
\`\`\`bash
yarn dev:debug
\`\`\`

Then press F5 or use "Attach to Node Process" in VS Code.

### Logging

Set log level via environment:
\`\`\`bash
LOG_LEVEL=debug yarn dev
\`\`\`

Levels: \`error\` | \`warn\` | \`info\` | \`http\` | \`verbose\` | \`debug\` | \`silly\`

Filter logs by module label:
\`\`\`bash
yarn dev | grep '\[UserService\]'
\`\`\`

### Database Logging

Enable SQL query logging:
\`\`\`bash
DB_LOGGING=true yarn dev
\`\`\`

## Further Reading

- [database/README.md](database/README.md) - TypeORM, entities, migrations
- [middleware/README.md](middleware/README.md) - Request pipeline and ordering
- [modules/README.md](modules/README.md) - Domain module structure
- [services/README.md](services/README.md) - Business logic patterns
- [types/README.md](types/README.md) - Type definitions and Express augmentation
- [utils/README.md](utils/README.md) - Utility functions
- [TESTING.md](../TESTING.md) - Testing architecture and patterns
- [TESTING_PATTERNS.md](../TESTING_PATTERNS.md) - Test writing guide
