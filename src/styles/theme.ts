// src/styles/theme.ts
export const themeColors = {
  // Base primitives
  teal: {
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
  },
  red: {
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  slate: {
    950: '#020617',
  },

  // Semantic Intention Classes (Driven by globals.css)
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    active: 'var(--color-primary-active)',
  },
  danger: {
    DEFAULT: 'var(--color-danger)',
    hover: 'var(--color-danger-hover)',
    active: 'var(--color-danger-active)',
  },
  surface: {
    bg: 'var(--color-surface-bg)',
    panel: 'var(--color-surface-panel)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
  },
  border: {
    DEFAULT: 'var(--color-border)',
  },
};
