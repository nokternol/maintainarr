# Server Types

This directory holds shared TypeScript types and Express augmentations used across the server.

## API Response Envelope (`api.ts`)

Every API endpoint returns a consistent shape:

```typescript
// Success
{ status: 'ok', data: T }

// Error
{ status: 'error', error: { type: string, message: string, errors?: Record<string, string[]> } }
```

**Why:** Frontends can always check `response.status === 'ok'` vs `'error'` without guessing the shape. The `type` field is a machine-readable code (e.g., `NOT_FOUND`, `VALIDATION_ERROR`) that frontends should switch on — not the HTTP status code, since multiple error kinds can share the same code.

## Error Class Hierarchy (`../errors.ts`)

All application errors extend `AppError`:

| Class | Status | Type | When to use |
|-------|--------|------|-------------|
| `AppError` | 500 | `INTERNAL_ERROR` | Base class / generic server errors |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Bad input (carries `errors` field map) |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | No valid authentication |
| `ForbiddenError` | 403 | `FORBIDDEN` | Authenticated but insufficient permissions |
| `ConflictError` | 409 | `CONFLICT` | Duplicate resource or state conflict |

### `isOperational` Flag

- `true` (default): Expected errors — bad input, missing resources, permission denied. The app handles these gracefully.
- `false`: Programming bugs — null pointers, type errors, unhandled cases. The global error handler may choose to crash or alert differently for these.

### Adding a New Error Type

1. Create a new class extending `AppError` in `server/errors.ts`.
2. Set the appropriate HTTP status code and a unique `type` string.
3. Add a test in `server/__tests__/errors.test.ts`.
4. The global error handler (`server/middleware/errorHandler.ts`) will automatically handle it — no changes needed there.

## Express Augmentations (`express.d.ts`)

Type augmentations for Express's `Request` object (e.g., `req.requestId`). These are picked up automatically by TypeScript through the server tsconfig.
