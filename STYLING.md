# UI Design System: Teal & Slate

## 🎨 Overview
This design system utilizes a **Teal** primary palette for actions and a **Gray/Slate** neutral palette for structural elements. It is designed to be clean, modern, and highly accessible, providing a professional "SaaS" aesthetic.

---

## 🛠 1. The Color Palette

### Primary (Action Color)
*Derived from Teal. Used to draw attention to interactive elements.*

| Level | Hex | Tailwind Utility | Use Case |
| :--- | :--- | :--- | :--- |
| **Light** | `#14b8a6` | `primary-light` | Hover states for primary buttons. |
| **Default** | `#0d9488` | `primary` | Main buttons, active links, primary icons. |
| **Dark** | `#0f766e` | `primary-dark` | Pressed or active button states. |

**Selection Logic:** `teal-600` was chosen as the base primary because it meets WCAG AA contrast requirements for text on light backgrounds, ensuring your app remains accessible while appearing vibrant.

### Neutrals (Foundation & Structure)
*Derived from Gray & Slate. Used for layout, borders, and text.*

| Level | Hex | Name | Use Case |
| :--- | :--- | :--- | :--- |
| **950** | `#020617` | `slate-950` | Primary Headings; Dark Mode Background. |
| **600** | `#4b5563` | `gray-600` | Secondary buttons; Icons; Sub-navigation. |
| **500** | `#6b7280` | `gray-500` | Muted/Helper text; Placeholders. |
| **200** | `#e5e7eb` | `gray-200` | Dividers; Input borders; Component outlines. |
| **50** | `#f9fafb` | `gray-50` | Light Mode Page Background. |

---

## 🏗 2. Understanding "Surfaces"
In this system, we use layering to create visual hierarchy.

* **The Floor (Background):** Use `bg-gray-50`. This is the lowest level of the UI.
* **The Card (Surface):** Use `bg-white`. Raising content onto a white surface makes it feel distinct and organized.
* **The Depth (Borders):** Use `border-gray-200`. This provides definition between surfaces without the clutter of heavy shadows.

---

## 🌙 3. Dark Mode Implementation
When Dark Mode is active, the roles of the neutrals invert:

1. **Background:** Switches to `slate-950` (#020617).
2. **Surface/Cards:** Switches to `gray-900` (#111827). This maintains the "lifted" feel because the card is slightly lighter than