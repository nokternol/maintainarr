# Styles

Global styles, Tailwind configuration, and theme system.

## Purpose

Define visual styling:
- Tailwind CSS utility classes
- Dark theme color palette
- Global CSS variables and resets

## Files

```
styles/
  globals.css     # Global styles, CSS variables, Tailwind imports
```

## Theme

Dark theme with teal accent colors:

- **Background**: `surface-bg` (Very dark blue-gray in dark mode, light slate in light mode)
- **Surface**: `surface-panel` (Dark panel background in dark mode, white in light mode)
- **Primary**: `teal-600` (accent color)
- **Text**: `white` / `gray-400`

## Tailwind Usage

```typescript
// Utility classes
<div className="bg-surface-bg text-text-primary p-4 rounded-lg">
  <Button className="bg-teal-600 hover:bg-teal-700">
    Click me
  </Button>
</div>

// Custom surface colors (defined in tailwind.config.js)
<div className="bg-surface">         {/* gray-50 */}
<div className="dark:bg-surface-bg"> {/* slate.950 equivalent mapping */}
```

## Customizing Theme

Edit `tailwind.config.js` to change colors, spacing, fonts, etc.

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#0d9488',  // teal-600
      },
    },
  },
};
```
