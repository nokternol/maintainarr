# Filter-bar UI — intent (needs design before implementation)

**Status:** absorbed into **Phase 4** (`docs/in_progress/phase-4-client-query-alignment.md`). Both problems
below are solved for free by deriving the client controls from server `MediaRuleDescriptor`s: gating falls
out of each rule's `sourceProviders`, and the prop accumulation collapses to a single `onRuleChange`. Kept
for the problem detail; delete when Phase 4 ships. Verified against code 2026-06-13 (#2 grew during Phase 2).

## 1. Provider-gating for filter controls
`MediaFilterBar` renders every control regardless of which providers are active, so predicates that can never match are still shown (e.g. series `addedDaysAgo` when only Radarr is configured; overseerr/tmdb controls with no such provider). User explicitly requested gating.

**Fix:** suppress a control when its required provider isn't active. The server registry already declares `sourceProviders` per predicate (`server/utils/filterRegistry.ts`); surface that to the client and gate against the active-provider set. No gating code exists in `src/` today.

## 2. `MediaFilterBar` prop accumulation
`MediaFilterBarProps` (`src/components/MediaFilterBar/index.tsx`) passes `filterState` **plus ~33 explicit `setX` setters**, each threaded through the parent. Phase 2 added more (overseerr/tmdb/lastWatched/sonarr*), so this worsened.

**Fix:** collapse the setters to a single `onFilterChange(key: FilterKey, value) => void`, data-driven from the `FILTER_FIELDS` registry (`src/hooks/useMediaFilters.ts` already models state generically). Removes one prop site per future predicate.
