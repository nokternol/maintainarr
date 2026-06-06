# Phase 1 — Tier 1 Predicate Expansion

**Repo:** `/home/nokternol/repos/sandbox`  
**Prerequisite:** Phase 0b complete (IDs surfaced in ratings; confirms RatingsPanel is the graph probe)  
**Blocks:** Phase 2  
**Status:** COMPLETE (2026-06-05)

---

## What this phase is and why

Adds 5–8 new filter predicates to the existing flat `QueryFilters` model using fields already
present in Radarr/Sonarr API responses that Warden fetches but does not expose as filters.

No new API calls. No joins. No schema changes. The cost is: extend provider types, add filter
branches in `mediaFilters.ts`, add UI controls in `useMediaFilters.ts`.

The shortlist below comes from `INVENTORY.md` (Phase 0 output). All 8 are in the live Radarr/
Sonarr API response today — they just aren't mapped into the TypeScript types.

---

## Context window strategy

Each predicate is one TDD cycle. 8 predicates = 8 cycles. Do not attempt all 8 in one session.

**Session A (recommended):** Steps 1.1–1.4 (provider type extensions + server filter branches)  
**Session B:** Steps 1.5–1.6 (client `useMediaFilters` + UI controls)  
**Session C:** Step 1.7 (regression + integration verification)

After each session, commit. The test suite is the checkpoint — a passing suite means a clean
handoff to the next session.

Test runner: `yarn vitest run --project server`  
Client tests: `yarn vitest run --project client`

---

## Files involved

