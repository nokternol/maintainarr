---
target: src/pages/dashboard/index.tsx
total_score: 20
p0_count: 1
p1_count: 2
timestamp: 2026-05-29T21-39-43Z
slug: src-pages-dashboard-index-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No global health indicator; error only visible inside the table row |
| 2 | Match System / Real World | 3 | Terms are domain-appropriate; minor inconsistency in relative time formatting |
| 3 | User Control and Freedom | 1 | AutomationRow has cursor-pointer with no click handler; no drill-down, no "run now" |
| 4 | Consistency and Standards | 3 | Token discipline is strong; teal dot on RunItems is decorative (violates teal-as-signal) |
| 5 | Error Prevention | 2 | Error state is surfaced but resolution path is absent |
| 6 | Recognition Rather Than Recall | 3 | Query + task name visible on every row; Automations badge meaning not explained |
| 7 | Flexibility and Efficiency | 0 | No keyboard shortcuts, no row actions, no sort/filter, no bulk actions — fully read-only |
| 8 | Aesthetic and Minimalist Design | 3 | Clean dark surface; uppercase tracked column headers are the named anti-pattern |
| 9 | Error Recovery | 2 | Error message names the cause; no recovery action linked from the row |
| 10 | Help and Documentation | 1 | Empty-state copy is good; all guidance vanishes once automations are populated |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Not pure AI slop. The coordination between status signals in the error row (background tint + inline message + "Suspended" label) shows intentional thinking. The `queryName`/`taskName` sub-label in each row is a genuine recognition affordance. What is generic: the "two full-width outlined cards stacked vertically" skeleton is the first template a well-prompted AI produces, and the uppercase tracked column headers are an explicit anti-pattern called out in the design system. The teal primary dots in RunItems are decorative teal — the single voice rule violation that is easiest to miss and most corrosive over time.

**Deterministic scan:** Both `src/pages/dashboard/index.tsx` and `src/components/Card` came back clean (0 findings). The detector found no gradient text, side-stripe borders, eyebrows, numbered scaffolding, or broken images in these files.

**Visual overlays:** Dev server not running; browser injection not attempted.

## Overall Impression

The dashboard is competent but passive. It tells the user what exists (automations, recent runs) but does not tell them what to do, where to go when something breaks, or whether the system is healthy. The most critical failure is the dead row affordance — the entire table telegraphs interactivity and delivers nothing. Fix that first. Then address the error state recovery gap, because the most likely moment a user needs to trust Warden is precisely when something goes wrong.

## What's Working

1. **Coordinated error signaling.** The error automation uses background tint, inline `text-danger` message, and "Suspended" next-run as a three-signal system. None contradict the others, none overstate severity. This is careful, deliberate design.

2. **Recognition-oriented row subtitle.** Each row renders both `queryName` and `taskName` in the sub-label. A user returning after a week can immediately recall what each automation does without drilling in. This is exactly the right pattern for a rules-engine tool.

3. **Token discipline.** No raw hex values in the component. `text-danger`, `bg-surface-bg`, `border-border` — all semantic tokens, correctly applied. The teal ambient glow is delivered through CSS variables rather than JSX, which keeps the elevation system maintainable.

## Priority Issues

**[P0] AutomationRow has `cursor-pointer` and hover state but no click handler or navigation**
- **Why it matters:** The row looks interactive and does nothing. For a technical user who expects to drill into an error automation, investigate its run history, or navigate to an edit view, this is a dead end. The entire "inspect and manage" use case is blocked by a missing `onClick`/`href`.
- **Fix:** Either wire `onClick` to navigate to an automation detail route, or — if that route doesn't exist yet — remove `cursor-pointer` and `hover:bg-surface-bg` until the route is built. A promise of interactivity that fails on click is worse than no promise at all.
- **Suggested command:** `/impeccable shape` — design the automation detail/edit surface before the click lands somewhere.

**[P1] Error state has no recovery path**
- **Why it matters:** "Plex connection refused" is surfaced in the row but offers no next step. The user knows something is broken and has no agency. For a tool whose primary value is automation reliability, an error with no resolution path undermines the core product promise.
- **Fix:** Add a contextual action to the error row — at minimum, a text link to the relevant settings section ("Check connection →"). Consider a dismissible top-of-page error banner for system-level connection failures, separate from automation-level errors.
- **Suggested command:** `/impeccable harden` — error states and recovery paths across the dashboard.

**[P1] `+ New automation` is in the TopBar with no visual relationship to the automations table**
- **Why it matters:** The button floats in a global toolbar with no affordance connecting it to the table below. Standard product convention (Linear, Notion, Radarr) places the add-new action adjacent to the list it populates. The current placement suggests it was added as a quick shortcut rather than designed as an interaction.
- **Fix:** Move the button into the automations card's `Card.Header` on the right side, next to the active/error count summary. Remove it from the TopBar entirely, or reserve the TopBar for page-level actions that apply across the page (export, settings).
- **Suggested command:** `/impeccable layout` — restructure the card headers and action placement.

