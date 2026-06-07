# Warden Query Model Rewrite

**Status:** IN PROGRESS — design complete, no implementation started  
**Supersedes:** `docs/intent/QUERIES_phase2c.md`  
**Blocks:** Phase 3 (combination queries), all further filter work  
**Priority:** Mission-critical — the current model has a confirmed live execution gap

---

## Why this document exists

The query and filter model evolved to solve a UI problem (let users select filter values) without fully solving the execution problem. As a result, three implicit assumptions are baked into production code but absent from the schema. These assumptions are breaking down as the system grows.

This document captures the complete intended model so a fresh session can implement it without rediscovering friction.

---

## Confirmed live gap (highest priority)

`tautulliWatched` is defined in `src/hooks/useMediaFilters.ts` (FILTER_FIELDS, labelled "Universal") and rendered in `src/lib/utils/filterSummary.ts`. Users can set it, save it in a query, and see it displayed.

**There is no server-side predicate for it.** It appears in neither `MovieFilterQuery` nor `SeriesFilterQuery` in `server/utils/mediaFilters.ts`. When an automation runs, this filter is silently ignored. Queries containing `tautulliWatched` produce incorrect results with no error.

This exists because client and server maintain independent, unsynchronised definitions of the filter schema.

---

## Current model: exact state

```
CLIENT                                  SERVER
──────────────────────────────────────  ──────────────────────────────────────
useMediaFilters.ts                      server/utils/mediaFilters.ts
  FILTER_FIELDS (35 keys)                 MovieFilterQuery  (~13 fields)
  ├─ Universal: title, year,              SeriesFilterQuery (~20 fields)
  │  tautulliWatched ← NO SERVER SIDE     applyMovieFilters()
  ├─ Shared: addedDaysAgoGte, size,       applySeriesFilters()
  ├─ Movie: hasFile, movieTagIds,
  │  radarrImdbRatingGte, …             server/database/schema.ts
  └─ Series: seriesStatus, sonarrEnded,   saved_queries { id, name,
             monitored, …                   filters TEXT,  ← JSON blob
                                             mediaType TEXT }  ← 'movie'|'series'
useSavedQueries.ts
  QueryFilters = FilterState             server/services/savedQueryService.ts
  SavedQuery { id, name,                   create({ name, filters, mediaType })
    filters: QueryFilters,               server/services/automationService.ts
    createdAt }                            compatibility: mediaType ↔ provider.type
  createQuery sends { name, filters }   server/services/automationExecutor.ts
  NOTE: does not send mediaType            if (query.mediaType === 'movie') { RADARR path }
        ← client/server gap              else { SONARR path }
```

Three structural assumptions baked into this code but absent from the schema:

1. **All filter fields for a query come from the same provider as the execution target.** Encoded by `mediaType` and two hardcoded branches. Cannot express a query that mixes RADARR fields with Tautulli fields.

2. **Filter field names are self-documenting.** `radarrImdbRatingGte` encodes its source by naming convention. There is no schema record that says this field requires RADARR. Renaming silently orphans stored queries.

3. **Client and server schema definitions are separate.** `FILTER_FIELDS` and `MovieFilterQuery` / `SeriesFilterQuery` drift independently. `tautulliWatched` is the current example.

---

## Core model decisions

### Decision 1: Content types are `movie` and `show` — not `RADARR` and `SONARR`

`movie` and `show` are content classifications. They define:
- The normalised domain type that filter predicates operate on
- The filter schema (which fields exist per content type)
- Which providers can supply data for that content type
- Which providers can receive action commands for that content type

RADARR and SONARR are providers that happen to be the primary library managers for movies and shows respectively. They are not the content type. PLEX manages both movies and shows. Tautulli provides watch data for both. A user with no RADARR may still have movie content in PLEX.

`saved_query.mediaType` is renamed to `saved_query.contentType` with values `'movie'` and `'show'`.

