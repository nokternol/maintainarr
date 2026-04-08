import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Mock ResizeObserver — fires the callback immediately with a 1200px wide container.
// Required for components that use ResizeObserver (e.g. VirtualMediaGrid).
class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ contentRect: { width: 1200, height: 800 }, target } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Large viewport so useWindowVirtualizer renders all rows without scrolling in tests.
Object.defineProperty(window, 'innerHeight', { value: 10000, configurable: true, writable: true });

// Only start MSW in jsdom environment (client tests).
// Server tests run in Node and use supertest — MSW would intercept those requests.
if (typeof window !== 'undefined') {
  const { server } = await import('../mocks/server');

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
