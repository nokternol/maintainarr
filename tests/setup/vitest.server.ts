import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';

// Start MSW in Node environment for server-side service tests.
// This intercepts outbound HTTP calls made via native fetch / ky.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