| File | Action |
|---|---|
| `server/providers/radarrProvider.ts` | Add fields to `RadarrMovie` type |
| `server/providers/sonarrProvider.ts` | Add fields to `SonarrSeries` type |
| `server/utils/mediaFilters.ts` | Add filter branches for each new predicate |
| `server/services/savedQueryService.ts` | `QueryFilters` interface — no change needed (it's a generic record) |
| `src/hooks/useMediaFilters.ts` | Add `FILTER_FIELDS` entries + setters for each new predicate |
| `server/__tests__/utils/mediaFilters.test.ts` | Extend with tests for each new branch |
| `server/__tests__/integration/media.filter.integration.test.ts` | Extend for integration coverage |

---

## Selected predicates (confirm final selection against `INVENTORY.md`)

| # | Predicate name | Provider field | Type | Operators | Computation |
|---|---|---|---|---|---|
| 1.1 | `addedDaysAgo` | `radarr.added` / `sonarr.added` | number | `gte`, `lte` | `Math.floor((now - Date.parse(added)) / 86400000)` |
| 1.2 | `sizeOnDiskGb` | `radarr.statistics.sizeOnDisk` / `sonarr.statistics.sizeOnDisk` | number | `gte`, `lte` | `bytes / 1_073_741_824` |
| 1.3 | `certification` | `radarr.certification` / `sonarr.certification` | string | `eq`, `in` | Direct string match (case-insensitive) |
| 1.4 | `radarrImdbRating` | `radarr.ratings.imdb.value` | number | `gte`, `lte` | Direct (0–10 scale) |
| 1.5 | `sonarrRating` | `sonarr.ratings.value` | number | `gte`, `lte` | Direct (0–10 scale) |
| 1.6 | `sonarrEnded` | `sonarr.ended` | boolean | `eq` | Direct boolean |
| 1.7 | `sonarrLastAiredDaysAgo` | `sonarr.previousAiring` | number | `gte`, `lte` | `Math.floor((now - Date.parse(previousAiring)) / 86400000)` |
| 1.8 | `sonarrPercentEpisodes` | `sonarr.statistics.percentOfEpisodes` | number | `gte`, `lte` | Direct (0–100) |

---

## Provider type extensions required

These fields are in the Radarr/Sonarr API responses today but not in the Warden types.
Add them before writing filter branches.

### `RadarrMovie` additions (`server/providers/radarrProvider.ts`)
```ts
added?: string;                    // ISO date — when added to Radarr
certification?: string;            // e.g. "15", "PG-13", "R"
ratings?: {
  imdb?: { value: number; votes: number; type: string };
  tmdb?: { value: number; votes: number; type: string };
  metacritic?: { value: number; votes: number; type: string };
  rottenTomatoes?: { value: number; votes: number; type: string };
  trakt?: { value: number; votes: number; type: string };
};
statistics?: {
  movieFileCount: number;
  sizeOnDisk: number;              // bytes
  releaseGroups: string[];
};
```

### `SonarrSeries` additions (`server/providers/sonarrProvider.ts`)
```ts
added?: string;                    // ISO date
certification?: string;
ended?: boolean;
previousAiring?: string;           // ISO date of most recent episode
ratings?: { votes: number; value: number };
statistics?: {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;              // bytes
  percentOfEpisodes: number;       // 0–100
};
// Also add join keys — present in live API response, not in current type:
tmdbId?: number;
imdbId?: string;
tvMazeId?: number;
```

---

## TDD cycles

### Step 1.1 — `addedDaysAgo` filter (movies and series)

**RED:** In `server/__tests__/utils/mediaFilters.test.ts`, add tests:
- Movie with `added: <91 days ago ISO>` matches `{ addedDaysAgo: { gte: 90 } }`
- Movie with `added: <10 days ago ISO>` does NOT match `{ addedDaysAgo: { gte: 90 } }`
- Movie with no `added` field is excluded from results when filter is active

**GREEN:**
1. Add `added?: string` to `RadarrMovie` and `SonarrSeries` types
2. Add to `MovieFilterQuery` and `SeriesFilterQuery`:
   ```ts
   addedDaysAgoGte?: number;
   addedDaysAgoLte?: number;
   ```
3. Add filter branches in `applyMovieFilters` and `applySeriesFilters`:
   ```ts
   if (query.addedDaysAgoGte !== undefined || query.addedDaysAgoLte !== undefined) {
     const now = Date.now();
     filtered = filtered.filter((m) => {
       if (!m.added) return false;
       const days = Math.floor((now - Date.parse(m.added)) / 86_400_000);
       if (query.addedDaysAgoGte !== undefined && days < query.addedDaysAgoGte) return false;
       if (query.addedDaysAgoLte !== undefined && days > query.addedDaysAgoLte) return false;
       return true;
     });
   }
   ```

**REFACTOR:** Note whether `addedDaysAgoGte` / `addedDaysAgoLte` naming is consistent with
other range predicates in the file (`yearMin` / `yearMax`). If inconsistent, pick one style
and apply it to all new predicates added in this phase.

---

### Step 1.2 — `sizeOnDiskGb` filter

**RED/GREEN/REFACTOR:** Same pattern as 1.1. Add `statistics?: { sizeOnDisk: number }` to
both types. Filter branch converts bytes to GB: `sizeOnDisk / 1_073_741_824`. Predicates:
`sizeOnDiskGbGte` and `sizeOnDiskGbLte`.

---

### Step 1.3 — `certification` filter

**RED/GREEN/REFACTOR:** Add `certification?: string` to both types. Filter: case-insensitive
string match or `in` array check. Predicate: `certification` (string, CSV for multiple values).
Use the existing `parseCsvStrings` helper already in `mediaFilters.ts`.

---

### Step 1.4 — `radarrImdbRating` filter (movies only)

**RED/GREEN/REFACTOR:** Add `ratings?: { imdb?: { value: number } }` to `RadarrMovie`. Filter
on `ratings.imdb.value`. Predicates: `radarrImdbRatingGte` / `radarrImdbRatingLte`. Items
with no `ratings.imdb` are excluded when filter is active.

---

### Step 1.5 — `sonarrRating` filter (series only)

**RED/GREEN/REFACTOR:** Add `ratings?: { value: number }` to `SonarrSeries`. Predicates:
`sonarrRatingGte` / `sonarrRatingLte`.

---

### Step 1.6 — `sonarrEnded` filter (series only)

**RED/GREEN/REFACTOR:** Add `ended?: boolean` to `SonarrSeries`. Predicate: `sonarrEnded`
(boolean). Map through existing `bool3` pattern in `useMediaFilters.ts`.

---

### Step 1.7 — `sonarrLastAiredDaysAgo` filter (series only)

**RED/GREEN/REFACTOR:** Add `previousAiring?: string` to `SonarrSeries`. Same days-ago
computation as `addedDaysAgo`. Predicates: `sonarrLastAiredDaysAgoGte` / `sonarrLastAiredDaysAgoLte`.
Items with no `previousAiring` are excluded when filter is active.

---

### Step 1.8 — `sonarrPercentEpisodes` filter (series only)

**RED/GREEN/REFACTOR:** Add `statistics?: { percentOfEpisodes: number }` to `SonarrSeries`.
Predicates: `sonarrPercentEpisodesGte` / `sonarrPercentEpisodesLte` (0–100).

---

## Client-side work (Session B)

After all server filter branches are green, add `FILTER_FIELDS` entries in
`src/hooks/useMediaFilters.ts` for each new predicate. Follow the existing pattern:
- Number predicates: `type: 'number'`
- Boolean predicates: `type: 'bool3'`
- String predicates: `type: 'string'`

Then add UI controls in the filter bar component. The exact component location can be found
by searching for where `hasFile` or `monitored` controls are rendered.

**Review for accumulation smell** before committing Session B: `FILTER_FIELDS` will have
grown by 8–10 entries. If the object has become unwieldy, consider grouping by provider
(movie-specific vs series-specific keys) and documenting the grouping with comments.

---

## Acceptance criteria

- All 8 predicates appear in `MovieFilterQuery` / `SeriesFilterQuery` and have working server branches
- All 8 predicates appear in `FILTER_FIELDS` in `useMediaFilters.ts` with correct types
- Filter bar displays controls for each new predicate in the appropriate tab (Movies / Series)
- All existing filter tests pass — no regressions
- No new tables, schema migrations, or API calls required
