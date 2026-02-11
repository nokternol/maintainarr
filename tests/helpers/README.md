# Test Helpers

Reusable testing utilities for API and component tests.

## Purpose

Provide consistent testing patterns:
- API testing with supertest
- Component testing with React Testing Library
- Test data factories

## API Testing (`api.ts`)

Utilities for testing Express APIs:

```typescript
import { createApiClient, expectSuccessResponse, expectErrorResponse } from '@tests/helpers/api';

const app = express();
// ... setup app ...

const client = createApiClient(app);

// Make requests
const response = await client.get('/api/users/1');
const response = await client.post('/api/users', { name: 'John' });

// Assert responses
const data = expectSuccessResponse(response);
expectErrorResponse(response, 404, 'NOT_FOUND');
expectValidationError(response, { email: ['Required'] });
```

## Component Testing (`component.tsx`)

Utilities for React Testing Library:

```typescript
import { render, screen, setupUser, waitForLoadingToFinish } from '@tests/helpers/component';

// Render with future providers (theme, router, etc.)
render(<MyComponent />);

// User interactions
const user = setupUser();
await user.click(screen.getByRole('button'));
await user.type(screen.getByLabelText('Name'), 'John');

// Wait for async operations
await waitForLoadingToFinish();
```

## Test Factories (`factories/index.ts`)

Generate consistent test data:

```typescript
import { generateId, randomEmail, randomString, createMockConfig, timestamp } from '@tests/factories';

const user = {
  id: generateId(),
  email: randomEmail(),
  name: randomString(),
  createdAt: timestamp(),
};

const config = createMockConfig({ PORT: 3000, DB_PATH: ':memory:' });
```

## Further Reading

- [../../TESTING_PATTERNS.md](../../TESTING_PATTERNS.md) - Comprehensive testing guide
- [../../TESTING.md](../../TESTING.md) - Test architecture
