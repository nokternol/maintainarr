const { themeColors, themeShadows, themeFonts, cssVarMap, cssVarMapDark } = require('./src/styles/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      colors: {
        ...themeColors,
      },
      fontFamily: {
        ...themeFonts,
      },
      borderRadius: {
        sm: 'var(--radius-sm)', // 4px — buttons, inputs, sidebar items
        lg: 'var(--radius-md)', // 8px — cards, panels (same value, now token-controlled)
      },
      boxShadow: {
        ...themeShadows,
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),

    // ─── Inject semantic CSS variables ────────────────────────────────────────
    // Single source of truth: theme.ts → cssVarMap / cssVarMapDark.
    // These are written into @layer base by Tailwind at build time so globals.css
    // never has to repeat a hex value.
    function ({ addBase }) {
      addBase({
        ':root': cssVarMap,
        '.dark': cssVarMapDark,
      });
    },
  ],
};
