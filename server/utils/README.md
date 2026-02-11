# Utils

Small utility functions and helper modules for the server.

## Purpose

Provide reusable utilities that don't fit into other directories:
- **defineRoute** - Wraps handlers with schema validation and response formatting
- Future utilities as needed

## Contents

```
utils/
  defineRoute.ts    # Handler wrapper for schema validation + response envelope
```

## defineRoute

Connects Zod schemas to handler logic, handling validation and response wrapping:

```typescript
import { defineRoute } from '@server/utils/defineRoute';
import { userSchemas } from './schemas';

export function createUserHandlers({ userService }) {
  return {
    getUser: defineRoute({
      schemas: userSchemas.getUser,  // Zod schemas for validation
      handler: async ({ params, body, query }) => {
        // Params/body/query are validated and typed
        return userService.getById(params.id);
      },
    }),
  };
}
```

**What it does:**
1. Validates `params`, `body`, `query` against Zod schemas
2. Throws `ValidationError` if validation fails
3. Calls handler with validated, typed data
4. Wraps result in `{ status: 'ok', data: T }`
5. Catches errors and forwards to error middleware

**Benefits:**
- Type-safe request data
- Automatic validation errors with field details
- Consistent response format
- Single place to add logging, metrics, etc.

## Adding Utilities

Keep utilities small and focused. If a utility grows large or has many dependencies, consider making it a service.

```typescript
// server/utils/myUtil.ts
export function myUtil(input: string): string {
  return input.toUpperCase();
}

// Use in handlers or services
import { myUtil } from '@server/utils/myUtil';
```

## Further Reading

- [../modules/README.md](../modules/README.md) - Using defineRoute in handlers
- [../README.md](../README.md) - Server architecture
