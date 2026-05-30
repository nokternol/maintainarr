---
target: src/pages/media/index.tsx
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-05-30T07-33-16Z
slug: src-pages-media-index-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton states and tab counts are solid; screen reader announcements for tab switches and RatingsPanel open events are missing |
| 2 | Match System / Real World | 3 | Domain language (Monitored, Quality Profiles, Sonarr/Radarr tags) matches the target audience well; "Managed Media" as page title is slightly abstract |
| 3 | User Control and Freedom | 3 | "Clear all" + per-filter "All" resets are present; mobile dialog lacks Escape key dismissal |
| 4 | Consistency and Standards | 2 | ARIA tab pattern is half-implemented; MediaCard lacks focus ring while Tabs component has one; two near-identical dropdown components share no base |
| 5 | Error Prevention | 2 | Year slider blocks handle crossing; mobile year number inputs do not prevent min > max; no year input range validation |
| 6 | Recognition Rather Than Recall | 3 | All filters visible at rest; dropdown active counts shown on triggers; tab item counts rendered |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no sort controls; no bulk card selection; no skip-to-content |
| 8 | Aesthetic and Minimalist Design | 3 | Poster grid is clean and focused; filter bar density is appropriate for the audience |
| 9 | Error Recovery | 2 | Empty states have recovery actions (Clear filters, Go to Settings); no error boundaries or failed-fetch states visible in component tree |
| 10 | Help and Documentation | 1 | No tooltips on filter controls; empty-state contextual guidance is the only help |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?**

**LLM assessment**: No glaring AI slop flags. The product slop test for this register — "would a user fluent in Linear, Figma, or Stripe pause at subtly-off components?" — catches a few friction points. The topbar tab placement is the most obvious tell: tabs that switch primary page content are tucked into an `actions` slot alongside the mobile filter button, which is an uncomfortable structural choice that a seasoned product designer would push back on. The filter bar grouping with `bg-surface-bg/40 rounded-lg` containers is subtle and functional. No cream backgrounds, no gradient text, no metric-hero cards. The overall dark surface language is coherent. This reads as a technically capable first pass with incomplete accessibility and some structural awkwardness, not as visual slop.

**Deterministic scan**: The `detect.mjs` run returned `[]` — zero findings across the five scanned files. No absolute bans triggered (no gradient text, side-stripe borders, identical card grids, or eyebrow headers detected).

**Visual overlays**: Browser visualization was not available for this run; no overlay injection was attempted.

---

## Overall Impression

Architecturally strong, accessibility half-done. The data layer is genuinely impressive: container-width virtualization, dwell-timer poster loading with IntersectionObserver abort, tab-scoped filter state — this is real craft. The UX falls short in two specific ways: the ARIA tab pattern is half-wired (tablist/tab present, tabpanel/aria-controls absent) and the MediaCard interactive div has no focus ring. Fix those two issues and the heuristic score clears 30.

The single biggest opportunity: the tabs belong between the TopBar and the filter bar, not inside the TopBar's `actions` slot. Moving them there gives the page a cleaner semantic structure and makes the tab-filter relationship visually explicit.

---

## What's Working

1. **VirtualMediaGrid is genuinely excellent.** Container-width column breakpoints (not viewport width, which correctly accounts for the 220px sidebar), row virtualization via `@tanstack/react-virtual` with an accurate `estimateSize`, and scroll container context propagation. This is production-quality virtual list implementation.

2. **MediaPoster's dwell + abort mechanism.** The 75ms dwell timer preventing requests for items that scroll past quickly, combined with the IntersectionObserver abort that cancels in-flight requests when items leave the viewport, is exactly the right architecture for a large media library. The thumbnail blur-up from TMDB w92 URLs is a solid progressive-loading touch. The test suite (42 tests covering cache-hit paths, IO abort, load-lock) is rigorous.

3. **Tab-aware filter bar.** The filter bar correctly scopes visible controls to the active tab (`hasMovieSection`, `hasSeriesSection`), so the series filter group disappears when the movies tab is active and vice versa. The skeleton states (full 48-card initial load, single-row incremental fetch row) are well-calibrated.

---

## Priority Issues

### [P1] ARIA tab pattern is half-implemented

**What**: The `Tabs` component correctly uses `role="tablist"` and `role="tab"` with `aria-selected`, but the content sections in `MediaContent` have no `role="tabpanel"`, no `id`, no `aria-labelledby`, and the tab buttons have no `aria-controls`. The ARIA tabs pattern requires all four: tablist, tabs, tabpanels, and the cross-referencing attributes.

**Why it matters**: Screen reader users switching tabs get no announcement that content changed. They cannot navigate to the tab's associated panel via AT keyboard commands (`aria-controls`). The ARIA pattern is structurally broken, not just incomplete.