### Decision 2: Filter fields carry declared provenance

Every filter field is a named entity in a static code registry. The registry declares, per field:
- Which content types it applies to
- Which providers can supply its data
- Whether a supplying provider is required or optional for execution
- How to evaluate it against a normalised domain item (the predicate)

This registry is the single source of truth. The client derives its display metadata from it (via API or shared constants). The server uses it for validation and execution.

### Decision 3: Filter values are stored as rows, not a blob

`saved_query_filter_values { savedQueryId, filterKey, value }` replaces the `filters TEXT` column. One row per assigned filter value. `filterKey` is stable registry key. `value` is stored as TEXT; the registry's `dataType` governs coercion.

Field key stability is a contract: once a key is stored in rows, it cannot be renamed without a migration. Keys that encode provider names (`radarrImdbRatingGte`, `sonarrRatingGte`) are renamed as part of this migration.

### Decision 4: The query has no action provider — the automation does

`saved_query` declares content type and filter values. It does not reference a provider.

`automation` has `providerId` which is the **action provider** — the instance that receives task commands (unmonitor, delete, create collection). The automation is the binding that connects a query to an execution context.

### Decision 5: Compatibility validation moves to automation creation

When creating an automation, the action provider's content-type support must include the query's `contentType`. RADARR supports `movie`. SONARR supports `show`. PLEX supports both.

Additionally, for each filter key in the query: the registry's `sourceProviders` for that key must have at least one active configured provider. This is a **warning** at automation creation time (the provider may be added later), not a blocking error — unless the filter is marked `required`.

---

## The normalised domain types

These are what filter predicates operate on. They are assembled at execution time from whatever providers are active. Missing provider = field is `undefined`.

```ts
// server/domain/movie.ts
export interface NormalizedMovie {
  _sourceIds: {
    radarr?: number
    plex?: string
    tmdb?: number
    imdb?: string
  }

  // Core (any movie source)
  title: string
  year?: number

  // Library management — RADARR primary, PLEX fallback
  hasFile?: boolean
  monitored?: boolean
  qualityProfileId?: number
  tags?: number[]
  genres?: string[]
  addedDate?: string
  sizeOnDiskBytes?: number
  certification?: string

  // Ratings — RADARR (embedded), TMDB, OMDB
  imdbRating?: number
  tmdbRating?: number

  // Watch history — TAUTULLI or PLEX
  playCount?: number
  lastWatchedAt?: string
}

// server/domain/show.ts
export interface NormalizedShow {
  _sourceIds: {
    sonarr?: number
    plex?: string
    tmdb?: number
    tvdb?: number
    tvmaze?: number
  }

  // Core (any show source)
  title: string
  year?: number

  // Library management — SONARR primary, PLEX fallback
  hasFile?: boolean
  monitored?: boolean
  qualityProfileId?: number
  tags?: number[]
  genres?: string[]
  addedDate?: string
  sizeOnDiskBytes?: number
  certification?: string
  seriesType?: 'standard' | 'daily' | 'anime'
  network?: string

  // Series state — SONARR
  status?: 'continuing' | 'ended' | 'upcoming'
  ended?: boolean
  episodePercentage?: number
  lastAiredAt?: string

  // Ratings — SONARR (embedded), TMDB, TVMAZE
  communityRating?: number

  // Watch history — TAUTULLI or PLEX
  playCount?: number
  lastWatchedAt?: string
}
```

---

## The filter registry

```ts
// server/utils/filterRegistry.ts

export type FilterValue = string | number | boolean

export interface FilterDefinition<T extends NormalizedMovie | NormalizedShow> {
  key: string
  label: string
  contentTypes: ContentType[]           // 'movie' | 'show' | both
  dataType: 'boolean' | 'number' | 'string' | 'csv-ids'
  sourceProviders: MetadataProviderType[]
  // required: if true and no sourceProvider is active, execution records an error
  // if false and no sourceProvider is active, filter is skipped with a warning
  required: boolean
  apply: (item: T, value: FilterValue) => boolean
}
```

