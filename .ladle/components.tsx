import type { GlobalProvider } from '@ladle/react';
import { useEffect, useState } from 'react';
import '../src/styles/globals.css';
import { worker } from '../tests/mocks/browser';

// Start the worker once at module level. Storing the promise lets us
// await it inside the Provider without re-starting it on every render.
const mswReady = worker.start({ onUnhandledRequest: 'bypass' });

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const [ready, setReady] = useState(false);
  const isDark = globalState.theme === 'dark';

  useEffect(() => {
    mswReady.then(() => setReady(true));
  }, []);

  // Hold off rendering stories until MSW is intercepting so the first
  // SWR / fetch fired by any story is guaranteed to be handled.
  if (!ready) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div
        className={`
          min-h-screen w-full
          ${isDark ? 'bg-surface-dark text-white' : 'bg-surface text-slate-950'}
        `}
      >
        {children}
      </div>
    </div>
  );
};
