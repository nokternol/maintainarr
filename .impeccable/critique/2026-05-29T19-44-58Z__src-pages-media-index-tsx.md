---
target: src/pages/media/index.tsx
total_score: 22
p0_count: 1
p1_count: 3
timestamp: 2026-05-29T19-44-58Z
slug: src-pages-media-index-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading skeletons exist; no global fetch indicator; filter-active state only shows count on mobile |
| 2 | Match System / Real World | 3 | Domain-appropriate language; "Tautulli Watched" filter label leaks internal service name to users |
| 3 | User Control and Freedom | 2 | Clear-all filter works; no undo anywhere; no way to deselect all cards without opening ratings panel first |
| 4 | Consistency and Standards | 2 | `bg-surface`, `bg-surface-hover`, `bg-background` tokens missing; dashboard TopBar CTA inline-styled; active chip text-color conflicts with Button component |
| 5 | Error Prevention | 2 | No destructive actions on media page (good); silent CSS failures mean state transitions break invisibly |
| 6 | Recognition Rather Than Recall | 3 | Sidebar always labeled; filter state visible; no tooltips anywhere; two dashboard nav items have blank icons |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; no batch actions; no sort controls; no accelerators of any kind |
| 8 | Aesthetic and Minimalist Design | 3 | Dark surface system is clean; dashboard is metric-hero territory; three sticky header rows before content begins |
| 9 | Error Recovery | 2 | No error states for fetch failures in media page; no retry path; RatingsPanel has loading but no error case |
| 10 | Help and Documentation | 1 | No contextual help, no tooltips, no onboarding; empty state copy is bare minimum |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Largely no AI slop at the structural level. The token architecture is above average. Where the reflex shows is on the dashboard (metric-hero StatCards, placeholder logo) and the sidebar's two blank icons. The bones are solid; the surface has unaddressed defaults.

**Deterministic scan:** Returned 0 findings. No gradient text, side-stripe borders, all-caps eyebrows, or numbered section scaffolding.

**Visual overlays:** No live server; browser injection not attempted.

## Overall Impression

The token architecture is genuinely strong. But the implementation has silent CSS failures that undermine polish. Fix those first. Then the dashboard needs to be rethought away from the metrics scaffold toward a task-control surface.

## What's Working

1. Design system pipeline — theme.ts → cssVarMap → Tailwind plugin is the right pattern. Teal glow shadow layers are properly calibrated.
2. MediaCard compound API — clean, composable, testable. Badge drop-shadow is a real craft detail.
3. Mobile filter UX — ChipGroup aria-pressed, 44px touch targets, bottom sheet pattern thoughtfully handled.

## Priority Issues

**[P0] `bg-surface` resolves to nothing — RatingsPanel is transparent**
- RatingsPanel/index.tsx:36 uses `bg-surface`. Token doesn't exist (`themeColors.surface` has subkeys bg/panel/elevated, no DEFAULT). Panel renders with transparent background.
- Fix: Change to `bg-surface-elevated`. Fix `hover:bg-background` on close button (line ~47) to `hover:bg-surface-bg`.

**[P1] `surface-hover` token used in 7 places but never defined**
- `hover:bg-surface-hover` in MediaFilterBar/index.tsx:76,136,160,227,251 and media/index.tsx:289,324. Generates no CSS. All hover backgrounds silently fail.
- Fix: Add `surfaceHover` to semanticTokens and cssVarMap; wire through themeColors.surface.

**[P1] Dashboard uses metric-hero template — prohibited by PRODUCT.md**
- Four StatCards with value/label/trend in 4-column grid. PRODUCT.md anti-references this exact pattern.
- Fix: Replace with rules-engine status view — active rules, last run results, upcoming scheduled runs.

**[P1] Two dashboard sidebar nav items have `icon: <div />`**
- dashboard/index.tsx: Media and Search nav items use empty div placeholders. Two nav items show blank icon space.
- Fix: Import or extract MediaIcon/SearchIcon from media/index.tsx.

**[P2] Three-row sticky header stacks before content begins**
- TopBar (~80px) + FilterBar (~56px) + tabs row (~44px) = ~180px chrome before first card. ~23% of 768px viewport.
- Fix: Collapse breadcrumbs into TopBar title row; colocate tab switcher in TopBar actions area.

## Persona Red Flags

**Alex (Power User):** No path from media page to rule creation — the core product primitive. No keyboard shortcuts. No sort controls. Active filter indicator absent on desktop.

**Sam (Accessibility-Dependent):** `aria-label="Icon"` on 9 navigational SVGs is meaningless to screen readers. Focus ring offset color doesn't match parent surface in TopBar and card contexts.

## Minor Observations

- "Maintainarr" vs "Warden" product name mismatch in logo text.
- Active chip uses `text-text-primary` on teal; Button uses `text-white` — inconsistent on light mode.
- Tab switcher uses `rounded-full` (badge shape) instead of `rounded-sm` (control shape).
- Dashboard `grid-cols-4` with no responsive handling — overflows on mobile.
- RatingsPanel has loading state but no error state for failed ratings fetch.
