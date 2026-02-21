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
    auth.ts       # Auth endpoint mocks
    backdrops.ts  # Backdrop endpoint mocks
    radarr.ts     # Radarr API mocks (outbound)
    sonarr.ts     # Sonarr API mocks (outbound)
    tautulli.ts   # Tautulli API mocks (outbound)
    jellyfin.ts   # Jellyfin API mocks (outbound)
    overseerr.ts  # Overseerr & Seerr API mocks (outbound)
  browser.ts      # MSW browser worker (Cypress, Ladle)
  server.ts       # MSW Node server (Vitest — both client and server tests)
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

MSW is initialized in two places depending on the test environment:

| Setup file | Environment | Purpose |
|---|---|---|
| `tests/setup/vitest.ts` | `happy-dom` (client tests) | Starts MSW browser worker; intercepts requests made by client-side React code |
| `tests/setup/vitest.server.ts` | `node` (server tests) | Starts MSW node server; intercepts **outbound** `fetch`/`ky` calls made by server-side services to external APIs (Radarr, Sonarr, etc.) |

The `vitest.server.ts` setup uses `onUnhandledRequest: 'warn'` so service tests that fire unexpected requests produce a console warning rather than failing the suite.

Both setup files call `server.resetHandlers()` in `afterEach` so per-test overrides don't leak.

See [../TESTING.md](../../TESTING.md) for architecture details.