**Fix**:
- Add `id` props to each tab button (`tab-movies`, `tab-series`).
- Add `role="tabpanel"`, `id` (`tabpanel-movies`, `tabpanel-series`), and `aria-labelledby` pointing to the controlling tab on each `<section>`.
- Add `aria-controls` on each tab button pointing to the panel id.
- The sections currently use `className={cn(activeTab !== 'movies' && 'hidden')}` (CSS `display:none`). This correctly hides inactive panels from AT — keep it, but add `tabIndex={0}` and a focus target on the active panel.

**Suggested command**: `/impeccable audit src/pages/media/index.tsx`

---

### [P1] MediaCard interactive div has no visible focus ring

**What**: The `div[role="button"]` in `MediaCard/index.tsx` Root component has no `focus-visible:ring-*` styling. The `.interactive` CSS class applies `hover:scale-[1.02]` and `active:scale[0.97]` but no focus-visible treatment. The outer `className` prop from the page applies `ring-2 ring-primary rounded-lg` only for the *selected* state, not the *focused* state.

**Why it matters**: Keyboard users tabbing through the media grid get no visible focus indicator — they cannot tell which card is focused. This fails WCAG 2.4.7 (Focus Visible, Level AA) and means the entire grid is inaccessible via keyboard navigation.

**Fix**: Add focus-visible styling to the `.interactive` class in `MediaCard.module.css`:
```css
.interactive:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```
Or equivalently via Tailwind on the Root component: add `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg` to the `cn(styles.card, ...)` call.

**Suggested command**: `/impeccable audit src/components/MediaCard/index.tsx`

---

### [P2] Tabs live in the TopBar `actions` slot — structural and semantic mismatch

**What**: The `<Tabs>` component that switches between Movies and Series — the primary page-level navigation — is passed as a prop to `TopBar`'s `actions` slot, placing it visually and semantically beside the mobile-only "Filters" button. On desktop, the topbar renders: "Managed Media" title on the left, and [Movies | Series tabs] + [Filters button] on the right. The tabs are not "actions" — they are the primary structural navigation of the page.

**Why it matters**: The relationship between the tab switch and the content below it (grid + filter bar) is spatially disconnected. The filter bar appears below the topbar but is scoped by the tabs above it — a user reading top-to-bottom must mentally connect them. A design director would place tabs as a dedicated surface between the topbar and the filter bar, where the connection is visually obvious.

**Fix**: Extract the `<Tabs>` out of `TopBar`'s `actions` prop and render it as a top-level row in `MediaContent` (or in the main content area between the TopBar and FilterBar). The TopBar actions can retain only the "Filters" button on mobile.

**Suggested command**: `/impeccable layout src/pages/media/index.tsx`

---

### [P2] MultiSelectDropdown ARIA pattern mismatch

**What**: `MultiSelectDropdown` and `StringMultiSelectDropdown` use `role="listbox"` + `aria-multiselectable="true"` on the dropdown container, but the items inside are `<label>` elements with `<input type="checkbox">` — not `role="option"` elements. Listbox semantics expect option roles; assistive technology using listbox keyboard navigation will fail to interact with the items correctly.

**Why it matters**: NVDA/VoiceOver users in listbox mode expect arrow-key navigation between `role="option"` items with `aria-selected`. What they get are checkboxes inside labels, which AT will announce as a form control list, not a listbox. The interaction model is inconsistent.

**Fix**: Either:
- (a) Remove `role="listbox"` and replace with `role="menu"` + `role="menuitemcheckbox"` with `aria-checked` on each item (better match for checkbox semantics), or
- (b) Keep `role="listbox"` but convert items to `role="option"` with `aria-selected` and handle selection via keyboard events (more work, less natural for checkbox multi-select).
Option (a) is the correct semantic choice for a multi-select dropdown with checkboxes.

**Suggested command**: `/impeccable audit src/components/MediaFilterBar/index.tsx`

---

### [P2] Mobile filter dialog: no focus trap, no Escape dismissal

**What**: When `mobileOpen` is true, the `fixed inset-0` filter modal renders but focus is not moved into it and not trapped within it. There is no `onKeyDown` handler for `Escape` to close the dialog.

**Why it matters**: Keyboard and AT users can Tab behind the modal to content that is visually hidden beneath it. A `role="dialog"` with `aria-modal="true"` implies focus is contained within — not implementing the trap makes the ARIA declaration a lie.

**Fix**: On dialog open, move focus to the first focusable element (the search input or the close button). Add a focus trap (either via a library like `focus-trap-react` or a manual implementation listening for Tab/Shift+Tab at boundaries). Add `onKeyDown={(e) => e.key === 'Escape' && onMobileClose?.()}` to the dialog element.

**Suggested command**: `/impeccable harden src/components/MediaFilterBar/index.tsx`

---

## Persona Red Flags

### Alex (Power User)

Alex opens the page, skips everything, and immediately tries to navigate via keyboard.

