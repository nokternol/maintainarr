import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.stories.tsx',
        '**/*.test.{ts,tsx}',
        'cypress/',
        '.next/',
        'dist/',
        'server/index.ts',
      ],
    },
    include: ['**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, './server'),
      '@app': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
