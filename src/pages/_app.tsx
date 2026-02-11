import { ErrorBoundary, ErrorFallback } from '@app/components/ErrorBoundary';
import type { AppProps } from 'next/app';
import '@app/styles/globals.css';

function MaintainarrApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}

export default MaintainarrApp;
