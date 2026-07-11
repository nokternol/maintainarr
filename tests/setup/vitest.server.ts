import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';

// Start MSW in Node environment for server-side service tests.
// This intercepts outbound HTTP calls made via native fetch / ky.
beforeAll(() =>
  server.listen({
    onUnhandledRequest(request, print) {
      // supertest(app) starts a real ephemeral HTTP server on 127.0.0.1 and talks to it
      // over the network — MSW's node interceptor patches that loopback traffic too, even
      // though it's the app under test, not an external dependency. No test in this repo
      // mocks a real provider at the bare loopback address (they use `localhost:<port>` or
      // a named host), so this can never mask a genuinely-unmocked provider call — only
      // silence the constant false-positive noise that made every other warning easy to
      // ignore.
      if (new URL(request.url).hostname === '127.0.0.1') return;
      print.warning();
    },
  })
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