**Complete registry — current fields, renamed where provider-encoded:**

| Old key | New key | Content | Source providers | Required |
|---|---|---|---|---|
| `title` | `title` | both | RADARR, SONARR, PLEX | no |
| `yearMin` | `yearMin` | both | RADARR, SONARR, PLEX, TMDB | no |
| `yearMax` | `yearMax` | both | RADARR, SONARR, PLEX, TMDB | no |
| `tautulliWatched` | `watched` | both | TAUTULLI, PLEX | no |
| `addedDaysAgoGte` | `addedDaysAgoGte` | both | RADARR, SONARR, PLEX | no |
| `addedDaysAgoLte` | `addedDaysAgoLte` | both | RADARR, SONARR, PLEX | no |
| `sizeOnDiskGbGte` | `sizeOnDiskGbGte` | both | RADARR, SONARR | no |
| `sizeOnDiskGbLte` | `sizeOnDiskGbLte` | both | RADARR, SONARR | no |
| `certification` | `certification` | both | RADARR, SONARR, TMDB, OMDB | no |
| `hasFile` | `hasFile` | both | RADARR (movie), SONARR (show), PLEX | no |
| `movieTagIds` | `tagIds` | movie | RADARR | no |
| `movieQualityProfileIds` | `qualityProfileIds` | movie | RADARR | no |
| `movieGenres` | `genres` | movie | RADARR, TMDB | no |
| `radarrImdbRatingGte` | `imdbRatingGte` | movie | RADARR, OMDB | no |
| `radarrImdbRatingLte` | `imdbRatingLte` | movie | RADARR, OMDB | no |
| `monitored` | `monitored` | show | SONARR | no |
| `seriesStatus` | `seriesStatus` | show | SONARR | no |
| `seriesTagIds` | `tagIds` | show | SONARR | no |
| `seriesQualityProfileIds` | `qualityProfileIds` | show | SONARR | no |
| `seriesGenres` | `genres` | show | SONARR, TMDB | no |
| `seriesType` | `seriesType` | show | SONARR | no |
| `network` | `network` | show | SONARR, TVMAZE | no |
| `sonarrRatingGte` | `communityRatingGte` | show | SONARR, TMDB | no |
| `sonarrRatingLte` | `communityRatingLte` | show | SONARR, TMDB | no |
| `sonarrEnded` | `ended` | show | SONARR | no |
| `sonarrLastAiredDaysAgoGte` | `lastAiredDaysAgoGte` | show | SONARR | no |
| `sonarrLastAiredDaysAgoLte` | `lastAiredDaysAgoLte` | show | SONARR | no |
| `sonarrPercentEpisodesGte` | `episodePercentageGte` | show | SONARR | no |
| `sonarrPercentEpisodesLte` | `episodePercentageLte` | show | SONARR | no |

Note: `tagIds` and `qualityProfileIds` and `genres` appear for both movie and show content types with different `sourceProviders`. These are separate registry entries with `contentTypes: ['movie']` vs `contentTypes: ['show']`. The key is the same but the entry is distinct by content type. Implementation: lookup by `(key, contentType)`.

Sort fields (`movieSort`, `seriesSort`) are NOT filter fields. They are UI state, never stored in a query.

---

## Database schema changes

