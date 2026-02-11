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

- **Background**: `slate-950` (very dark blue-gray)
- **Surface**: `slate-900` (dark panel background)
- **Primary**: `teal-600` (accent color)
- **Text**: `white` / `gray-400`

## Tailwind Usage

```typescript
// Utility classes
<div className="bg-slate-950 text-white p-4 rounded-lg">
  <Button className="bg-teal-600 hover:bg-teal-700">
    Click me
  </Button>
</div>

// Custom surface colors (defined in tailwind.config.js)
<div className="bg-surface">         {/* gray-50 */}
<div className="dark:bg-surface-dark"> {/* slate-950 */}
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
