// src/styles/theme.ts
export const themeColors = {
  primary: {
        light: '#14b8a6',   // teal-500 (Best for Hovers)
        DEFAULT: '#0d9488', // teal-600 (Main Action)
        dark: '#0f766e',    // teal-700 (Pressed/Active)
    },
    secondary: {
        DEFAULT: '#4b5563', // gray-600
        dark: '#9ca3af',    // gray-400 (lighter for better dark mode contrast)
    },
    danger: {
        light: '#ef4444',   // red-500 (Best for Hovers)
        DEFAULT: '#dc2626', // red-600 (Main Action)
        dark: '#b91c1c',    // red-700 (Pressed/Active)
    },
    // Semantic surface colors
    surface: {
        light: '#ffffff',   // Pure white for cards in light mode
        DEFAULT: '#f9fafb', // gray-50 for backgrounds
        dark: '#020617',    // slate-950 for dark mode background
        panel: '#111827',   // gray-900 for dark mode cards
    },
    teal: {
        400: '#2dd4bf',     // trim
        500: '#14b8a6',     // hover (interaction)
        600: '#0d9488',     // base (default actions)
        700: '#0f766e',     // active (selected)
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
};