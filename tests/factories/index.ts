/**
 * Test data factories for generating consistent test data.
 * Use these instead of hardcoding test data to ensure consistency.
 */

let idCounter = 1;

/**
 * Generate a unique ID for tests
 */
export function generateId(): number {
  return idCounter++;
}

/**
 * Reset ID counter (call in beforeEach if needed)
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * Generate a random string of specified length
 */
export function randomString(length = 10): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Generate a random email
 */
export function randomEmail(): string {
  return `user-${randomString()}@test.com`;
}

/**
 * Generate a timestamp (ISO string or Date)
 */
export function timestamp(asDate = false): string | Date {
  const date = new Date();
  return asDate ? date : date.toISOString();
}

/**
 * Create a mock AppConfig for tests
 */
export function createMockConfig(
  overrides?: Partial<{
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: number;
    COMMIT_TAG: string;
    LOG_LEVEL: string;
    LOG_DIR: string;
    DB_PATH: string;
    DB_LOGGING: boolean;
    TRUST_PROXY: boolean;
  }>
): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    PORT: 5057,
    COMMIT_TAG: 'test',
    LOG_LEVEL: 'error',
    LOG_DIR: './config/logs',
    DB_PATH: ':memory:',
    DB_LOGGING: false,
    TRUST_PROXY: false,
    ...overrides,
  };
}

/**
 * Wait for specified milliseconds (use sparingly, prefer waitFor from testing-library)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock error for testing
 */
export function createMockError(message = 'Test error', stack?: string): Error {
  const error = new Error(message);
  if (stack) {
    error.stack = stack;
  }
  return error;
}
