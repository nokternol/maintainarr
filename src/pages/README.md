# Pages

Next.js pages (routes) with file-based routing.

## Purpose

Define application routes using Next.js file-based routing:
- Pages map to URLs (e.g., `pages/users/[id].tsx` → `/users/123`)
- Special files (`_app.tsx`, `_document.tsx`) configure the app
- API routes in `pages/api/` (proxied to Express backend)

## Structure

```
pages/
  _app.tsx        # App wrapper (providers, global layout)
  _document.tsx   # HTML document structure
  index.tsx       # Homepage (/)
  about.tsx       # /about
  users/
    [id].tsx      # /users/:id (dynamic route)
```

## Page Example

```typescript
// pages/users/[id].tsx
import { useRouter } from 'next/router';
import { AppLayout } from '@app/components/layout';
import { useUserData } from '@app/hooks/useUserData';

export default function UserPage() {
  const router = useRouter();
  const userId = Number(router.query.id);
  const { user, isLoading } = useUserData(userId);

  return (
    <AppLayout>
      {isLoading ? <LoadingSpinner /> : <UserProfile user={user} />}
    </AppLayout>
  );
}
```

## Further Reading

- [Next.js Routing](https://nextjs.org/docs/routing/introduction)
- [../components/README.md](../components/README.md) - Layout components
