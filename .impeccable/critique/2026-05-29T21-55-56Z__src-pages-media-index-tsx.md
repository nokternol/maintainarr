---
target: src/pages/media/index.tsx
total_score: 22
p0_count: 0
p1_count: 4
timestamp: 2026-05-29T21-55-56Z
slug: src-pages-media-index-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Tab counts and skeleton loading solid; infinite scroll progress invisible |
| 2 | Match System / Real World | 3 | Filter vocab is correct for audience; "Managed Media" title slightly clinical |
| 3 | User Control and Freedom | 2 | No way to dismiss selected card without clicking backdrop; no affordance that Escape works |
| 4 | Consistency and Standards | 2 | Mobile "Done" button uses `rounded-xl`; rest of system uses `rounded-sm`; Tab component lacks focus ring |
| 5 | Error Prevention | 2 | `nothingToShow` fires incorrectly when one tab has data; `activeFilterCount` counts cross-tab filters |
| 6 | Recognition Rather Than Recall | 3 | Filters visible and labeled; tab counts present; active states clear |
| 7 | Flexibility and Efficiency | 1 | No sort, no keyboard shortcuts, no batch actions |
| 8 | Aesthetic and Minimalist Design | 3 | Clean overall; mobile filter section headers violate uppercase-tracked-eyebrow ban |
| 9 | Error Recovery | 2 | RatingsPanel has retry; empty state gives no actionable link |
| 10 | Help and Documentation | 1 | No contextual help, no tooltips, no link from empty state |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** Not obviously AI-generated. Color system is coherent, component structure intentional, data density appropriate. No gradient text, no metric-hero cards, no cream background. However, the mobile filter sheet (MediaFilterBar/index.tsx:714, 757, 825, 844) uses `text-xs font-semibold uppercase tracking-wider text-text-muted` as section headers on every section — the exact uppercase-tracked-eyebrow absolute ban, four instances in one component.

**Deterministic scan:** Detector returned zero findings (`[]`). Uppercase tracking lives in className strings not raw CSS, below detector reach. No false positives.

**Browser visualization:** Dev server not running; fallback to static source review.

## Overall Impression

The skeleton is right: dark-first, teal-as-signal, dense filter bar, virtualized grid. The structural decisions are sound. The two largest problems are an accessibility violation that makes keyboard navigation actively broken (nested interactive elements), and a filter bar that ignores which tab is active. Fix those two and this page becomes usable; fix the remaining issues and it becomes good.

## What's Working

1. **Filter bar information density.** Two-row desktop layout grouping movie/series filters into tinted containers is clean. Visual grouping signals related items without extra headers. Year slider is a natural fit.
2. **Skeleton loading is properly scoped.** VirtualMediaGrid renders skeletons tied to actual column count for both initial load and isFetchingMore states. No layout shift, looks like real content.
3. **Mobile filter architecture.** Full-screen sheet over collapsed horizontal bar is correct for this filter density. Thumb-reachable Done button. Right approach, rough execution.

## Priority Issues

**[P1] Nested interactive elements — WCAG 4.1.2 violation**
- What: MediaPage wraps each card in `<button type="button">` (lines 329–352, 366–390). MediaCard.Root renders `<div role="button" tabIndex={0}>` with its own onKeyDown handler. Result: `<button>` containing `<div role="button">` — nested interactive elements.
- Why it matters: Keyboard users encounter two focusable targets per card. Screen readers announce two interactive elements for one action. VoiceOver and NVDA treat this as malformed markup.
- Fix: Remove `<button>` wrapper from the page; pass onClick directly to MediaCard — it already has the handler. Move key prop to MediaCard.
- Suggested command: /impeccable audit

**[P1] Filter bar is tab-unaware**
- What: MediaFilterBar renders all filters regardless of active tab. Desktop Row 1 shows movie filters, Row 2 shows series filters — both always visible. activeFilterCount counts cross-tab filters, inflating the mobile badge.
- Why it matters: User on Series tab applying "Downloaded/Missing" movie filter sees no grid change with no feedback about why. Mobile users see an inflated active filter count.
- Fix: Pass activeTab into MediaFilterBar; conditionally render tab-specific filter groups. Scope mobile sheet sections to the active tab.
- Suggested command: /impeccable harden

