# Phase 2c — Filter Provenance and the Saved Query Model

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 2b shipped (`saved_query.mediaType`)
**Blocks:** Phase 3 (combination model requires a coherent query identity)
**Status:** IMPLEMENTED — 2026-06-07

---

## Current model: what actually exists

Three DB tables and two in-memory TypeScript interfaces. No more.

```
metadata_provider        saved_queries              automations
─────────────────        ──────────────────         ────────────────────
id                       id                         id
type (RADARR|SONARR|…)   name                       name
name                     filters  ← JSON blob       queryId
url                      mediaType ('movie'|'series')providerId ──► metadata_provider
apiKey                   createdAt                  taskId
isActive                                            schedule
                                                    status

                         TypeScript (NOT stored)
                         ─────────────────────────────────────────
                         MovieFilterQuery  (interface ~13 fields)
                         SeriesFilterQuery (interface ~20 fields)
                         applyMovieFilters(movies, query)
                         applySeriesFilters(series, query)
```

A saved query's `filters` blob is a flat JSON object:

```json
{ "hasFile": true, "yearMin": 2010, "radarrImdbRatingGte": 7.0, "movieTagIds": "1,4" }
```

or:

```json
{ "seriesStatus": "ended", "sonarrPercentEpisodesGte": 90, "monitored": false }
```

There is **no link** between the stored keys and anything in the database. The blob is
interpreted entirely by `mediaType` at execution time: if `'movie'`, deserialise into
`MovieFilterQuery` and call `applyMovieFilters`. If `'series'`, the other pair.

An automation binds: query + provider instance + task + schedule. The provider lives on the
automation. The query has no direct provider relationship — only the `mediaType` proxy.

---

## What Phase 2b left behind: the mediaType problem

Phase 2b added `mediaType` to break an implicit coupling. It works but `mediaType` is a proxy
for the wrong concept. `'movie'` means "this query targets RADARR." `'series'` means SONARR.
Those are provider identities expressed through a media-content classification.

This was identified and Phase 2c was initially drafted as: rename `mediaType` → `providerType`
on `saved_query`. That direction is now under question.

---

## The real problem: filter fields have no declared provenance

The field names `radarrImdbRatingGte`, `seriesStatus`, `sonarrEnded` encode their data source
by convention only. The schema carries no expressed relationship between a filter field and the
provider whose data it reads. Three things are impossible without out-of-band knowledge:

1. **UI discovery** — which filters require which providers to be configured?
2. **Execution routing** — which providers need to be called before filters can be applied?
3. **Validation at create time** — is this filter key valid for this query?

All three rely on code having hardcoded knowledge of what field names mean. The code has this
knowledge (in `MovieFilterQuery`, `SeriesFilterQuery`, `applyMovieFilters`, `applySeriesFilters`)
but it is scattered and not connected to the stored data.

---

## Two design directions

### Framing A — query owns its execution target (Phase 2c original direction)

```
saved_query.providerType = 'RADARR' | 'SONARR'
```

The query declares its execution target. Filters are validated against the target provider's
schema at create time. The automation's `providerId` must point to a matching instance.

**Works for:** all current use cases.

**Breaks when:** a filter field's data source differs from the execution target. Example:
"RADARR movies with fewer than 5 Tautulli plays." Tautulli is not the execution target, but one
of its fields is being filtered on. Framing A cannot model this without another workaround.

Adopting Framing A now means a breaking schema change later when cross-provider filter fields
land — exactly the situation Phase 2b just cleaned up.

### Framing B — filter definitions carry their own provenance

```
filter_definition (static registry in code):
  key: string                    — e.g. 'hasFile', 'tautulliPlayCountLte'
  sourceProviderType: string     — where the data comes from
  targetCompatibility: string[]  — which execution targets this filter is valid against
  dataType: 'boolean'|'number'|'string'|'csv-ids'
  label: string

saved_query:
  id, name                       — no providerType here
  filter values stored as rows, not a JSON blob

saved_query_filter_values:
  savedQueryId, filterKey, value — (filterKey resolves to filter_definition)

automation (unchanged):
  queryId, providerId, taskId, schedule
  — providerId IS the execution target; compatibility validated at create time
```

A saved query is a named set of filter value assignments. The query is provider-agnostic.
The execution target is supplied by the automation, not stored on the query.

**Compatibility check at automation creation:**

```
for each filter key in the query:
  look up filter_definition by key
  assert automation.provider.type ∈ filter_definition.targetCompatibility
```

