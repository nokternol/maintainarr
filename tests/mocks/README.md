# Test Mocks

MSW (Mock Service Worker) handlers for API mocking.

## Purpose

Provide shared API mocks for all test frameworks:
- Vitest (unit tests)
- Cypress (E2E tests)
- Ladle (component stories)

## Structure

```
mocks/
  handlers/       # API mock handlers by domain
    index.ts      # Combined handlers array
  browser.ts      # MSW browser worker (Cypress, Ladle)
  server.ts       # MSW Node server (Vitest)
```

## Creating Handlers

```typescript
// tests/mocks/handlers/users.ts
import { http, HttpResponse } from 'msw';

export const userHandlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      status: 'ok',
      data: { id: params.id, name: 'John Doe', email: 'john@example.com' },
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      status: 'ok',
      data: { id: 1, ...body },
    }, { status: 201 });
  }),
];

// tests/mocks/handlers/index.ts
import { userHandlers } from './users';

export const handlers = [...userHandlers];
```

## Overriding Mocks

Override handlers per test:

```typescript
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles 404', async () => {
  server.use(
    http.get('/api/users/:id', () => {
      return HttpResponse.json(
        { status: 'error', error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    })
  );

  // Test error handling...
});
```

## Test Framework Setup

Handlers are initialized automatically:
- **Vitest**: `tests/setup/vitest.ts`
- **Cypress**: `cypress/support/e2e.ts`
- **Ladle**: `.ladle/components.tsx`

See [../TESTING.md](../../TESTING.md) for architecture details.
