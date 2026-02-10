import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Only start MSW in jsdom environment (client tests).
// Server tests run in Node and use supertest — MSW would intercept those requests.
if (typeof window !== 'undefined') {
  const { server } = await import('../mocks/server');

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
