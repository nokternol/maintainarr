# Components

React components organized by category with co-located tests and stories.

## Purpose

Provide reusable UI components with:
- Co-located tests (`__tests__/`) and stories (`.stories.tsx`)
- Consistent dark theme styling
- Full TypeScript types
- Accessibility-first design

## Structure

```
components/
  ui/              # Primitive UI components (Button, Card, Badge, etc.)
  layout/          # Layout components (AppLayout, Sidebar, TopBar, etc.)
  ErrorBoundary/   # Error handling
  index.ts         # Barrel export
```

## Component Pattern

Every component follows this structure:

```
components/MyComponent/
  index.tsx                        # Component implementation
  MyComponent.stories.tsx          # Ladle stories
  __tests__/MyComponent.test.tsx   # Vitest tests
```

## Creating Components

```typescript
// components/MyComponent/index.tsx
import type { ReactNode } from 'react';

interface MyComponentProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export default function MyComponent({ children, variant = 'primary' }: MyComponentProps) {
  return (
    <div className={`my-component my-component--${variant}`}>
      {children}
    </div>
  );
}

// components/MyComponent/MyComponent.stories.tsx
import type { Story } from '@ladle/react';
import MyComponent from './index';

export const Primary: Story = () => <MyComponent variant="primary">Hello</MyComponent>;
export const Secondary: Story = () => <MyComponent variant="secondary">World</MyComponent>;

// components/MyComponent/__tests__/MyComponent.test.tsx
import { render, screen } from '@tests/helpers/component';
import MyComponent from '../index';

it('renders children', () => {
  render(<MyComponent>Hello</MyComponent>);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Barrel Export

Export components from `index.ts` for cleaner imports:

```typescript
// components/index.ts
export { default as Button } from './Button';
export { default as Card } from './ui/Card';
export { ErrorBoundary } from './ErrorBoundary';

// Usage
import { Button, Card, ErrorBoundary } from '@app/components';
```

## Further Reading

- [ui/README.md](ui/README.md) - UI primitives
- [layout/README.md](layout/README.md) - Layout system
- [ErrorBoundary/ERROR_BOUNDARY.md](ErrorBoundary/ERROR_BOUNDARY.md) - Error boundaries
- [../../TESTING_PATTERNS.md](../../TESTING_PATTERNS.md) - Component testing guide
