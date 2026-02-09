import type { GlobalProvider } from '@ladle/react';
import '../src/styles/globals.css';

export const Provider: GlobalProvider = ({ children, globalState }) => {
  const isDark = globalState.theme === 'dark';

  return (
    <div className={isDark ? 'dark' : ''}>
      <div
        className={`
          min-h-screen w-full p-12
          ${isDark ? 'bg-surface-dark text-white' : 'bg-surface text-slate-950'}
        `}
      >
        <div className="max-w-4xl mx-auto">{children}</div>
      </div>
    </div>
  );
};
