# Provider Roles & the Media Identity Model (as-built)

**Status:** AS-BUILT (current fact) — 2026-06-15. This documents the model the code *actually*
implements today, including its limits. The corrective target it is evolving toward lives in
`docs/intent/provider-source-model.md`.

**Scope:** this covers the **MediaSource** and **MetadataEnricher** roles as built. The third role a
system can play — **MediaActuator** (tasks/actions) — and its as-built gap are in
`docs/architecture/task-execution-and-actuator-gap.md`. The unifying three-role model is
`docs/intent/system-roles-and-capabilities.md`.

## Why this is recorded as architecture, not intent

Providers were originally conceived as a flat, all-optional set of feeders mapped into one graph. In
practice the code grew an implicit hierarchy: a couple of providers became *catalog owners* and the
rest became *decorators*. That hierarchy is not a mistake or an unstarted plan — it is a real,
load-bearing property of the running system, and it turns out to encode an original intention
(some providers *seed* the catalog; others *enrich* it) that was discovered by evolution rather than
declared up front. It is recorded here so the system is understood as it is; the intent doc records
how that intention should be made explicit and correct.

## The three emergent tiers

| Tier | Providers (today) | Role in code |
|---|---|---|
| **Catalog owner** | Radarr (movies), Sonarr (series) | Define what *exists* and its canonical id; the catalog is literally the union of their libraries |
| **Enricher** | Tautulli, Plex, Overseerr, TMDB / OMDB / TVMaze | Decorate owner rows by shared key; contribute nothing standalone |
| **Inert toward catalog** | Jellyfin (connection-test + search only), Plex-as-*owner* | Cannot produce a catalog row at all |

With no Radarr and no Sonarr configured, the app is effectively empty: browse lists, identity
resolution, and enrichment all short-circuit to nothing (see the pipeline below).

## The catalog is the union of the *arr libraries

`media.handler.ts` serves browse lists by querying only active `RADARR` / `SONARR` providers and
calling `getMovies()` / `getSeries()` per instance, concatenating results
(`getMovies`/`getSeries`, `media.handler.ts:218-260`). Tags, quality profiles, genres, and networks
derive from the same two types. Enrichment is then merged *onto* those owner rows
(`mergeEnrichment(db, normalized, 'RADARR'|'SONARR', …)`).

## The identity model

`media_identity` (`schema.ts:216`, migration `0009`) is the spine:

- **Created only by owners.** `IdentityResolutionJob.runForMovies` (Radarr) and `runForSeries`
  (Sonarr) *insert* rows; each early-returns `0` without its provider
  (`identityResolutionJob.ts:115,69`). `runForPlex` never inserts — it only *stamps* `plexRatingKey`
  onto rows that already match by `tmdbId`/`tvdbId` (`:29,57`).
- **Keyed by `UNIQUE(sourceType, sourceId)`** where `sourceType` is the provider **type**
  (`'RADARR'`/`'SONARR'`) and `sourceId` is that app's internal id. Cross-provider ids
  (`tmdbId`, `tvdbId`, `imdbId`, `plexRatingKey`, …) are resolved onto the same row.
- **Enrichment hangs off identities.** `EnrichmentJob.run` selects `FROM media_identity LEFT JOIN
  media_enrichment` and enriches stale rows from Tautulli/Plex/Overseerr contributions matched by
  `tmdb:`/`plex:` tokens (`enrichmentJob.ts:55`). An empty identity table means the enrichers are
  never even queried.

## Known as-built limitations (the corrective targets)

1. **`sourceType` conflates *type* with *instance*.** The identity key uses the provider type, not the
   configured instance, so **two instances of the same type collide**: a non-4k Radarr and a 4k Radarr
   both map `(RADARR, <internal id>)` to one row. Multiple instances of one provider type are
   therefore unsupported at the identity/enrichment layer (browse concatenates and partially "works",
   but enrichment keys onto the wrong row).
2. **No version/edition concept.** A logical title is assumed to be one concrete item. Real sources
   expose several (a 4k and a non-4k copy across instances; a single Plex item with multiple editions
   or quality-optimized versions).
3. **Media servers cannot own.** Plex only enriches; Jellyfin is wired only into connection-test and
   search (`providers.handler.ts`, `search.handler.ts`) and its `jellyfinItemId` column is never
   populated by any job.