```sql
-- 0007_query_model_rewrite.sql

-- Step 1: rename mediaType → contentType, remap values
ALTER TABLE `saved_queries` RENAME COLUMN `mediaType` TO `contentType`;
UPDATE `saved_queries` SET `contentType` = 'movie' WHERE `contentType` = 'movie'; -- already correct
UPDATE `saved_queries` SET `contentType` = 'show' WHERE `contentType` = 'series';

-- Step 2: new filter values table
CREATE TABLE `saved_query_filter_values` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `savedQueryId` INTEGER NOT NULL REFERENCES `saved_queries`(`id`) ON DELETE CASCADE,
  `filterKey` TEXT NOT NULL,
  `value` TEXT NOT NULL
);
CREATE INDEX `IDX_sqfv_queryId` ON `saved_query_filter_values`(`savedQueryId`);

-- Step 3: migrate existing blobs into rows, with key renames
-- This must handle the key rename table above.
-- Keys that are renamed: tautulliWatched→watched, movieTagIds→tagIds,
-- movieQualityProfileIds→qualityProfileIds, movieGenres→genres,
-- radarrImdbRatingGte→imdbRatingGte, radarrImdbRatingLte→imdbRatingLte,
-- seriesTagIds→tagIds, seriesQualityProfileIds→qualityProfileIds,
-- seriesGenres→genres, sonarrRatingGte→communityRatingGte,
-- sonarrRatingLte→communityRatingLte, sonarrEnded→ended,
-- sonarrLastAiredDaysAgoGte→lastAiredDaysAgoGte,
-- sonarrLastAiredDaysAgoLte→lastAiredDaysAgoLte,
-- sonarrPercentEpisodesGte→episodePercentageGte,
-- sonarrPercentEpisodesLte→episodePercentageLte
-- NOTE: blob extraction must be done in the migration script using JSON functions
-- or a one-shot migration helper, not raw SQL alone.

-- Step 4: drop the filters blob column
-- (After migration verification)
ALTER TABLE `saved_queries` DROP COLUMN `filters`;
```

---

## Service layer changes

### `SavedQueryService`

```ts
interface FilterValue {
  key: string
  value: string | number | boolean
}

interface SavedQueryDraft {
  name: string
  contentType: 'movie' | 'show'
  filterValues: FilterValue[]
}

interface QueryHealth {
  status: 'healthy' | 'degraded' | 'unavailable'
  providerStatus: {
    providerType: MetadataProviderType
    required: boolean
    configured: boolean
    affectedFilterKeys: string[]
  }[]
}

interface SavedQueryDto {
  id: number
  name: string
  contentType: 'movie' | 'show'
  filterValues: FilterValue[]
  health: QueryHealth
  createdAt: string
}
```

`create()` validates:
- Each `filterKey` exists in the registry for the given `contentType`
- Each `value` is coercible to the registry's `dataType`

`list()` joins `saved_query_filter_values` and computes health against active providers.

### `AutomationService.create()`

Validation:
1. Action provider's content type support includes `query.contentType`
2. For each filter key in the query: registry entry for `(key, contentType)` exists — this should always pass if the query was created validly, but is a safety check
3. Emit a health warning (not error) if any non-required source provider is unconfigured

Content-type-to-provider-type mapping:
```ts
const CONTENT_TYPE_PROVIDERS: Record<ContentType, MetadataProviderType[]> = {
  movie: [MetadataProviderType.RADARR, MetadataProviderType.PLEX, MetadataProviderType.JELLYFIN],
  show:  [MetadataProviderType.SONARR, MetadataProviderType.PLEX, MetadataProviderType.JELLYFIN],
}
// automation.provider.type must be in CONTENT_TYPE_PROVIDERS[query.contentType]
```

### `AutomationExecutor`

```
execute(automationId):
  1. Load automation → { actionProviderId, queryId, taskId }
  2. Load query → { contentType: 'movie', filterValues: [{key, value}, ...] }
  3. Resolve required source providers from filter registry
  4. Load action provider settings
  5. For each unique sourceProvider needed:
       instance = providerSettingsService.findActiveByType(providerType)
       if !instance && filter.required → record error, abort
       if !instance && !filter.required → mark filter as skipped
  6. Fetch base item list from action provider
     → NormalizedMovie[] or NormalizedShow[]
  7. For each additional source provider (enrichment):
       fetch data, merge fields onto base items
  8. Apply filter predicates:
       for each filterValue (skipping ones whose provider is unavailable):
         def = registry.get(filterValue.key, contentType)
         items = items.filter(item => def.apply(item, filterValue.value))
  9. Execute task(actionProvider, matched item IDs)
  10. Record result: itemCount, status, skippedFilters[]
```

