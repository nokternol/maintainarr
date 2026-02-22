const { themeColors, cssVarMap, cssVarMapDark } = require('./src/styles/theme');

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