**[P2] Column headers use `uppercase tracking-wide` — the named anti-pattern**
- **Why it matters:** Four `text-xs font-medium text-text-muted uppercase tracking-wide` spans appear at lines 289–292. This exact pattern is in the design system's DO NOT list. It creates a generic "admin dashboard" feel with no functional benefit.
- **Fix:** Remove `uppercase` and `tracking-wide`. `text-xs text-text-muted` reads cleanly as a column label without the typographic treatment. The visual distinction between column header and cell content comes from weight and color, not case.
- **Suggested command:** `/impeccable polish` — sweep the uppercase/tracking pattern and the decorative teal dot below.

**[P2] Teal bullet dot on every `RunItem` is decorative teal — violates the single-voice rule**
- **Why it matters:** Line 236: `w-1.5 h-1.5 rounded-full bg-primary` on every run item as a static bullet. All runs use the same color regardless of outcome. Teal is designated for system activity signals only — here it is purely visual punctuation. Its rarity is its power; diluting it with decoration erodes the contrast between "system is speaking" and "this is wallpaper."
- **Fix:** Remove the dot. Use vertical spacing + the `border-b border-border` separator (already present) to separate list items. If a status indicator belongs here, key it to run outcome (green for success, red for failure).
- **Suggested command:** `/impeccable polish`.

## Persona Red Flags

**Alex (Power User — technical self-hoster, fluent in Tautulli/Sonarr):**
- Clicks "Purge low-rated series" error row expecting to see run history or a repair path. Nothing happens. Alex will click 2–3 more times, then navigate away and not trust the dashboard.
- No "run now" affordance anywhere. Testing a new automation after editing the filter requires waiting for the cron schedule to fire.
- The `1` badge on the Automations sidebar nav (visible but defined as `badge: 1` in the hardcoded mock) draws Alex toward an Automations page that presumably shows the same data. It is unclear whether the dashboard is a summary of that page or a duplicate of it.
- No keyboard path to any row action. `AutomationRow` is a `<div>` — not focusable, not navigable, not Tab-stoppable.

**Sam (Accessibility-Dependent — keyboard-only navigation, screen reader):**
- `AutomationRow` is a `<div>` with `cursor-pointer`. It is not focusable (`tabindex` absent) and not announced as interactive. Sam cannot reach, select, or activate any automation row with keyboard.
- `StatusDot` is `aria-hidden` but there is no text alternative conveying the status. Sam will hear "Archive stale movies, Movies > 2yr unwatched · Move to archive library" but will not hear "active" or "error." The automation status is invisible to screen readers.
- The automations table is rendered as nested `<div>` grids, not `<table>/<th>/<td>`. Sam's screen reader will not associate column headers with cell values and cannot navigate by column.
- `active` sidebar item likely lacks `aria-current="page"` — screen reader will not identify current location.

## Minor Observations

- `handleLogout` uses `fetch` + `window.location.href` with no loading state. A slow auth API response leaves the logout button unresponsive without feedback.
- `AutomationRow` passes inline `style={{ backgroundColor: 'rgba(220, 38, 38, 0.04)' }}` for error tint. This works but bypasses the token system for a semantic state. A `bg-danger/[0.04]` Tailwind opacity modifier or a `bg-danger-tint` CSS variable would be more consistent.
- `AUTOMATIONS` and `RECENT_RUNS` are module-scope constants — not behind a feature flag or env guard. If this page is ever imported in a server context without tree-shaking, the mock data travels with the bundle.
- `DashboardContent` is exported for stories but mock data is defined at module scope, not injected via props. The story cannot render alternate scenarios (all paused, empty, many errors) without modifying the module.
- The `COL_TEMPLATE = '1fr 160px 168px 88px'` grid has no responsive breakpoint. At narrow viewports, only the name column compresses while schedule/last-run/next-run columns hold their pixel widths, producing overflow on tablet and mobile.

## Questions to Consider

- **Is the dashboard the right mental model?** Warden's users need to know "what has my library actually done?" more than "what automations exist?" A timeline of library changes (what was deleted, what was updated, what ran and when) might serve the "was last night's run successful?" job-to-be-done better than a config table and a short run list.
- **What would the error state look like if it were designed for resolution, not just notification?** If the Plex connection is down, every automation will eventually fail. Should there be a system-level health banner above the table that persists until the connection is restored — separate from the per-automation error?
- **Does "Recent runs" earn its real estate?** The automations table already shows `lastRun` for each automation inline. The recent runs card duplicates that information in a different visual format without adding per-item detail. If you can't show which specific media items were affected, what is the feed for?
