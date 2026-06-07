# Phase 2c — `saved_query.providerType` and Filter Field Registry

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 2b shipped (`saved_query.mediaType`)
**Blocks:** Phase 3 (combination model requires a coherent query type identity)
**Status:** INTENT — not yet implemented

---

## The problem Phase 2b left behind

Phase 2b added `saved_query.mediaType: 'movie' | 'series'` to break the implicit coupling between
executor routing and provider type. It works, but `mediaType` is a proxy for the wrong concept.

**What `mediaType` actually means:** "this query targets RADARR" (movie) or "this query targets
SONARR" (series). The media type is a consequence of the provider, not a first-class identity.
The discriminator in the executor is `if (query.mediaType === 'movie')` — which is a roundabout
way of saying `if (query targets RADARR)`.

This proxy breaks down in two directions:

1. **PLEX also has movies and series.** A PLEX query targeting its watched-movie library would
   also be `mediaType: 'movie'`, but the executor and filter functions are RADARR-specific.
   `mediaType` cannot distinguish them.

2. **Filter fields have an undeclared provenance.** `hasFile`, `radarrImdbRatingGte`,
   `movieTagIds` are RADARR fields. `sonarrEnded`, `seriesStatus`, `seriesType` are SONARR fields.
   These names encode the source by convention, but the data model carries no declared relationship
   between a filter field and the provider it requires. As enrichment providers (TMDB, Tautulli)
   add their own filterable fields, the blob becomes uninterpretable without out-of-band knowledge.

**Root cause:** A `SavedQuery` should declare its execution target (a provider type, not a media
concept), and each filter field should be traceable to the provider whose data it filters. Neither
relationship is currently modelled.

---

## What changes

### 1. Rename `saved_query.mediaType` → `saved_query.providerType`

Replace the media-concept proxy with the actual relationship.

```sql
-- migration: rename column + remap values
ALTER TABLE `saved_queries` RENAME COLUMN `mediaType` TO `providerType`;
UPDATE `saved_queries` SET `providerType` = 'RADARR' WHERE `providerType` = 'movie';
UPDATE `saved_queries` SET `providerType` = 'SONARR' WHERE `providerType` = 'series';
```

`providerType` stores a `MetadataProviderType` value (`'RADARR'`, `'SONARR'`, etc.), not a
media-content classification. This makes the query-provider coupling explicit in the schema.

### 2. Introduce a static Filter Field Registry

`server/utils/filterRegistry.ts` (new file):

```ts
// Each entry declares: the field name, which provider type owns the data,
// and the value type. The registry is used for validation at create time
// and for UI field discovery.

export interface FilterFieldDef {
  field: string;
  providerType: MetadataProviderType; // which provider supplies this field's data
  valueType: 'string' | 'number' | 'boolean' | 'csv-ids';
  label: string;
}

export const FILTER_REGISTRY: FilterFieldDef[] = [
  // RADARR-sourced fields
  { field: 'hasFile',                    providerType: RADARR, valueType: 'boolean',  label: 'Has file' },
  { field: 'movieTagIds',                providerType: RADARR, valueType: 'csv-ids',  label: 'Tags' },
  { field: 'movieQualityProfileIds',     providerType: RADARR, valueType: 'csv-ids',  label: 'Quality profiles' },
  { field: 'movieGenres',                providerType: RADARR, valueType: 'string',   label: 'Genres' },
  { field: 'radarrImdbRatingGte',        providerType: RADARR, valueType: 'number',   label: 'IMDB rating ≥' },
  // ... all current MovieFilterQuery fields
  // SONARR-sourced fields
  { field: 'seriesStatus',               providerType: SONARR, valueType: 'string',   label: 'Status' },
  { field: 'sonarrEnded',                providerType: SONARR, valueType: 'boolean',  label: 'Ended' },
  { field: 'sonarrPercentEpisodesGte',   providerType: SONARR, valueType: 'number',   label: 'Episodes % ≥' },
  // ... all current SeriesFilterQuery fields
];

// Fields valid for a given query's providerType — used for validation
export function getFieldsForProvider(providerType: MetadataProviderType): FilterFieldDef[] {
  return FILTER_REGISTRY.filter(f => f.providerType === providerType);
}
```

**Why static:** Filter schemas are defined by the provider's API, not by runtime discovery. They
don't change at runtime. A static registry is the right shape and avoids a provider-API roundtrip
at query-create time.

