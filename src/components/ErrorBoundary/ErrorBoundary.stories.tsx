import type { Story } from '@ladle/react';
import { useState } from 'react';
import Button from '../Button';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

// Component that throws an error on demand
function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('This component intentionally crashed!');
  }
  return (
    <div className="p-8 bg-surface-panel rounded-lg">
      <h2 className="text-xl font-semibold text-green-400 mb-2">Component Working!</h2>
      <p className="text-text-muted">Everything is functioning normally.</p>
    </div>
  );
}

// Interactive demo with toggle
export const Interactive: Story = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  return (
    <div className="min-h-screen bg-surface-bg p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-surface-panel p-4 rounded-lg border border-border border">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Error Boundary Demo</h3>
          <p className="text-text-muted text-sm mb-4">
            Click the button to trigger an error in the component below. The ErrorBoundary will
            catch it and show a fallback UI instead of crashing the entire app.
          </p>
          <Button
            onClick={() => setShouldThrow(!shouldThrow)}
            variant={shouldThrow ? 'secondary' : 'danger'}
          >
            {shouldThrow ? 'Component is broken' : 'Trigger Error'}
          </Button>
        </div>

        <ErrorBoundary>
          <BuggyComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export const DefaultFallback: Story = () => (
  <ErrorBoundary>
    <BuggyComponent shouldThrow={true} />
  </ErrorBoundary>
);

export const WithErrorFallback: Story = () => (
  <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
    <BuggyComponent shouldThrow={true} />
  </ErrorBoundary>
);

export const CustomFallback: Story = () => (
  <ErrorBoundary
    fallback={(error, reset) => (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-orange-900/20 border border-orange-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-orange-400 mb-2">🔥 Custom Error Handler</h2>
          <p className="text-orange-200 text-sm mb-4">
            This is a completely custom error UI. You can style it however you want!
          </p>
          <details className="mb-4">
            <summary className="text-sm text-orange-300 cursor-pointer">Error message</summary>
            <pre className="mt-2 text-xs text-orange-100 bg-surface-bg p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
          <Button onClick={reset} variant="danger">
            Try again
          </Button>
        </div>
      </div>
    )}
  >
    <BuggyComponent shouldThrow={true} />
  </ErrorBoundary>
);

export const NestedBoundaries: Story = () => {
  function Widget({ id, shouldThrow }: { id: string; shouldThrow: boolean }) {
    if (shouldThrow) {
      throw new Error(`Widget ${id} crashed!`);
    }
    return (
      <div className="bg-surface-panel p-4 rounded border border-border border">
        <h3 className="text-text-primary font-medium">Widget {id}</h3>
        <p className="text-text-muted text-sm mt-1">Working normally</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bg p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-6">
          Dashboard with Isolated Error Boundaries
        </h2>
        <p className="text-text-muted mb-8">
          Each widget has its own ErrorBoundary. If one crashes, the others keep working.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <ErrorBoundary
            fallback={(_error, reset) => (
              <div className="bg-red-900/20 border border-red-700 p-4 rounded">
                <p className="text-red-400 font-medium text-sm">Widget crashed</p>
                <button
                  onClick={reset}
                  className="text-red-300 text-xs hover:text-red-200 mt-2"
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <Widget id="A" shouldThrow={false} />
          </ErrorBoundary>

          <ErrorBoundary
            fallback={(_error, reset) => (
              <div className="bg-red-900/20 border border-red-700 p-4 rounded">
                <p className="text-red-400 font-medium text-sm">Widget crashed</p>
                <button
                  onClick={reset}
                  className="text-red-300 text-xs hover:text-red-200 mt-2"
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <Widget id="B" shouldThrow={true} />
          </ErrorBoundary>

          <ErrorBoundary
            fallback={(_error, reset) => (
              <div className="bg-red-900/20 border border-red-700 p-4 rounded">
                <p className="text-red-400 font-medium text-sm">Widget crashed</p>
                <button
                  onClick={reset}
                  className="text-red-300 text-xs hover:text-red-200 mt-2"
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <Widget id="C" shouldThrow={false} />
          </ErrorBoundary>

          <ErrorBoundary
            fallback={(_error, reset) => (
              <div className="bg-red-900/20 border border-red-700 p-4 rounded">
                <p className="text-red-400 font-medium text-sm">Widget crashed</p>
                <button
                  onClick={reset}
                  className="text-red-300 text-xs hover:text-red-200 mt-2"
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <Widget id="D" shouldThrow={false} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export const WithErrorLogging: Story = () => {
  const [logs, setLogs] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-surface-bg p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-surface-panel p-4 rounded-lg border border-border border">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Error Logging Demo</h3>
          <p className="text-text-muted text-sm">
            The onError callback is triggered when an error is caught. In production, this would
            send errors to a logging service.
          </p>
        </div>

        <ErrorBoundary
          onError={(error, errorInfo) => {
            const timestamp = new Date().toISOString();
            setLogs((prev) => [
              ...prev,
              `[${timestamp}] ${error.message}`,
              `Stack: ${errorInfo.componentStack}`,
            ]);
          }}
        >
          <BuggyComponent shouldThrow={true} />
        </ErrorBoundary>

        {logs.length > 0 && (
          <div className="bg-surface-panel p-4 rounded-lg border border-border border">
            <h4 className="text-text-primary font-medium mb-2">Error Logs:</h4>
            <div className="space-y-1">
              {logs.map((log, i) => (
                <p key={i} className="text-xs text-text-muted font-mono">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
