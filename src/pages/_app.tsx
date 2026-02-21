import { ErrorBoundary, ErrorFallback } from '@app/components/ErrorBoundary';
import { ThemeProvider } from 'next-themes';
import type { AppProps } from 'next/app';
import '@app/styles/globals.css';

function MaintainarrApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
        <Component {...pageProps} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default MaintainarrApp;
