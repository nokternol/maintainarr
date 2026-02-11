# Layout Components

Application layout structure and navigation.

## Purpose

Provide layout scaffolding:
- App shell with sidebar and top bar
- Responsive grid system
- Navigation components

## Components

| Component | Purpose |
|-----------|---------|
| `AppLayout` | Main app shell with sidebar and content area |
| `Sidebar` | Navigation sidebar with menu items |
| `TopBar` | Top navigation bar with branding and actions |
| `WidgetGrid` | Responsive grid for dashboard widgets |

## Usage

```typescript
import { AppLayout } from '@app/components/layout';

export default function MyPage() {
  return (
    <AppLayout>
      <h1>Page Content</h1>
    </AppLayout>
  );
}
```

`AppLayout` automatically includes `Sidebar` and `TopBar`.
