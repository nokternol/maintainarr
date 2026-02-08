import type { AppProps } from 'next/app';
import '@app/styles/globals.css';

function MaintainarrApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MaintainarrApp;
