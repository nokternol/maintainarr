import Button from '../Button';

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  title?: string;
  description?: string;
}

/**
 * Reusable error fallback UI component.
 * Can be used with ErrorBoundary or standalone for error states.
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. This has been logged and will be investigated.',
}: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-400 mb-2">{title}</h2>
        <p className="text-slate-400 text-sm mb-4">{description}</p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs text-red-300 bg-slate-950 p-2 rounded overflow-auto max-h-48">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          <Button onClick={reset} variant="primary" className="flex-1">
            Try again
          </Button>
          <Button
            onClick={() => {
              window.location.href = '/';
            }}
            variant="secondary"
            className="flex-1"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
