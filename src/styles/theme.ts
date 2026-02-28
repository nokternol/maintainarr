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

  // Internal section dividers (header/footer rules inside a card).
  // Must be visually distinct from the card surface.
  // In dark mode, surfacePanel = slate[800], so divider must step above it.
  borderDivider: palette.slate[200],
  borderDividerDark: palette.slate[700],

  // ── Primary RGB channels ──────────────────────────────────────────────────
  // Stored as an r,g,b triplet so shadow definitions can compose
  // rgba(var(--color-primary-glow), alpha) without duplicating the hex.
  // Must stay in sync with `primary` above.
  primaryGlow: '13, 148, 136', // teal[600]

  // ── Elevation shadows — light mode ───────────────────────────────────────
  shadowSm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 24px rgba(0,0,0,0.10)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.14)',

  // ── Card variant shadows — light mode (no teal glow) ─────────────────────
  shadowCardDefault: 'none',
  shadowCardOutlined: '0 1px 4px rgba(0,0,0,0.06)',
  shadowCardElevated: '0 4px 24px rgba(0,0,0,0.10)',

  // ── Card variant shadows — dark mode (teal ambient glow) ─────────────────
  // Opacities are calibrated against surfaceBgDark = slate[900] (#0f172a).
  // If the background shifts lighter again, increase these proportionally.
  shadowCardDefaultDark: [
    'inset 0 0 0 1px rgba(var(--color-primary-glow), 0.24)', // edge
    '0 0 0 1px rgba(var(--color-primary-glow), 0.08)', // outer ring
    '0 4px 24px rgba(var(--color-primary-glow), 0.10)', // ambient
    '0 1px 6px rgba(0,0,0,0.55)', // depth
  ].join(', '),
  shadowCardOutlinedDark: [
    'inset 0 0 0 1px rgba(var(--color-primary-glow), 0.18)', // edge
    '0 4px 24px rgba(var(--color-primary-glow), 0.08)', // ambient
    '0 1px 6px rgba(0,0,0,0.50)', // depth
  ].join(', '),
  shadowCardElevatedDark: [
    'inset 0 0 0 1px rgba(var(--color-primary-glow), 0.35)', // edge — stronger on lighter bg
    '0 0 0 1px rgba(var(--color-primary-glow), 0.14)', // outer ring
    '0 10px 48px rgba(var(--color-primary-glow), 0.16)', // wide ambient — key for lift
    '0 3px 12px rgba(0,0,0,0.70)', // deep drop — restores depth
  ].join(', '),

  // ── Card outlined dark border ─────────────────────────────────────────────
  borderCardOutlinedDark: 'rgba(var(--color-primary-glow), 0.25)',

  // ── Card glass highlight (dark only) ──────────────────────────────────────
  // Slightly brighter sheen to restore perceived surface lift on lighter bg.
  cardGlassHighlight: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%)',

  // ── Interaction states ────────────────────────────────────────────────────
  disabledOpacity: '0.4',
} as const;

// Convenience: CSS-var name → light value pairs consumed by globals.css codegen.
// You can import this in a script or just use it as reference when editing globals.css.
export const cssVarMap = {
  // ── Brand ────────────────────────────────────────────────────────────────
  '--color-primary': semanticTokens.primary,
  '--color-primary-hover': semanticTokens.primaryHover,
  '--color-primary-active': semanticTokens.primaryActive,
  // RGB triplet for rgba() shadow composition (tracks primary)
  '--color-primary-glow': semanticTokens.primaryGlow,

  // ── Danger ───────────────────────────────────────────────────────────────
  '--color-danger': semanticTokens.danger,
  '--color-danger-hover': semanticTokens.dangerHover,
  '--color-danger-active': semanticTokens.dangerActive,

  // ── Surface ──────────────────────────────────────────────────────────────
  '--color-surface-bg': semanticTokens.surfaceBg,
  '--color-surface-panel': semanticTokens.surfacePanel,

  // ── Text ─────────────────────────────────────────────────────────────────
  '--color-text-primary': semanticTokens.textPrimary,
  '--color-text-secondary': semanticTokens.textSecondary,
  '--color-text-muted': semanticTokens.textMuted,

  // ── Border ───────────────────────────────────────────────────────────────
  '--color-border': semanticTokens.border,
  '--color-divider': semanticTokens.borderDivider,
  '--color-border-card-outlined': semanticTokens.border,

  // ── Elevation shadows (light mode) ───────────────────────────────────────
  '--shadow-sm': semanticTokens.shadowSm,
  '--shadow-md': semanticTokens.shadowMd,
  '--shadow-lg': semanticTokens.shadowLg,

  // ── Card shadows (light mode) ─────────────────────────────────────────────
  '--shadow-card-default': semanticTokens.shadowCardDefault,
  '--shadow-card-outlined': semanticTokens.shadowCardOutlined,
  '--shadow-card-elevated': semanticTokens.shadowCardElevated,

  // ── Card glass highlight (none in light mode) ─────────────────────────────
  '--card-glass-highlight': 'none',

  // ── Interaction states ────────────────────────────────────────────────────
  '--state-disabled-opacity': semanticTokens.disabledOpacity,
} as const;

export const cssVarMapDark = {
  // ── Surface ──────────────────────────────────────────────────────────────
  '--color-surface-bg': semanticTokens.surfaceBgDark,
  '--color-surface-panel': semanticTokens.surfacePanelDark,

  // ── Text ─────────────────────────────────────────────────────────────────
  '--color-text-primary': semanticTokens.textPrimaryDark,
  '--color-text-secondary': semanticTokens.textSecondaryDark,
  '--color-text-muted': semanticTokens.textMutedDark,

  // ── Border ───────────────────────────────────────────────────────────────
  '--color-border': semanticTokens.borderDark,
  '--color-divider': semanticTokens.borderDividerDark,
  '--color-border-card-outlined': semanticTokens.borderCardOutlinedDark,

  // ── Card shadows (dark mode — teal glow via --color-primary-glow) ─────────
  '--shadow-card-default': semanticTokens.shadowCardDefaultDark,
  '--shadow-card-outlined': semanticTokens.shadowCardOutlinedDark,
  '--shadow-card-elevated': semanticTokens.shadowCardElevatedDark,

  // ── Card glass highlight ──────────────────────────────────────────────────
  '--card-glass-highlight': semanticTokens.cardGlassHighlight,
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
  divider: 'var(--color-divider)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3b — Tailwind shadow map
// Spread into tailwind.config.js `theme.extend.boxShadow`.
// Values reference CSS vars so they flip automatically between light/dark.
// ─────────────────────────────────────────────────────────────────────────────
export const themeShadows = {
  'elevation-sm': 'var(--shadow-sm)',
  'elevation-md': 'var(--shadow-md)',
  'elevation-lg': 'var(--shadow-lg)',
  card: 'var(--shadow-card-default)',
  'card-outlined': 'var(--shadow-card-outlined)',
  'card-elevated': 'var(--shadow-card-elevated)',
} as const;
