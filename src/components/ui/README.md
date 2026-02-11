# UI Components

Primitive UI building blocks styled for dark theme.

## Purpose

Provide reusable UI primitives:
- Buttons, badges, cards
- Icons, loading states, skeletons
- Empty states and stat cards
- Consistent styling with Tailwind

## Components

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, secondary, danger buttons with loading/disabled states |
| `Badge` | Status indicators (success, warning, error, info) |
| `Card` | Content containers with optional headers and footers |
| `Icon` | Lucide icons with consistent sizing |
| `LoadingSpinner` | Loading indicators with customizable sizes |
| `Skeleton` | Content placeholders for loading states |
| `StatCard` | Metric display cards with icons and trends |
| `EmptyState` | Empty state illustrations with actions |

## Usage

```typescript
import { Button, Card, Badge, LoadingSpinner } from '@app/components';

<Card header="User Profile">
  <Badge variant="success">Active</Badge>
  <Button variant="primary" loading={isLoading}>
    Save Changes
  </Button>
</Card>
```

All components have stories in Ladle (`yarn ladle`) and tests in `__tests__/`.
