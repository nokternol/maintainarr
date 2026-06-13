# Filter-bar UI — intent (needs design before implementation)

**Status:** unbuilt. Not part of the enriched-filters work; surfaced for a future phase (relevant before the Phase 4 combination-builder UI). Needs planning before any code. Two known problems, verified against code 2026-06-13 (#2 grew during Phase 2).

## 1. Provider-gating for filter controls
`MediaFilterBar` renders every control regardless of which providers are active, so predicates that can never match are still shown (e.g. series `addedDaysAgo` when only Radarr is configured; overseerr/tmdb controls with no such provider). User explicitly requested gating.

**Fix:** suppress a control when its required provider isn't active. The server registry already declares `sourceProviders` per predicate (`server/utils/filterRegistry.ts`); surface that to the client and gate against the active-provider set. No gating code exists in `src/` today.

## 2. `MediaFilterBar` prop accumulation
`MediaFilterBarProps` (`src/components/MediaFilterBar/index.tsx`) passes `filterState` **plus ~33 explicit `setX` setters**, each threaded through the parent. Phase 2 added more (overseerr/tmdb/lastWatched/sonarr*), so this worsened.

**Fix:** collapse the setters to a single `onFilterChange(key: FilterKey, value) => void`, data-driven from the `FILTER_FIELDS` registry (`src/hooks/useMediaFilters.ts` already models state generically). Removes one prop site per future predicate.
