# Error Boundary

React error boundaries catch JavaScript errors in component trees and display fallback UI instead of crashing the entire app.

## Architecture

```
src/components/ErrorBoundary/
  ErrorBoundary.tsx        # Class component that catches errors
  ErrorFallback.tsx        # Reusable fallback UI
  ERROR_BOUNDARY.md        # This file
  __tests__/
    ErrorBoundary.test.tsx
```

## What Error Boundaries Catch

✅ **Catches:**
- Errors during rendering
- Errors in lifecycle methods
- Errors in constructors of child components

❌ **Does NOT catch:**
- Event handlers (use try/catch)
- Asynchronous code (setTimeout, promises)
- Server-side rendering errors
- Errors in the error boundary itself

## Usage

### App-Level Error Boundary (Default)

Already wired into `_app.tsx` to catch all React errors:

```typescript
// src/pages/_app.tsx
<ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
  <Component {...pageProps} />
</ErrorBoundary>
```

### Component-Level Error Boundary

Wrap specific components to isolate errors:

```typescript
import { ErrorBoundary } from '@app/components/ErrorBoundary';

function DashboardPage() {
  return (
    <div>
      <Header />

      {/* Isolate risky widget - error won't crash the page */}
      <ErrorBoundary>
        <ComplexWidget />
      </ErrorBoundary>

      <Footer />
    </div>
  );
}
```

### Custom Fallback UI

Provide custom error UI per boundary:

```typescript
<ErrorBoundary
  fallback={(error, reset) => (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <p className="text-red-800">Widget failed to load</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <Widget />
</ErrorBoundary>
```

### Error Logging Integration

Send errors to a logging service:

```typescript
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Send to logging service (Sentry, LogRocket, etc.)
    logErrorToService({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }}
>
  <App />
</ErrorBoundary>
```

## ErrorBoundary Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Components to wrap and protect |
| `fallback` | `(error: Error, reset: () => void) => ReactNode` | Custom fallback UI function |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | Callback when error is caught |

## ErrorFallback Component

Reusable error UI with sensible defaults:

```typescript
interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  title?: string;
  description?: string;
}
```

**Features:**
- Displays error title and description
- "Try again" button to reset error state
- "Go home" button to navigate to homepage
- Error details (dev only) in expandable section
- Styled to match app theme

## Error Recovery

The `reset()` function clears error state and re-renders children:

```typescript
<ErrorBoundary>
  <DataFetchingComponent />
</ErrorBoundary>
```

When user clicks "Try again":
1. Error boundary clears its error state
2. Child component re-renders from scratch
3. If the error condition is fixed (e.g., API is back up), component renders normally
4. If error persists, error boundary catches it again

## Development vs Production

**Development:**
- Shows full error message and stack trace
- Error details are expandable in fallback UI
- Console logs full error info

**Production:**
- Shows generic error message
- Hides stack traces from users
- Logs errors for monitoring (if `onError` configured)

## Best Practices

### 1. Multiple Boundaries for Granular Recovery

```typescript
<Layout>
  <ErrorBoundary> {/* Page-level */}
    <Dashboard>
      <ErrorBoundary> {/* Widget-level */}
        <ExpensiveChart />
      </ErrorBoundary>

      <ErrorBoundary>
        <DataTable />
      </ErrorBoundary>
    </Dashboard>
  </ErrorBoundary>
</Layout>
```

**Why:** If `ExpensiveChart` crashes, only that widget shows an error — the rest of the page stays functional.

### 2. Don't Overuse Error Boundaries

**❌ Bad** - Too granular:
```typescript
<ErrorBoundary><Button>Click me</Button></ErrorBoundary>
```

**✅ Good** - Logical boundaries:
```typescript
<ErrorBoundary><ComplexFeature /></ErrorBoundary>
```

### 3. Handle Async Errors Separately

Error boundaries don't catch async errors. Use try/catch:

```typescript
async function handleSubmit() {
  try {
    await api.submitForm(data);
  } catch (error) {
    setError(error);
  }
}
```

### 4. Event Handler Errors

Error boundaries don't catch event handler errors:

```typescript
function MyComponent() {
  const handleClick = () => {
    try {
      // This error won't be caught by error boundary
      throw new Error('Oops');
    } catch (error) {
      console.error(error);
      showToast('Something went wrong');
    }
  };

  return <button onClick={handleClick}>Click</button>;
}
```

## Testing Error Boundaries

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@app/components/ErrorBoundary';

function ThrowError() {
  throw new Error('Test error');
}

it('catches and displays errors', () => {
  // Suppress console.error in tests
  vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```

## Comparison with `_error.tsx`

| Feature | ErrorBoundary | _error.tsx |
|---------|---------------|------------|
| **Catches** | React component errors | Next.js routing/SSR errors |
| **Scope** | Component tree | Entire page |
| **Recovery** | Reset button re-renders | Page reload required |
| **When** | Client-side rendering | Server + client |

**Use both:**
- `_error.tsx` for page-level Next.js errors (404, 500, etc.)
- `ErrorBoundary` for React component errors within pages

## Future Enhancements

Potential improvements (not yet implemented):

1. **Error reporting service integration** (Sentry, Rollbar)
2. **Error rate limiting** (prevent infinite error loops)
3. **Automatic retry with exponential backoff**
4. **Error context** (capture user actions leading to error)
5. **Offline error queue** (sync errors when connection restored)

These can be added as needs arise.
