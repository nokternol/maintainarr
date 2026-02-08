import type { GlobalProvider } from '@ladle/react';
import '../src/styles/globals.css';

export const Provider: GlobalProvider = ({ children }) => {
  return <div className="min-h-screen bg-gray-900">{children}</div>;
};