One check, covers all current and future filter fields regardless of their data source.

**Execution pipeline under Framing B:**

```
1. Load automation → get provider instance (execution target) and saved query
2. Group query filter values by filter_definition.sourceProviderType
3. Fetch target list from execution target provider (e.g. RADARR movie list)
4. For each non-target source provider: fetch enrichment data and join onto target list
5. Apply all filters against the enriched list
6. Execute task against matched items
```

This pipeline can be built incrementally: today only RADARR and SONARR source providers
exist, so steps 3-4 collapse to one. The architecture supports enrichment providers without
structural changes.

---

## What the model has been missing

Three implicit assumptions are baked into the code but absent from the schema:

1. **All filter fields in a query come from the same provider as the execution target.**
   Encoded by `mediaType` and two hardcoded filter branches. Breaks with cross-provider filters.

2. **Filter field names are self-documenting.**
   `radarrImdbRatingGte` tells you it is RADARR by name only. There is no schema entry that
   expresses this. If a field is renamed, old saved queries silently drop that filter.

3. **A query is used by exactly one provider type.**
   Accidentally correct but unenforced. The model prevents reusing a filter set across providers
   that could legitimately share filters (e.g. both RADARR and SONARR support `addedDaysAgoGte`).

---

## Recommendation

Adopt **Framing B**. The cost of Framing A is a guaranteed breaking change when cross-provider
filter fields land. Framing B resolves the root cause and makes that future change additive, not
structural.

**The migration has a natural intermediate step** that avoids a big-bang rewrite:

- Replace `saved_query.filters` (JSON blob) with a `saved_query_filter_values` join table
- Keep the filter definitions as a **static code registry** (not a DB table) — filter schemas
  are defined by provider APIs and do not change at runtime; a static registry is appropriate
- Remove `saved_query.mediaType` — it becomes unnecessary once filter keys carry their own
  `targetCompatibility`
- Move the compatibility check from `SavedQueryService.create()` to
  `AutomationService.create()` — the automation is the binding that introduces the execution
  target, so that is where compatibility must be validated
- Execution pipeline: start with the single-source case (today), extend to multi-source when
  enrichment providers land

---

## What this does NOT require

- A `filter_definitions` DB table — the registry lives in code. Filter schemas are static.
- Changes to `metadata_provider` or `automations` tables — those are correct as-is.
- Multi-source execution pipeline immediately — build today's single-source path correctly and
  the multi-source extension slots in without restructuring.

---

## Design decisions required before implementation

1. **Filter values as rows vs embedded JSON** — `saved_query_filter_values` is a proper join
   table (one row per assigned filter). The current blob is a denormalised form of this. The
   join table is strictly more correct and queryable; the blob is simpler to read. Given the
   current filter count (10-20 per query) the join table is the right call.

2. **Registry key stability** — filter keys (e.g. `'radarrImdbRatingGte'`) are stored in the
   DB once `saved_query_filter_values` exists. Renaming a key in the registry orphans existing
   rows. The registry must treat keys as stable identifiers, with explicit migration if a key
   changes.

3. **`targetCompatibility` granularity** — initially: RADARR fields target RADARR only, SONARR
   fields target SONARR only, shared fields (title, year, addedDaysAgoGte, sizeOnDiskGbGte)
   target both. TAUTULLI and TMDB fields target all media-library providers. This list is
   extended when new provider types are added, not when filters are created.

4. **Phase 3 combination queries under Framing B** — a combination joins two queries whose
   combined filter sets must all be compatible with the automation's execution target. This is
   the same compatibility check, just applied to N queries instead of 1. Clean.

---

## Acceptance criteria (when this ships)

- `saved_queries` has no `mediaType` or `providerType` column
- `saved_query_filter_values` table holds one row per assigned filter, with a `filterKey` that
  resolves to a static registry entry
- Static `FILTER_REGISTRY` in code declares `sourceProviderType`, `targetCompatibility`, `dataType`,
  `label` for every known filter key
- `SavedQueryService.create()` validates filter keys against the registry (key existence and
  value type) — not against a provider type
- `AutomationService.create()` validates that all of the query's filter keys are compatible with
  the automation's provider type (`targetCompatibility` check)
- `AutomationExecutor` groups filter values by `sourceProviderType` before applying them;
  today that group is always size 1 (RADARR or SONARR only) — no multi-source pipeline yet
- All existing tests pass; new tests cover: unknown filter key rejection, type mismatch
  rejection, cross-provider compatibility failure at automation creation, single-source
  execution path using the filter values join table
