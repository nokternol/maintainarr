# Provider Roles & the Media Identity Model

As of 2026-07-12, this documents the model the code *actually* implements today, including its
remaining limits — recorded as architecture rather than intent because the hierarchy and the
multi-instance identity model described below are real and load-bearing, not an unstarted plan.

**Scope:** this covers the **MediaSource** role, the group/instance identity model underneath it, and
the enricher role's relationship to that model. (The enricher role is the `MediaEnricher` contract —
`enrich(items): EnrichmentResult` — re-grounded in Phase 2.5; its full spec is
`docs/architecture/media-enricher-role.md`.) The third role a system can play — **MediaActuator**
(tasks/actions) — is the role-owned task model in `docs/architecture/actuator-task-ownership.md`.

## Why this is recorded as architecture, not intent

Providers were originally conceived as a flat, all-optional set of feeders mapped into one graph. In
practice the code grew an implicit hierarchy: a couple of providers became *catalog owners* and the
rest became *decorators*. That hierarchy is not a mistake or an unstarted plan — it is a real,
load-bearing property of the running system, encoding an original intention (some providers *seed* the
catalog; others *enrich* it) that was discovered by evolution rather than declared up front.

A second load-bearing property, added later: catalog ownership is a **role membership fact**, not a
per-request assumption. Which provider types own which content type is declared in one place and
every other surface derives from it — never re-declares it.

## The three emergent tiers

| Tier | Providers (today) | Role in code |
|---|---|---|
| **Catalog owner** (`MediaSource`) | Radarr (movies), Sonarr (series) | Define what *exists* and its canonical id; the catalog is the union of every active instance's library |
| **Enricher** | Tautulli, Plex, Overseerr, TMDB / OMDB / TVMaze | Decorate owner rows by shared key; contribute nothing standalone |
| **Inert toward catalog** | Jellyfin (connection-test + search only), Plex-as-*owner* | Cannot produce a catalog row at all |

With no Radarr and no Sonarr configured, the app is effectively empty: browse lists, identity
resolution, and enrichment all short-circuit to nothing (see the pipeline below).

## The single authority for catalog ownership

[`providers/roles.ts`](ref:path:server/modules/providers/roles.ts) declares `SOURCE_OWNER_BY_KIND: Record<MediaKind, MetadataProviderType>`
(`movie → RADARR`, `show → SONARR`) plus `isMediaSourceType`/`kindOfSourceType` derived from it. This is
the *only* place that fact is declared:

- `media/mediaSourceFactory.ts`'s `sourceOwnership()` (the `GET /api/media/sources` wire projection) and
  `filterRegistry.ts`'s `ContentType` (a type alias of `MediaKind`) both derive from it — media never
  re-declares the map, only imports it (the one legal `media → providers` direction).
- `ProviderSettingsService.assertNoActiveConflict` reads `isMediaSourceType` to decide whether the
  single-active-provider invariant (D8) applies — see below.
- The identity job reads `SOURCE_OWNER_BY_KIND`/`kindOfSourceType` to know which provider types to fetch
  and what `kind` to resolve their items under.

A type graduating into the `MediaSource` role (Plex, per the still-open intent doc) would extend this one
map; every consumer above inherits the change without its own edit.

## Multi-instance is real: Radarr/Sonarr may have any number of active instances

`ProviderSettingsService.assertNoActiveConflict` ([`server/modules/providers/providerSettingsService.ts`](ref:path:server/modules/providers/providerSettingsService.ts))
early-returns for `isMediaSourceType(type)` — Radarr and Sonarr carry **no** single-active invariant.
Every other provider type (TMDB, Overseerr, Tautulli, Plex-as-enricher, Jellyfin) still enforces it: at
most one active instance, or `assertNoActiveConflict` throws `ValidationError`. This is role-scoped, not
type-hardcoded, so it reads directly off the one authority above.

`ProviderFactory.createInstances(providers, logger)` ([`server/modules/providers/providerFactory.ts`](ref:path:server/modules/providers/providerFactory.ts))
is the structural half of this: it returns one `{ settings, provider }` entry per configured row, never
collapsing same-type entries into a single slot. `ProviderSet` (the older `createMany` result) has no
`radarr`/`sonarr` slots at all — the type system cannot express "the Radarr instance" any more, so no
future consumer can silently reintroduce last-one-wins.

## The identity model: group vs. instance copy

`media_identity`/`media_item` ([`server/database/schema.ts`](ref:path:server/database/schema.ts), migration `0014`) is the spine — a
two-table split between the logical title and each instance's concrete copy of it:

- **`media_identity` is the group** — one row per logical title, no per-source coordinate. Keyed
  per-`kind` (`movie`/`show`, scoping the primary-id namespace: a TMDB movie id and a TMDB tv id with the
  same number are different titles) by a partial-unique index on its primary id (`tmdbId` for movies,
  `tvdbId` for shows).
- **`media_item` is one row per instance's copy**, `UNIQUE(providerId, externalId)` — `providerId` is the
  *configured instance* (`metadata_provider.id`), not the provider type, so a non-4k Radarr and a 4k
  Radarr never collide; both copies attach to the same `media_identity` group when they report the same
  primary id.
- **`resolveGroup(db, kind, ids)`** ([`server/modules/providers/groupResolver.ts`](ref:path:server/modules/providers/groupResolver.ts)) is the
  sole find-or-create authority for which group an item belongs to: primary id per kind if present;
  otherwise a fallback chain (`imdbId`, then `title`+`year`); otherwise a fresh group. Identifier fields
  are merged onto an existing group **fill-only** — a found group's non-`NULL` column is never
  overwritten. No code path ever merges two *existing* groups; a group left with zero `media_item` rows
  is swept, not merged away.