**[P1] Card selection dimming breaks browsing**
- What: When a card is selected, all other cards render at opacity-50 (lines 334, 370). The entire grid dims while RatingsPanel is open.
- Why it matters: This is browse-and-lookup. Users want to keep scanning the grid while the panel is open. The ring-2 ring-primary on the selected card already communicates selection — mass-dimming is redundant and destructive.
- Fix: Remove the `opacity-50` conditional entirely. Keep the ring on the selected card.
- Suggested command: /impeccable polish

**[P1] Mobile filter section headers violate absolute ban**
- What: MediaFilterBar/index.tsx lines 714, 757, 825, 844 render `text-xs font-semibold uppercase tracking-wider text-text-muted` headers on every section. Coincides with ChipGroup labels that often name the same thing.
- Why it matters: Absolute ban per design system. Creates redundant cognitive work (section header "Movies" + ChipGroup label "Movies:").
- Fix: Replace with `text-sm font-semibold text-text-secondary` labels. Drop uppercase and tracking-wider. Remove redundant ChipGroup label prefixes where section name duplicates them.
- Suggested command: /impeccable quieter

**[P2] `nothingToShow` misreports empty state**
- What: nothingToShow fires when both movies.items AND series.items are empty, regardless of active tab. User filtering "Anime" type in movies (0 results) while series exist sees "No media found. Configure providers in Settings."
- Why it matters: Tells users their setup is broken when it isn't.
- Fix: Compute per-tab empty states. Show the empty state inside the active tab's section only, and distinguish "no results for current filters" from "no provider configured."
- Suggested command: /impeccable harden

## Persona Red Flags

**Alex (Power User — self-hoster with 2000+ items):**
- No sort controls. Can't sort by title, year, or status. Browsing in API order.
- Keyboard navigation broken by nested interactive elements.
- No batch selection — 10 movies requires 10 individual panel opens.
- Opacity dimming prevents scan-and-plan while panel is open.

**Sam (Accessibility-Dependent User):**
- Nested button + div[role=button] is immediate WCAG 4.1.2 failure. Two tab stops per card.
- RatingsPanel has no focus trap. Tab escapes the panel into the dimmed grid behind it.
- MediaCard hover scale (hover:scale-[1.02]) has no prefers-reduced-motion override.
- Filter "Clear all" uses underline-only affordance — very low contrast for a clickable control.

**Morgan (Self-Hoster Power User — project-specific):**
- Runs Sonarr + Radarr + Tautulli, manages 3000+ items, uses Warden to identify subsets for rules.
- Filter bar tab-unawareness means Morgan can't build a clean movie filter, switch to series, and compare — switching tabs doesn't scope filters.
- Inflated activeFilterCount makes the badge meaningless.
- No "save filter as preset" path from this page to rule creation.

## Minor Observations

- sidebarItems hardcodes `active: true` on Media — won't survive router-driven active state.
- Mobile bottom nav uses `<a href>` tags, not router's Link — full page reloads on nav.
- RatingsPanel uses `<dialog open className="contents">` — the `contents` display removes the dialog from layout; a role="dialog" div with proper focus trap would be clearer.
- "Clear all" button in desktop filter bar is underline-only and positioned top-right — visually very quiet, easy to miss.
- countActiveFilters treats year range as 1 unit (correct UX, slightly surprising to read).

## Questions to Consider

- What happens when a user wants to act on a filtered result set? Is RatingsPanel the only action, or is there a planned "apply rule to this selection" path? That answer drives whether batch selection belongs here.
- Does the filter bar need both movie and series filters visible simultaneously, or should the active tab scope the visible filter groups?
- "Managed Media" title — is this user vocabulary, or is "Library" or "Browse" closer to how they name it?
