# Types

Shared TypeScript types for the frontend.

## Purpose

Centralize frontend type definitions:
- API response types
- Domain models
- Component prop types

## Convention

```typescript
// types/user.ts
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

// types/api.ts
export interface ApiResponse<T> {
  status: 'ok';
  data: T;
}

export interface ApiError {
  status: 'error';
  error: {
    type: string;
    message: string;
  };
}

// Usage in components
import type { User } from '@app/types/user';
import type { ApiResponse } from '@app/types/api';

function UserList({ users }: { users: User[] }) {
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

Types should mirror server API contracts where possible.