## The identity job: one loop per active instance

`IdentityResolutionJob`/`IdentityJobFactory` ([`server/modules/providers/identityResolutionJob.ts`](ref:path:server/modules/providers/identityResolutionJob.ts))
loop every active instance per type — never collapsed to one:

- `IdentityJobFactory.create()` builds `movieSources`/`seriesSources` arrays via `createInstances`, one
  `{ providerId, provider }` per active Radarr/Sonarr row.
- `runForMovies`/`runForSeries` resolve each fetched item's group via `resolveGroup`, upsert its
  `media_item` row on `(providerId, externalId)`, then **prune** that instance's `media_item` rows whose
  `externalId` is no longer in its fetched set (an item removed from one instance's library stops being a
  copy there without touching any other instance's copies), and finally **sweep** every group left with
  zero `media_item` rows.
- `runForPlex` never inserts a group — it only *stamps* `plexRatingKey` onto groups matching by
  `kind` + `tmdbId`/`tvdbId`, closing a bug where an unscoped `tmdbId` match could cross the movie/tv id
  namespaces.

## Enrichment: two distinct paths through the group/item split

- **The enrichment job** (`EnrichmentJob.run`, [`server/modules/media/enrichmentJob.ts`](ref:path:server/modules/media/enrichmentJob.ts)) is
  group-level and instance-agnostic: it selects `FROM media_identity LEFT JOIN media_enrichment`,
  hydrates each stale group into a canonical `MediaItem` (`_sourceIds.identity` is the group's own
  surrogate id — collision-free by construction, since no two groups share it, unlike a bare `tmdbId`
  that could span kinds), and hands the batch to every `MediaEnricher`; each matches by the logical key it
  speaks (`_sourceIds.plex`/`.tmdb`) and `resolvePrecedence` resolves per field at write time. An empty
  identity table means the enrichers are never even queried. See `docs/architecture/media-enricher-role.md`.
- **`mergeEnrichment(db, items)`** (browse/preview path, [`server/modules/media/enrichmentMerge.ts`](ref:path:server/modules/media/enrichmentMerge.ts)) joins
  the other direction — from a batch of source-produced items, each carrying its own
  `_sourceIds.providerId`/native id, grouped by `providerId` and joined through `media_item` to its
  group's enrichment row. Two items from two instances that resolve to the same group correctly read
  identical group-level enrichment (watched-ness is a fact about the title, not the copy); two instances'
  distinct copies that happen to share a raw external id never cross-attribute, since the join is scoped
  per `providerId`. No type parameter — attribution is a relational join, not a type-string equality.

## The MediaSource read contract

The source role is a typed read contract ([`server/modules/media/mediaSource.ts`](ref:path:server/modules/media/mediaSource.ts)), not duck-typed
access to `getMovies`/`getSeries`:

```ts
interface MediaSource {
  getMediaItems(): Promise<MediaItemSet>;          // already normalized, self-describing provenance
  idOf(item: NormalizedMovie | NormalizedShow): number | undefined;
}
```

The method names are role-named — a source advertises *media items*, not movies or series. Every
source-produced item's `_sourceIds` carries `providerId` (the constructing instance) and the logical
`tmdb`/`imdb`/`tvdb` ids (`normalizeRadarrMovie`/`normalizeSonarrSeries` take `providerId` and populate
them). `MediaQueryEngine.evaluate` never branches on provider type: it reads `source.getMediaItems()`,
merges DB enrichment via `mergeEnrichment(db, items)`, and pools matched items by `itemKey(item)`
(`${providerId}:${externalId}`, [`server/modules/media/mediaItem.ts`](ref:path:server/modules/media/mediaItem.ts) — collision-free across
instances) rather than a single source's `idOf`. `idOf` stays as the provider-native id projection
`task.run` speaks — unambiguous within one bound instance, which is what an automation execution and a
raw-DTO lookup both are.

`MediaSourceFactory.sourcesFor(contentType)` ([`server/modules/media/mediaSourceFactory.ts`](ref:path:server/modules/media/mediaSourceFactory.ts)) resolves a
`ContentType` to one `{ providerId, name, source: MediaSource }` entry per *active instance* owning it —
never collapsed to one. `GET /api/media-queries/:id/preview` fans out over it, evaluating the query spec
once per instance and summing per-instance match counts into `{ count, instances: [{ providerId, name,
count }] }`. The executor instead binds a specific provider by `automation.provider.id`, since it needs
the actuator role on the same instance for `task.run` — an automation targets one instance; running the
same saved query against two instances is two automations sharing that query record.

**Browse still flattens instances (pending Phase 7).** `media.handler.ts` fetches raw
`RadarrMovie[]`/`SonarrSeries[]` via `getMovies()`/`getSeries()`, looping every active instance but
concatenating their results into one flat array before wrapping it in an inline `MediaSource` — under
today's still-real single-active invariant for browse *display* (not identity/enrichment, which are
already fully multi-instance), this is unobservable, but it means browse does not yet dedupe two
instances' copies of the same title into one row, nor label which instance a copy came from. That
per-instance sublist / live display-grouping rewrite, and per-instance filter-value qualification
(`qualityProfileIds`/`tagIds`), are Phase 7's job.

## Remaining limitations

1. **No version/edition concept.** A logical title is assumed to be one concrete item per instance. Real
   sources can expose several editions from *one* instance (a single Plex item with multiple
   quality-optimized versions) — distinct from the multi-*instance* case the identity model above
   already handles.
2. **Media servers cannot own.** Plex only enriches; Jellyfin is wired only into connection-test and
   search (`providers.handler.ts`, `search.handler.ts`) and its `jellyfinItemId` column is never
   populated by any job.
3. **Browse does not yet dedupe or label instances** — see the Phase 7 note above.
