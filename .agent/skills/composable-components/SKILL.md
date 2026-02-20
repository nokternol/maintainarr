---
name: composable-components
description: Guidelines for creating reusable, composable React components (e.g., MediaCard.Title).
---

# Composable Components

When building React components for Maintainarr, we prefer the Compound Component pattern for complex UI elements to maximize flexibility and reusability, coupled with CSS Modules for strict styling separation.

## Principles

1. **Avoid Prop Drilling**: Instead of passing dozens of props to a single monolithic component, break it down into smaller, focused sub-components.
2. **Dot Notation**: Export sub-components attached to the main component namespace (e.g., `MediaCard.Title`, `MediaCard.Poster`).
3. **Flexible Rendering**: Users of the component can choose whether to include parts like `Badge` or `Year` simply by rendering (or omitting) the sub-component.
4. **CSS Modules (No Inline Utility Colors)**: Components should use CSS modules for styling (`.module.css`). Reference your theme variables inside the CSS (using `@apply` or native CSS variables like `var(--color-primary)`) rather than using Tailwind color utilities directly in the JSX.
5. **No Global "ui" Folder**: Components should be housed in `src/components/`, named by their domain (e.g., `src/components/MediaCard/`). The `src/components/ui/` and `src/components/layout/` wrappers are deprecated.
6. **Ladle Sandbox Driven Development**: Always create a `.stories.tsx` file to demonstrate the usage, and critically, **always verify** the story visually in the browser (or run `yarn ladle:build`) to ensure it executes cleanly without CSS plugin crashes or circular dependencies.

## Example Structure

### 1. CSS Module (`MediaCard.module.css`)

```css
.card {
  /* Using @apply to hook into theme colors or layout if using Tailwind, 
     or just plain CSS with theme variables depending on project setup */
  @apply rounded-lg transition-transform duration-200;
  background-color: theme('colors.slate.900');
  /* Or if native variables are set up: background-color: var(--surface-bg); */
}

.cardInteractive {
  @apply cursor-pointer hover:scale-[1.02];
}

.title {
  /* No inline colors in JSX, defined here instead */
  color: theme('colors.slate.50');
  @apply text-sm font-medium line-clamp-1;
}
```

### 2. Component (`index.tsx`)

```tsx
import React, { createContext } from 'react';
import { cn } from '@app/lib/utils/cn';
import styles from './MediaCard.module.css';

// Context for shared state when needed
interface MediaCardContextType {
  id: string;
}
const MediaCardContext = createContext<MediaCardContextType | null>(null);

// Root Component
export interface MediaCardRootProps {
  id: string;
  children: React.ReactNode;
  onClick?: (id: string) => void;
  className?: string;
}

const Root = ({ id, children, onClick, className }: MediaCardRootProps) => {
  return (
    <MediaCardContext.Provider value={{ id }}>
      <div 
        className={cn(styles.card, onClick && styles.cardInteractive, className)}
        onClick={() => onClick?.(id)}
      >
        {children}
      </div>
    </MediaCardContext.Provider>
  );
};

// Sub-components
const Title = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h3 className={cn(styles.title, className)}>{children}</h3>;
};

// ... export as compound where the wrapper acts as the namespace
export const MediaCard = Object.assign(Root, {
  Title,
  // Poster, Badge, etc.
});

export default MediaCard;
```
