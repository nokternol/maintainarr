import Button from '../Button';
import styles from './ErrorFallback.module.css';

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
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>

        {process.env.NODE_ENV === 'development' && (
          <details className={styles.details}>
            <summary className={styles.summary}>Error details (dev only)</summary>
            <pre className={styles.pre}>
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div className={styles.actions}>
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
