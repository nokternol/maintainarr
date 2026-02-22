// src/styles/theme.ts
// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Primitive palette (single source of truth for raw hex values)
// Full 50–950 range. Every other layer references these by key, never by hex.
// ─────────────────────────────────────────────────────────────────────────────
export const palette = {
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    150: '#b2f5ea',
    200: '#99f6e4',
    250: '#72edda',
    300: '#5eead4',
    350: '#45e1c8',
    400: '#2dd4bf',
    450: '#1fc8b2',
    500: '#14b8a6',
    550: '#10a596',
    600: '#0d9488',
    650: '#0c8278',
    700: '#0f766e',
    750: '#0e6b64',
    800: '#115e59',
    850: '#0f524e',
    900: '#134e4a',
    950: '#042f2e',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    150: '#fecaca',
    200: '#fca5a5',
    250: '#f87474',
    300: '#fca5a5',
    350: '#f87171',
    400: '#f87171',
    450: '#f35f5f',
    500: '#ef4444',
    550: '#e53535',
    600: '#dc2626',
    650: '#cc2222',
    700: '#b91c1c',
    750: '#a81919',
    800: '#991b1b',
    850: '#8a1818',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    150: '#eaf0f6',
    200: '#e2e8f0',
    250: '#d4dde8',
    300: '#cbd5e1',
    350: '#b3bfcf',
    400: '#94a3b8',
    450: '#7d8fa3',
    500: '#64748b',
    550: '#566679',
    600: '#475569',
    650: '#3d4a5c',
    700: '#334155',
    750: '#2a3546',
    800: '#1e293b',
    850: '#172032',
    900: '#0f172a',
    950: '#020617',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    150: '#eaecf0',
    200: '#e5e7eb',
    250: '#d8dbe1',
    300: '#d1d5db',
    350: '#b8bdc7',
    400: '#9ca3af',
    450: '#838a96',
    500: '#6b7280',
    550: '#5a6270',
    600: '#4b5563',
    650: '#404855',
    700: '#374151',
    750: '#2d3644',
    800: '#1f2937',
    850: '#18202e',
    900: '#111827',
    950: '#030712',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Semantic token definitions
// Maps intent → primitive. This is the single place where you change "which
// shade of teal is primary" — everything else follows automatically.
// These are consumed by globals.css (via the exported cssVarMap) and by
// Tailwind (via the themeColors export below).
// ─────────────────────────────────────────────────────────────────────────────
export const semanticTokens = {
  // Primary brand
  primary: palette.teal[600],
  primaryHover: palette.teal[500],
  primaryActive: palette.teal[700],

  // Danger / destructive
  danger: palette.red[600],
  dangerHover: palette.red[500],
  dangerActive: palette.red[700],

  // Surface (light)
  surfaceBg: palette.slate[50],
  surfacePanel: palette.slate[150],

  // Surface (dark) — overridden in .dark via CSS vars
  surfaceBgDark: palette.slate[900],
  surfacePanelDark: palette.slate[800],

  // Text (light)
  textPrimary: palette.slate[900],
  textSecondary: palette.slate[600],
  textMuted: palette.slate[400],

  // Text (dark)
  textPrimaryDark: palette.slate[50],
  textSecondaryDark: palette.slate[300],
  textMutedDark: palette.slate[400],

  // Border (light / dark)
  border: palette.slate[200],
  borderDark: palette.slate[800],
} as const;

// Convenience: CSS-var name → light value pairs consumed by globals.css codegen.
// You can import this in a script or just use it as reference when editing globals.css.
export const cssVarMap = {
  '--color-primary': semanticTokens.primary,
  '--color-primary-hover': semanticTokens.primaryHover,
  '--color-primary-active': semanticTokens.primaryActive,

  '--color-danger': semanticTokens.danger,
  '--color-danger-hover': semanticTokens.dangerHover,
  '--color-danger-active': semanticTokens.dangerActive,

  '--color-surface-bg': semanticTokens.surfaceBg,
  '--color-surface-panel': semanticTokens.surfacePanel,

  '--color-text-primary': semanticTokens.textPrimary,
  '--color-text-secondary': semanticTokens.textSecondary,
  '--color-text-muted': semanticTokens.textMuted,

  '--color-border': semanticTokens.border,
} as const;

export const cssVarMapDark = {
  '--color-surface-bg': semanticTokens.surfaceBgDark,
  '--color-surface-panel': semanticTokens.surfacePanelDark,
  '--color-text-primary': semanticTokens.textPrimaryDark,
  '--color-text-secondary': semanticTokens.textSecondaryDark,
  '--color-text-muted': semanticTokens.textMutedDark,
  '--color-border': semanticTokens.borderDark,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — Tailwind color map
// Spread into tailwind.config.js `theme.extend.colors`.
// Semantic utilities (bg-surface-bg, text-primary …) point at CSS variables so
// they automatically flip between light/dark. Primitive utilities (bg-teal-500 …)
// are also available for one-off overrides.
// ─────────────────────────────────────────────────────────────────────────────
export const themeColors = {
  // Primitive scales (available as e.g. bg-teal-500, text-slate-900)
  teal: palette.teal,
  red: palette.red,
  slate: palette.slate,
  gray: palette.gray,

  // Semantic utilities (automatically theme-aware via CSS variables)
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
} as const;