- **No keyboard shortcut to switch tabs.** The tab buttons accept Tab/Enter keyboard activation, but there's no arrow-key navigation between tabs (the ARIA tab pattern requires this). Alex expects Left/Right arrows to switch tabs.
- **No sort controls.** Alex can filter by downloaded/missing/monitored/genre but cannot sort by title, year, or status. Power users treat sort as essential — filter without sort is incomplete.
- **No skip-to-content link.** On a page with a sidebar + topbar + filter bar above the grid, tabbing to the first card requires traversing ~30 interactive elements first (sidebar nav items, topbar breadcrumb, tabs, filter controls). No skip mechanism exists.
- **Selecting a card opens a panel but the card gives no keyboard feedback.** Without a focus ring, Alex cannot confirm which card is focused before pressing Enter.

### Sam (Accessibility-Dependent User)

Sam navigates keyboard-only and relies on ARIA announcements.

- **MediaCard grid is effectively inaccessible.** No focus rings means no visible focus position. Each card is a `div[role="button"]` — in AT, it will be announced as "button" with the title as the accessible name (derived from child text). This works for names but not for navigation feedback.
- **Tab switching produces no screen reader announcement.** No `aria-live` region, no `tabpanel` role. Sam presses a tab button, hears nothing change, and cannot tell whether the content shifted.
- **Mobile filter dialog is a trap.** `role="dialog"` with `aria-modal="true"` declares the trap; the missing focus-trap implementation means Sam's AT expects containment but doesn't get it, causing unpredictable navigation.
- **MultiSelectDropdown ARIA mismatch.** Sam's screen reader enters listbox mode expecting option navigation; it encounters checkboxes instead. Most AT handles this gracefully by falling back to form control mode, but the listbox role declaration creates conflicting expectations.

### Warden Operator (Project-Specific Persona)

**Profile**: Expert self-hoster who has already configured Radarr, Sonarr, and Tautulli. Comes to the media page to audit specific library states (missing movies, unmonitored series) before creating a Warden filter rule. Goal is to visually confirm which items match their intended filter combination before building a rule.

**Behaviors**: Opens the page already knowing what they're looking for. Combines multiple filters quickly. Uses the result as a visual pre-check before creating rules elsewhere. Cares most about the filter → result feedback loop being fast.

**Red flags**:
- **No sort by status, year, or title** means the pre-check requires scrolling through the grid to build a mental model of what matched. Sorting by "Missing" first would confirm the filter instantly.
- **No way to select multiple cards and act on them.** The card selection opens a ratings panel for one item. The operator wants to see the group, not drill into individuals.
- **The connection between this page and the rules/filter model is invisible.** There is no "Create rule from these filters" affordance. The operator does the pre-check here and then has to recreate the same filter conditions manually in the rules page. A prominent secondary action would directly address this.

---

## Minor Observations

- **"Watched: All | Watched | Unwatched"** — the `ChipGroup label="Watched"` shows "Watched:" as a prefix before options that include "Watched". The prefix and one option share the same word. Use `hideLabel` and a section label, or rename the options to "Any / Watched / Unwatched".
- **"Clear all" absolute positioning in the desktop filter bar** — `absolute top-0 right-0` inside the filter bar's relative container. At narrow desktop widths where the filter chips wrap to three rows, the button could visually collide with the first-row content. Consider positioning it in a dedicated row or as a sticky element at the far end of row 1.
- **No `aria-label` on the MediaCard Root div.** The accessible name is computed from child text (title + year + badge text). This is functional but not ideal — the button is announced as "Oppenheimer 2023 Downloaded button" which includes the badge text in the name. An explicit `aria-label={title}` on the Root (or `aria-labelledby` pointing to the title element) would be cleaner.
- **Two near-identical dropdown components** (`MultiSelectDropdown` for `number[]`, `StringMultiSelectDropdown` for `string[]`) differ only in value type. A generic `MultiSelectDropdown<T>` would eliminate the duplication.
- **RatingsPanel open/close has no `aria-live` announcement.** When a card is selected and the panel opens, a screen reader user gets no feedback that a panel has appeared. Add an `aria-live="polite"` region or move focus into the panel on open.
- **`div[role="button"]` without `aria-label` on MediaCard** — the accessible name is derived from child content, which works, but explicit labeling is more robust.

---

## Questions to Consider

- **What would "pre-check → create rule" look like?** The media page is currently a viewer. If users come here to visually validate a filter combination before building a rule, what's the fastest path from "I found what I want" to "now I'll automate it"? Does a "Save as filter" or "Create rule from filters" button belong on this page?
- **Does the poster grid serve the operator's task?** Posters are rich and visual — but Warden operators are auditing library states, not browsing for something to watch. Would a hybrid view (grid + optional list/table toggle) better serve the "find the 47 missing Action movies from 2015-2020" workflow?
- **Is infinite scroll the right pagination model for filter-driven auditing?** Infinite scroll is great for browsing but poor for auditing a specific set. If filters return 230 results, the operator needs to know that number upfront and may want to jump to position 150. The current `totalCount` in the tabs is the right signal — should it appear more prominently?
