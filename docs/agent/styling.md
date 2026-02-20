# Agent Styling Context

## Design System Overview
Maintainarr uses a strict two-tone design system aimed at a clean, professional SaaS aesthetic. All AI-generated components MUST adhere to this system.

## Color Palette

### Primary (Action / Teal)
- `primary-light` / `teal-400` / `#14b8a6`: Hover states for primary buttons.
- `primary` / `teal-600` / `#0d9488`: Main buttons, active links, primary icons. (WCAG AA compliant on light backgrounds).
- `primary-dark` / `teal-700` / `#0f766e`: Pressed or active button states.

### Neutrals (Structure / Slate & Gray)
- `slate-950` (`#020617`): Primary headings, Dark mode background.
- `gray-900` (`#111827`): Dark mode surfaces/cards.
- `gray-600` (`#4b5563`): Secondary buttons, icons, sub-navigation.
- `gray-500` (`#6b7280`): Muted/helper text, placeholders.
- `gray-200` (`#e5e7eb`): Dividers, outlines.
- `gray-50` (`#f9fafb`): Light mode page background (The Floor).
- `bg-white`: Light mode cards (The Surface).

## The Surface Architecture
To create depth without heavy shadow clutter:
1. **Floor**: `bg-gray-50` (light) or `slate-950` (dark).
2. **Card/Surface**: `bg-white` (light) or `gray-900` (dark).
3. **Borders/Depth**: `border-gray-200` (light).

Do NOT use generic colors outside of this palette unless specifically requested. Avoid heavy box shadows; rely on surface contrast and borders (`border-gray-200`) to separate content.
