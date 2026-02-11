# Frontend (src/)

Next.js 15 frontend with React 18, TypeScript, and Tailwind CSS.

## Purpose

Provide a modern, type-safe frontend for Maintainarr with:
- Server-side rendering (SSR) via Next.js
- Component library with Ladle stories
- Dark theme design system
- Client-side API mocking with MSW

## Structure

```
src/
  components/      # React components (ui/, layout/)
  hooks/           # Custom React hooks
  pages/           # Next.js pages (routes)
  styles/          # Global styles and Tailwind config
  types/           # Shared frontend types
```

## Tech Stack

- **Next.js 15** - React framework with SSR
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **SWR** - Data fetching and caching
- **Ladle** - Component development (stories)
- **MSW** - API mocking for tests and development

## Development

```bash
yarn dev          # Start Next.js dev server (http://localhost:3000)
yarn ladle        # Start component explorer (http://localhost:61000)
yarn test         # Run component tests (Vitest)
```

## Testing

Client tests run in `happy-dom` environment (faster than jsdom):

```typescript
// src/components/Button/__tests__/Button.test.tsx
import { render, screen, setupUser } from '@tests/helpers/component';
import Button from '../index';

it('handles clicks', async () => {
  const user = setupUser();
  const onClick = vi.fn();

  render(<Button onClick={onClick}>Click me</Button>);

  await user.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledOnce();
});
```

MSW automatically mocks HTTP requests in tests.

## Further Reading

- [components/README.md](components/README.md) - Component organization
- [hooks/README.md](hooks/README.md) - Custom hooks
- [pages/README.md](pages/README.md) - Next.js routing
- [styles/README.md](styles/README.md) - Theme and styling
- [../TESTING.md](../TESTING.md) - Testing patterns
