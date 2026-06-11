# Phase 2 — Unified Filter Engine

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 1 (so enriched predicates have data to read; predicate logic itself is
testable on seeded fixtures without Phase 1). Assumes the Phase 0 invariant (one active provider per
type), so `getMovies`/`getSeries` aggregation across active providers is effectively single-source.
**Blocks:** nothing downstream in this plan
**Status:** NOT STARTED

---

## What this phase is and why

The Media browse handler (`server/modules/media/media.handler.ts`) filters via
`server/utils/mediaFilters.ts` — a second engine whose `MovieFilterQuery`/`SeriesFilterQuery` never
declared `overseerr*`/`tmdbStatus`. The Zod schemas (`moviesQuerySchema`/`seriesQuerySchema`) strip
those params, so the filter bar's Overseerr/TMDB/enriched controls do nothing and every item is kept.

This phase makes the browse path reuse the canonical `filterRegistry` (decision **D2**), migrates
`watched` to the enrichment predicate (**D3**), threads enrichment in via a shared merge helper
(**D4**), and deletes the parallel engine. After this, "status === 1 with no matching data" correctly
returns **0 items** instead of keeping all.

---

## Files involved

### New files
| File | Purpose |
|---|---|
| `server/services/enrichmentMerge.ts` | Shared identity→enrichment merge (extracted from `AutomationExecutor.mergeEnrichment`); maps `media_enrichment` onto `Normalized*` items keyed by `sourceType`+`sourceId` |
| `server/__tests__/services/enrichmentMerge.test.ts` | Merge mapping, null-handling, missing-identity behaviour |

### Modified files
| File | Action |
|---|---|
| `server/modules/media/media.handler.ts` | Add `db` to cradle; normalize raw→`Normalized*`; merge enrichment; filter via `getFilterDef(...).apply`; map matched ids back to raw for the paginated response; extend Zod schemas with `overseerr*`/`tmdbStatus`/migrated `watched` and map browse param names → registry keys |
| `server/services/automationExecutor.ts` | Replace inline `mergeEnrichment` with the shared `enrichmentMerge` helper |
| `server/container.ts` | Provide `db` to the media handler cradle |

### Deleted files
| File | Reason |
|---|---|
| `server/utils/mediaFilters.ts` (+ test) | Replaced by `filterRegistry` |
| `server/utils/watchedTitleMatching.ts` (+ test) | `watched` now enrichment-based; only consumer was `media.handler` |

### Read first
| File | Why |
|---|---|
| `server/utils/filterRegistry.ts` | The predicates to delegate to; `getFilterDef(key, contentType)` |
| `server/services/automationExecutor.ts` (`mergeEnrichment`, `executeWithSources`) | The normalize → merge → filter → map-back-to-raw pattern to mirror exactly |
| `server/domain/movie.ts`, `server/domain/show.ts` + `normalizeRadarrMovie`/`normalizeSonarrSeries` | The normalize seam |
| `src/hooks/useMediaFilters.ts` | The exact param names the client sends (`overseerrHasIssue`, `overseerrRequestStatus`, `tmdbStatus`, `tautulliWatched`, `movieTagIds`, …) |

---

## Steps (TDD — one predicate/behaviour per cycle; pin BEFORE you swap)

### 2.0 — Pinning safety net (RED-as-characterization) — **do this first**
Before changing `media.handler`, write handler-level tests that capture **current** `listMovies`/
`listSeries` output for the predicates that have parity today (title, year, hasFile, tags, quality
profile, genres, added-days, size, certification, imdb/community rating, sort, pagination, yearRange,
errors). These must stay green across the swap. They are the divergence detector for the seam.

### 2.1 — Extract shared `enrichmentMerge`
Extract `AutomationExecutor.mergeEnrichment` into `server/services/enrichmentMerge.ts`; point the
executor at it. Existing executor tests stay green (pure refactor, no behaviour change).

### 2.2 — Browse handler normalizes + maps back to raw (no enriched filters yet)
RED: `listMovies` with existing predicates returns the same items as 2.0, but internally filters on
`Normalized*` and returns the corresponding raw items.
GREEN: normalize → `getFilterDef(...).apply` per active filter → map matched `_sourceIds` back to the
raw item for the response. Param-name mapping (`movieTagIds`→`tagIds`, etc.) lives here.

### 2.3 — Thread enrichment into the browse path
RED: with seeded `media_identity` + `media_enrichment`, the merged `Normalized*` items carry
`overseerrRequestStatus`/`overseerrHasIssue`/`tmdbStatus`/`playCount`/`lastWatchedAt`.
GREEN: handler builds the enrichment map via `enrichmentMerge` (needs `db` in cradle).

### 2.4 — Overseerr predicates filter (one cycle each)
RED: `overseerrRequestStatus=<n>` returns only items whose enriched status equals `<n>`; with **no**
enrichment data it returns **0** items (the corrected behaviour). Repeat for `overseerrHasIssue`.
GREEN: accept the params in the Zod schema; delegate to the registry.

### 2.5 — TMDB predicate filters
RED: `tmdbStatus=<s>` narrows to matching items; empty data → 0. GREEN: as above.

### 2.6 — Migrate `watched` to the enrichment predicate
RED: `tautulliWatched=true` returns items with enriched `playCount > 0`; `=false` the complement;
with no enrichment data, `=true` → 0. GREEN: map `tautulliWatched` to the registry `watched`
predicate; remove `fetchWatchedTitles` and the title-matching post-filter.

### 2.7 — Delete the dead engine
Remove `mediaFilters.ts` and `watchedTitleMatching.ts` (+ tests). Confirm no remaining imports
(`grep`). Full suite green.

---

## Verification gates (acceptance criteria)

- [ ] **Pinning tests (2.0) green before and after the swap** — no regression on parity predicates, sort, pagination, `yearRange`, or `errors` passthrough.
- [ ] An `overseerrRequestStatus` / `overseerrHasIssue` / `tmdbStatus` filter **narrows** the browse result when matching enrichment exists.
- [ ] The same filter with **no** enrichment data returns **0 items** (not "keeps all") — the behaviour originally expected.
- [ ] `tautulliWatched` reflects enriched `playCount`; documented as 0 until the Phase 1 pipeline has populated.
- [ ] `mediaFilters.ts` and `watchedTitleMatching.ts` no longer exist; nothing imports them.
- [ ] One enrichment-merge implementation exists; the executor and the browse handler both use it.
- [ ] `yarn vitest run --project server` green.
- [ ] Manual smoke (`/visual-playwright` or `yarn dev`): on the Media page, an Overseerr/TMDB filter visibly changes the grid; clearing it restores items. Stop any dev/ladle process afterward.

---

## Risks

- **Seam fidelity.** Normalization must preserve every field the parity predicates read (year, tags,
  genres, certification, statistics→size, ratings, added). 2.0's pinning tests are the guard; if a
  field is missing on `Normalized*`, the registry predicate silently changes results.
- **Behaviour change is intentional, not a bug.** Enriched predicates flip from "keep all" to
  "exclude on missing data." Call this out in the PR so it isn't "fixed" back.
- **Genre dataType.** Registry `genres` is typed `csv-ids` but compares strings; confirm parity with
  the browse `movieGenres`/`seriesGenres` csv-string handling.