---

## Query health model

Health is computed at list time — not cached — by joining active providers against filter requirements.

```
healthy:     all filters have at least one active source provider
degraded:    some optional filters have no active source provider (will be skipped)
unavailable: at least one required filter has no active source provider (cannot run)
```

Health is returned on `SavedQueryDto` and also on `AutomationDto` (which combines query health with action provider availability).

**Provider provenance (reverse correlation):**

Given an event "provider X went offline or was removed":
1. Load all saved queries
2. For each query, compute which filter keys have `sourceProviders` containing X
3. Report: affected query IDs + affected filter keys
4. Queries that become `unavailable` vs `degraded`

This enables: pre-removal warnings in the settings UI, automation health status, and monitoring.

---

## Client changes

### `FILTER_FIELDS` → derived from registry API

Current: `FILTER_FIELDS` in `useMediaFilters.ts` is a manually maintained static list.  
Future: `GET /api/filter-fields?contentType=movie|show` returns the display-safe subset:

```ts
interface FilterFieldMeta {
  key: string
  label: string
  dataType: 'boolean' | 'number' | 'string' | 'csv-ids'
  contentTypes: ContentType[]
}
```

The client uses this to build filter UIs dynamically. Sort fields (`movieSort`, `seriesSort`) remain as UI-only state, never sent to the server.

Until the API endpoint exists, `FILTER_FIELDS` can be updated in-place with the new key names and categories. The structural gap between client and server is closed by using the registry as the single source of truth.

### `useSavedQueries.ts`

```ts
export interface SavedQuery {
  id: number
  name: string
  contentType: 'movie' | 'show'
  filterValues: { key: string; value: FilterValue }[]
  health: QueryHealth
  createdAt: string
}

// createQuery sends:
{ name: string, contentType: 'movie' | 'show', filterValues: FilterValue[] }
```

### `filterSummary.ts`

Iterates `filterValues` and looks up each key in the client-side field metadata (from `FILTER_FIELDS` or the API). Uses `label` from the registry. No more hardcoded key-to-label mapping.

```ts
export function summarizeFilters(
  filterValues: { key: string; value: FilterValue }[],
  fieldMeta: Record<string, FilterFieldMeta>
): string[] {
  return filterValues.map(({ key, value }) => {
    const meta = fieldMeta[key]
    if (!meta) return `${key}=${value}`
    return formatValue(meta, value)
  })
}
```

---

## Complete affected file inventory

### New files (server)
| File | Purpose |
|---|---|
| `server/domain/movie.ts` | `NormalizedMovie` type |
| `server/domain/show.ts` | `NormalizedShow` type |
| `server/utils/filterRegistry.ts` | Complete `FilterDefinition[]` with predicates |
| `server/modules/filterFields/filterFields.handler.ts` | `GET /api/filter-fields` |
| `server/modules/filterFields/filterFields.routes.ts` | Route registration |

### Modified files (server)
| File | Change |
|---|---|
| `server/database/schema.ts` | `contentType` replaces `mediaType`; add `savedQueryFilterValues` table |
| `server/database/migrations/0007_*.sql` | Rename + blob extraction + key renames |
| `server/services/savedQueryService.ts` | New draft/dto shapes; join table reads/writes; health computation |
| `server/services/automationService.ts` | Content-type compatibility check; remove mediaType refs |
| `server/services/automationExecutor.ts` | Full pipeline: normalise → enrich → apply registry predicates |
| `server/modules/savedQueries/savedQueries.schemas.ts` | `filterValues` array instead of blob |
| `server/modules/savedQueries/savedQueries.handler.ts` | Wire new schema |
| `server/modules/index.ts` | Register filterFields route |
| `server/utils/mediaFilters.ts` | Decompose into registry entries; this file may be deleted |
| `server/container.ts` | Register any new services |