**Cross-provider filter fields (future):** When TMDB enrichment lands, a field like
`tmdbRatingGte` would have `providerType: TMDB` but still be valid on a RADARR query (because the
RADARR media object is enriched with TMDB data). The registry model supports this: a query's
`providerType` is the *execution target*; a field's `providerType` is the *data source*. Phase 2c
doesn't implement cross-provider fields — it establishes the registry shape that makes them
possible without a breaking change.

### 3. `SavedQueryService.create()` — validate filter keys against the registry

When creating a query with `providerType: 'RADARR'`, reject any filter key that is not in
`getFieldsForProvider('RADARR')`. This replaces the current unvalidated free-form JSON.

Throw `ValidationError` with the unknown keys listed.

### 4. `SavedQueryDto` — add `providerConfigured: boolean`

At `list()` time, join `saved_queries` against `metadata_provider` on `type = providerType` to
determine whether at least one active provider of the required type is configured.

```ts
export interface SavedQueryDto {
  id: number;
  name: string;
  filters: QueryFilters;
  providerType: MetadataProviderType;
  providerConfigured: boolean; // false = no active provider of this type exists
  createdAt: string;
}
```

This gives the UI everything it needs for graceful degradation without a second request.

### 5. `AutomationService.create()` — simplified compatibility check

The current check is:

```ts
const compatible =
  (providerType === MetadataProviderType.RADARR && mediaType === 'movie') ||
  (providerType === MetadataProviderType.SONARR && mediaType === 'series');
```

After the rename it becomes:

```ts
const compatible = query.providerType === provider.type;
```

One equality check. No translation layer.

### 6. `AutomationExecutor` — branch on `query.providerType`

Replace:

```ts
if (mediaType === 'movie') { ... }
else if (mediaType === 'series') { ... }
```

with:

```ts
if (query.providerType === MetadataProviderType.RADARR) { ... }
else if (query.providerType === MetadataProviderType.SONARR) { ... }
```

The discriminator is now the actual thing it always meant.

### 7. Graceful degradation — executor early exit

Before fetching media, check that the provider instance is still active. If not:

```ts
if (!provider.isActive) {
  return this.recordResult(automationId, {
    status: 'error',
    itemCount: 0,
    error: `Provider "${provider.name}" is inactive — cannot execute`,
  });
}
```

This is the same check point where `providerConfigured: false` on the DTO signals the UI to warn.

---

## Files involved

| File | Action |
|---|---|
| `server/database/schema.ts` | Rename `mediaType` → `providerType`; update type annotation |
| `server/database/migrations/0007_saved_query_provider_type.sql` | RENAME COLUMN + remap values |
| `server/utils/filterRegistry.ts` | **New** — static filter field registry |
| `server/services/savedQueryService.ts` | `providerType` in draft/dto; validate keys; `providerConfigured` in list |
| `server/services/automationService.ts` | Simplified compatibility check; `providerType` in query DTO projection |
| `server/services/automationExecutor.ts` | Branch on `query.providerType`; inactive-provider early exit |
| `server/modules/savedQueries/savedQueries.schemas.ts` | `providerType: z.nativeEnum(MetadataProviderType)` |

---

## What this does NOT address

- **Cross-provider filter fields** (e.g. TMDB rating as a filter on RADARR results) — the registry
  shape supports it, but the executor, filter functions, and enrichment pipeline are out of scope
  for 2c. Document as a Phase 4 concern.
- **Dynamic filter schema from provider API** — filter fields are static. RADARR's tag list is
  dynamic data (used to populate a filter value UI), but the *schema* (that tags are filterable)
  is static. Do not conflate.
- **Multi-instance providers** — multiple RADARR instances. Phase 2c treats `providerType` as a
  unique execution target. Multi-instance is a Phase 3+ concern.

---

## Phase 3 handoff

After 2c, the Phase 3 combination model operates as follows:
- A combination joins two or more queries, each with a declared `providerType`
- Two RADARR queries → valid RADARR combination
- RADARR + SONARR queries → cross-type; Phase 3 decides allow/reject
- The `providerConfigured` flag propagates: a combination's providers are all configured iff
  each constituent query's `providerConfigured` is true

---

## Acceptance criteria

- `saved_queries.providerType` stores `MetadataProviderType` values; existing rows migrated
- `SavedQueryService.create()` validates filter keys against the registry for the given providerType
- `SavedQueryDto` includes `providerType` and `providerConfigured`
- `AutomationService.create()` compatibility check is `query.providerType === provider.type`
- `AutomationExecutor` branches on `query.providerType`, not a media-concept string
- `AutomationExecutor` records a meaningful error when the provider is inactive, not a thrown exception
- All existing tests pass; new tests cover: registry key validation rejection, `providerConfigured: false` when no provider of that type is active, inactive-provider early exit in executor
