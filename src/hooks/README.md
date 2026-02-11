# Custom Hooks

Reusable React hooks for common patterns.

## Purpose

Encapsulate reusable logic:
- Data fetching patterns
- Local state management
- Effect abstractions

## Convention

Hook files follow `use*.ts` naming:

```typescript
// hooks/useUserData.ts
import useSWR from 'swr';

export function useUserData(userId: number) {
  const { data, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher
  );

  return {
    user: data,
    isLoading,
    isError: error,
  };
}

// Usage in components
import { useUserData } from '@app/hooks/useUserData';

function UserProfile({ userId }: { userId: number }) {
  const { user, isLoading } = useUserData(userId);

  if (isLoading) return <LoadingSpinner />;
  return <div>{user?.name}</div>;
}
```

## Testing Hooks

Use `renderHook` from `@testing-library/react`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUserData } from './useUserData';

it('fetches user data', async () => {
  const { result } = renderHook(() => useUserData(1));

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.user).toEqual({ id: 1, name: 'John' });
});
```