### Modified files (client)
| File | Change |
|---|---|
| `src/hooks/useSavedQueries.ts` | New `SavedQuery` type; new `createQuery` shape; health field |
| `src/hooks/useMediaFilters.ts` | Key renames matching registry; sort fields stay UI-only |
| `src/lib/utils/filterSummary.ts` | Registry-driven labels; remove hardcoded key map |
| `src/components/QueryRow/*` | Render `filterValues` array instead of `filters` blob |
| `src/components/AutomationBuilder/*` | Pass `contentType` when creating query; health display |
| `src/pages/dashboard/Dashboard.stories.tsx` | Update mock shapes |

### Modified files (tests)
| File | Change |
|---|---|
| `server/__tests__/services/savedQueryService.test.ts` | New create shape; health assertions |
| `server/__tests__/services/automationService.test.ts` | Content-type compatibility; remove mediaType |
| `server/__tests__/services/automationExecutor.test.ts` | Registry-based filter application; enrichment path |
| `server/__tests__/services/automationExecutorRunService.test.ts` | New query shape |
| `server/__tests__/services/automationRunService.test.ts` | New query shape |
| `server/__tests__/integration/automationRuns.integration.test.ts` | New query shape |
| `server/__tests__/utils/mediaFilters.test.ts` | Tests move to registry predicate tests |
| `src/components/QueryRow/__tests__/QueryRow.test.tsx` | New filter display shape |
| `src/components/AutomationBuilder/__tests__/AutomationBuilder.test.tsx` | New query shape |

---

## Phase 3 foundation

After this rewrite, Phase 3 combination queries are:

- A combination joins N queries; all must share the same `contentType`
- The combined filter set is the union of all constituent filter value sets
- Automation compatibility: action provider's content type support includes `query.contentType`
- Health: degraded if any constituent query is degraded; unavailable if any is unavailable
- No structural changes required — the model already supports it

---

## Implementation order (for the session that picks this up)

This is a multi-cycle change. Suggested sequence to keep the suite green at each step:

1. **Pre-flight:** create `NormalizedMovie`, `NormalizedShow` types; create `filterRegistry.ts` with all definitions and predicates; write tests for each predicate in isolation
2. **DB + schema:** migration file; update `schema.ts`; confirm `initializeDatabase` applies cleanly
3. **`SavedQueryService`:** new create/read/list against join table; health computation; all existing tests updated to new shape
4. **`AutomationService`:** content-type compatibility check replacing mediaType check; tests updated
5. **`AutomationExecutor`:** full pipeline; normalised item building; multi-source enrichment hook (currently only RADARR/SONARR paths exist, but structure is now correct); tests updated
6. **`GET /api/filter-fields`:** new endpoint; client can use it
7. **Client:** update hooks, filterSummary, components to new shape

Do not proceed to step N+1 until all tests pass at step N.

---

## Acceptance criteria

- `tautulliWatched` / `watched` filter is evaluated at execution time against Tautulli or Plex watch data when either provider is active
- `saved_queries` has no `filters` blob column; filter values are in `saved_query_filter_values` rows
- Filter keys in storage match registry keys; all renamed keys have a migration
- `SavedQueryDto` includes `health` with per-provider status
- `AutomationService.create()` rejects when action provider's content type does not include query's `contentType`
- `AutomationExecutor` skips filters whose source providers are unconfigured rather than throwing; records `skippedFilters` in the run result
- Client filter display and summary use registry labels; no hardcoded key→label mapping
- A user with SONARR + TAUTULLI + PLEX and no RADARR can create and execute show automations; movie queries show degraded health (no action provider) but are not prevented
- All 471 existing tests continue to pass after the rewrite; new tests cover the scenarios above
