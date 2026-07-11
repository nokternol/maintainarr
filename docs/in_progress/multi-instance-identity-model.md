# Multi-instance MediaSource — the `media_identity`/`media_item` model, complete design

**Status:** IN PROGRESS — spec, not yet built. This is the complete resolution; it replaces an earlier,
deliberately scoped-down spec that lived at `docs/in_progress/multi-instance-media-sources.md` (now
deleted — that draft relaxed the single-active-provider invariant without a real data model underneath
it, which a review found left enrichment attribution and browse id-matching silently broken). Not yet
broken into TDD phases; a proposed implementation order is at the end, but every numbered problem below
has a full answer here — nothing is deferred.

**Provenance note.** The worked-out "Logical grouping & the auto-resolver" and "Library-view display
grouping" sections this design adopts lived in `docs/intent/provider-source-model.md`, which was
deleted at commit `6725fe6` (North Star completion) and folded into the compact
`docs/intent/provider-media-identity-model.md`. The full text is recoverable via
`git show 6725fe6^:docs/intent/provider-source-model.md`. Its decisions — two-table entity model,
find-or-create grouping keyed on the per-kind native id, never auto-merge groups, instance-bound task
targeting, live display dedup with ANY filter semantics — were re-verified against current source and
are adopted (with corrections noted inline) rather than re-litigated.

**Design principle (Brief C, extended to its conclusion).** Provenance is a first-class fact carried
*on the data*: every persisted source copy is a `media_item` row keyed `(providerId, externalId)`, and
every in-memory normalized item carries `providerId` in its own `_sourceIds`. Nothing infers instance
from type, nothing encodes instance into an id string as the item's identity, and nothing threads an
instance parameter alongside data that could carry it itself. The data model is the core fix: the
enrichment-attribution ambiguity, the browse id collisions, and the merge-key fragility are all
symptoms of provenance having no concrete home.

---

## 1. The data model and migration

### 1.1 Target schema (`server/database/schema.ts`)

**`media_identity` becomes the group** — one row per logical title, no per-source coordinate:

```ts
export const mediaIdentity = sqliteTable(
  'media_identity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** MediaKind — 'movie' | 'show'. Scopes the primary-id namespace: TMDB movie id 603
     *  and TMDB tv id 603 are different titles. */
    kind: text('kind').notNull(),
    tmdbId: integer('tmdbId'),
    imdbId: text('imdbId'),
    tvdbId: integer('tvdbId'),
    tvMazeId: integer('tvMazeId'),
    plexRatingKey: text('plexRatingKey'),
    jellyfinItemId: text('jellyfinItemId'),
    /** Fallback grouping keys for items with no primary id; also feeds the future
     *  manual-correction layer. Populated on group creation for every group. */
    title: text('title'),
    year: integer('year'),
    resolvedAt: integer('resolvedAt'),
  },
  (t) => [
    uniqueIndex('ux_media_identity_movie_tmdb').on(t.tmdbId)
      .where(sql`kind = 'movie' AND tmdbId IS NOT NULL`),
    uniqueIndex('ux_media_identity_show_tvdb').on(t.tvdbId)
      .where(sql`kind = 'show' AND tvdbId IS NOT NULL`),
    index('idx_media_identity_tmdb').on(t.tmdbId),
    index('idx_media_identity_tvdb').on(t.tvdbId),
    index('idx_media_identity_imdb').on(t.imdbId),
  ]
);
```

`sourceType`/`sourceId` are **removed** — they move (renamed) to `media_item`. `kind` is stored on
the group because the group's uniqueness constraint is *per-kind* and a group, unlike an item, has no
provider to derive kind from. The partial-unique indexes are the resolver's "primary id per kind"
invariant made structural.

**`media_item` is new** — one row per concrete source copy:

```ts
export const mediaItems = sqliteTable(
  'media_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** The configured provider instance — the provider IS the source. */
    providerId: integer('providerId').notNull()
      .references(() => metadataProviders.id, { onDelete: 'cascade' }),
    /** That provider's native id for the item (formerly media_identity.sourceId). */
    externalId: integer('externalId').notNull(),
    mediaIdentityId: integer('mediaIdentityId').notNull()
      .references(() => mediaIdentity.id, { onDelete: 'cascade' }),
    resolvedAt: integer('resolvedAt'),
  },
  (t) => [
    uniqueIndex('ux_media_item_provider_external').on(t.providerId, t.externalId),
    index('idx_media_item_identity').on(t.mediaIdentityId),
  ]
);
```

- `kind` is **not stored** on `media_item` — it derives from the provider
  (`kindOfSourceType(provider.type)`, §6), exactly as the intent doc decided.
- `externalId` stays `integer`: both real source types (Radarr, Sonarr) use numeric native ids, and
  every current id path (`idOf`, `task.run(ids: number[])`) is `number`-typed. When a string-keyed
  source (Plex `ratingKey`) graduates to the `MediaSource` role, widening this column is a contained
  one-column migration inside work that already has to touch every id path; stringifying now would
  break those paths for zero current gain. This is a decision, not a deferral.
- `onDelete: 'cascade'` from `metadata_provider`: deleting a configured instance deletes its copies.
  Deactivating does not (rows persist for reactivation; the identity job prunes only what an *active*
  instance no longer reports — §3).

**`media_enrichment` keeps its FK to `media_identity` — enrichment attaches to the group.** Confirmed
correct against `docs/architecture/media-enricher-role.md`: every enricher matches by a *logical* key
(`_sourceIds.plex`, `_sourceIds.tmdb` — verified in `enrichment/enricherAdapters.ts`, no enricher
reads a `radarr`/`sonarr` key), and every enrichment fact (`playCount`, `lastWatchedAt`,
`overseerrRequestStatus`, `overseerrHasIssue`, `tmdbStatus`) is title-level: you watched *the film*,
you requested *the title* — not one Radarr instance's copy of it. A per-instance item reaches these
facts via `media_item → media_identity → media_enrichment` (§4). No schema change to
`media_enrichment`.

**`media_query_filter_values` gains an instance-qualification column** (for §10):

```ts
providerId: integer('providerId').references(() => metadataProviders.id, { onDelete: 'set null' }),
```

Nullable; `null` means "unqualified" (today's semantics). `SET NULL` on provider deletion rather than
cascading the entry away — deleting a provider must not silently change what a query matches; the
existing `QueryHealth` surface flags the resulting state instead (§10).

### 1.2 Migration (`0014_media_identity_split.sql`)

SQLite table-rebuild, preserving `media_identity.id` values so `media_enrichment` rows survive
untouched:

1. `CREATE TABLE media_item (…)` as above.
2. `CREATE TABLE media_identity_new (…)` as above (no `sourceType`/`sourceId`; adds `kind`, `title`,
   `year`).
3. Copy groups, deriving `kind` and preserving ids:
   ```sql
   INSERT INTO media_identity_new
     (id, kind, tmdbId, imdbId, tvdbId, tvMazeId, plexRatingKey, jellyfinItemId, resolvedAt)
   SELECT id,
          CASE sourceType WHEN 'RADARR' THEN 'movie' ELSE 'show' END,
          tmdbId, imdbId, tvdbId, tvMazeId, plexRatingKey, jellyfinItemId, resolvedAt
   FROM media_identity
   WHERE EXISTS (SELECT 1 FROM metadata_provider p
                 WHERE p.type = media_identity.sourceType AND p.isActive = 1);
   ```
4. Materialize one `media_item` per migrated row, attributing it to the active instance of its type —
   well-defined because the single-active invariant still holds at migration time:
   ```sql
   INSERT INTO media_item (providerId, externalId, mediaIdentityId, resolvedAt)
   SELECT (SELECT p.id FROM metadata_provider p
           WHERE p.type = mi.sourceType AND p.isActive = 1 LIMIT 1),
          mi.sourceId, mi.id, mi.resolvedAt
   FROM media_identity mi
   WHERE EXISTS (SELECT 1 FROM metadata_provider p
                 WHERE p.type = mi.sourceType AND p.isActive = 1);
   ```
5. Rows whose owning type has **no active instance** are dropped (steps 3–4's `WHERE EXISTS`), and
   their enrichment rows with them:
   `DELETE FROM media_enrichment WHERE mediaIdentityId NOT IN (SELECT id FROM media_identity_new);`
   Rationale: unattributable rows cannot be given a `providerId` without guessing; the identity job
   recreates them (and enrichment re-fills on its staleness pass) the moment the instance is active
   again. Cache-shaped data may be rebuilt, never guessed.
6. Defensive pre-index dedupe (Radarr/Sonarr enforce library-unique tmdb/tvdb, so real duplicates
   should not exist, but the index must not be able to fail):
   `UPDATE media_identity_new SET tmdbId = NULL WHERE id NOT IN (SELECT MIN(id) FROM
   media_identity_new WHERE tmdbId IS NOT NULL GROUP BY kind, tmdbId) AND tmdbId IS NOT NULL;`
   (same for `tvdbId`). NULLed ids re-resolve on the next identity run.
7. `DROP TABLE media_identity; ALTER TABLE media_identity_new RENAME TO media_identity;` then
   recreate the indexes of §1.1. (Drizzle migrations run with foreign keys deferred; after the
   rename, `media_enrichment`'s FK target resolves to the new table by name.)

`0015_filter_value_provider_scope.sql`: `ALTER TABLE media_query_filter_values ADD COLUMN providerId
INTEGER REFERENCES metadata_provider(id) ON DELETE SET NULL;`

---

## 2. Grouping: find-or-create, never merge

The recovered "Logical grouping & the auto-resolver" section is coherent and is **adopted**, with two
sharpenings (fill-only merges, and explicit item re-homing). The resolver is providers-side,
module-private next to the job that owns it: `server/modules/providers/groupResolver.ts` (or inline
in `identityResolutionJob.ts` if it stays small).

`resolveGroup(db, kind, ids: { tmdbId?, tvdbId?, imdbId?, tvMazeId?, title?, year? }): Promise<number>`
— returns the `media_identity.id` an item attaches to:

1. **Primary id per kind** — `tmdbId` for `movie`, `tvdbId` for `show`. If present:
   `SELECT … WHERE kind = ? AND <primaryCol> = ?`. Found → that group. Not found → `INSERT` a new
   group carrying all known ids plus `title`/`year`.
2. **Fallback chain** (no primary id): find by `(kind, imdbId)`; else by `(kind, title, year)`; else
   insert a fresh group. Matching by `imdbId` may attach to a group that *does* have a primary id —
   that is attaching an item to a group, which is allowed; what is forbidden is merging two existing
   groups.
3. **Identifier merge is fill-only.** After a find, the item's other identifiers are merged into the
   group only where the group's column is `NULL`. A conflicting non-NULL value is never overwritten
   (overwriting is how transitive bridging — the dangerous over-merge — would sneak in); conflicts
   are logged and left for the future manual layer.
4. **Never auto-merge two existing groups.** No code path updates one group's ids from another group,
   and no code path re-points one group's items at another wholesale.
5. **Re-homing, not merging.** The item upsert (§3) sets `mediaIdentityId` on every pass, so an item
   whose provider starts reporting a primary id simply resolves to (or creates) the correct group and
   moves. A group left with zero items is deleted by the orphan sweep (§3) — enrichment cascades. This
   is how fallback-created duplicate groups self-heal when better ids arrive, without any
   group-to-group merge.

Duplicate groups produced by fallback misses remain, as decided, the future manual layer's job — the
surrogate-id/match-key separation exists precisely so that layer can be added without a rewrite.

---

## 3. `IdentityResolutionJob` / `IdentityJobFactory`

### `IdentityJobFactory` (`server/modules/providers/identityJobFactory.ts`)

Stops collapsing instances. Using the providers-side authority (§6) and the new factory surface (§7):

```ts
async create(): Promise<IdentityResolutionJob> {
  const sourceTypes = [...new Set(Object.values(SOURCE_OWNER_BY_KIND))];
  const sourceSettings = await this.providerSettingsService.findActiveByTypes(sourceTypes);
  const instances = this.providerFactory.createInstances(sourceSettings, log);
  const [plexSettings] = await this.providerSettingsService.findActiveByTypes([MetadataProviderType.PLEX]);
  return new IdentityResolutionJob({
    db: this.db,
    movieSources: instances
      .filter((i) => i.settings.type === SOURCE_OWNER_BY_KIND.movie)
      .map((i) => ({ providerId: i.settings.id, provider: i.provider as RadarrProvider })),
    seriesSources: instances
      .filter((i) => i.settings.type === SOURCE_OWNER_BY_KIND.show)
      .map((i) => ({ providerId: i.settings.id, provider: i.provider as SonarrProvider })),
    plexProvider: plexSettings ? this.providerFactory.create(plexSettings, log) as PlexProvider : undefined,
    tvMazeLookup: this.providerFactory.createTvMaze(log),
  });
}
```

### `IdentityResolutionJob` (`server/modules/providers/identityResolutionJob.ts`)

Deps change from `radarrProvider?/sonarrProvider?` singles to:

```ts
movieSources?: Array<{ providerId: number; provider: Pick<RadarrProvider, 'getMovies'> }>;
seriesSources?: Array<{ providerId: number; provider: Pick<SonarrProvider, 'getSeries'> }>;
```

- **`runForMovies()`**: for each `{ providerId, provider }` — fetch movies; per movie,
  `const identityId = await resolveGroup(db, 'movie', { tmdbId: movie.tmdbId, imdbId: movie.imdbId,
  title: movie.title, year: movie.year })`, then upsert `media_item` on
  `(providerId, externalId = movie.id)` setting `mediaIdentityId` and `resolvedAt` (the
  `onConflictDoUpdate` target moves from `(sourceType, sourceId)` to `(providerId, externalId)`).
  After each instance's loop, **prune**: delete this `providerId`'s `media_item` rows whose
  `externalId` is not in the fetched set — an item removed from Radarr stops being a copy. (This
  replaces today's accumulate-forever behavior deliberately: the table is a projection of live
  libraries, and stale rows would otherwise feed the enrichment job garbage groups.)
- **`runForSeries()`**: same shape, primary id `tvdbId`, secondaries `tmdbId`/`imdbId`/`tvMazeId`.
  The TVMaze lookup keeps its rate-limit pacing but its write moves to the *group*, fill-only:
  `UPDATE media_identity SET tvMazeId = ? WHERE id = ? AND tvMazeId IS NULL`.
- **`runForPlex()`**: still stamp-only, but kind-scoped. `PlexBridgeProvider.getAllItems()` gains
  `type` (already present on `PlexMediaItem` in `plexProvider.ts`); the stamp becomes
  `WHERE kind = ? AND tmdbId = ?` (or `tvdbId`), mapping Plex `type` `'movie'→'movie'`,
  `'show'→'show'`. This closes a latent pre-existing bug — an unscoped `tmdbId` match can cross the
  movie/tv id namespaces — that becomes structural the moment `kind` exists.
- **Orphan sweep** at the end of `runForMovies`/`runForSeries`:
  `DELETE FROM media_identity WHERE id NOT IN (SELECT DISTINCT mediaIdentityId FROM media_item)` —
  enrichment cascades. Groups only ever exist because a copy does.

`server/modules/system/systemTaskRunner.ts`'s `IdentityJobLike`/`IdentityJobFactoryLike` interfaces
are unchanged (`runForMovies`/`runForSeries`/`runForPlex` signatures keep returning counts; counts
become totals across instances).

---

## 4. `mergeEnrichment` and the `MediaSource` contract

### `MediaSource` (`server/modules/media/mediaSource.ts`)

`enrichmentSourceType` is **deleted** — it was type-level provenance standing in for the instance
provenance items now carry themselves. Nothing replaces it on the contract:

```ts
export interface MediaSource {
  getMediaItems(): Promise<MediaItemSet>;   // items carry their own _sourceIds.providerId
  idOf(item: MediaItem): number | undefined; // provider-native id — what task.run() speaks
}
```

`idOf` stays: it is the projection actuator tasks and raw-DTO mapping need, and within one bound
instance it is unambiguous. It is no longer used as a *pool-wide* identity (§8).

### Provenance on normalized items

`NormalizedMovie._sourceIds` (`movie.ts`) and `NormalizedShow._sourceIds` (`show.ts`) each gain
`providerId?: number` (always set by the normalizers; optional in the type because enrichment-job
hydration builds group-level items with no instance — §5). `normalizeRadarrMovie(m, providerId)` /
`normalizeSonarrSeries(s, providerId)` (`normalizeMedia.ts`) take the instance id and also start
populating the logical keys they currently drop — `tmdb: m.tmdbId`, `imdb: m.imdbId` /
`tvdb: s.tvdbId`, `tmdb: s.tmdbId` — the prerequisite the display-grouping design named.

`sourceAdapters.ts` threads it: `radarrMediaSource(radarr, providerId)`,
`sonarrMediaSource(sonarr, providerId)`, `mediaSourceFor(provider, providerId)`. The `providerId`
comes from each call site's `MetadataProvider.id` (settings), not from the connection class —
`BaseProviderConnection`'s `ProviderConfig` deliberately has no id ("connection concerns, not a
metadata contract") and this design keeps that. Call sites: `AutomationExecutor.executeWithSources`
(`mediaSourceFor(source, providerSettings.id)`), `MediaSourceFactory` (§9), the browse handler's
inline sources (§8).

New helpers beside `MediaItem` (`mediaItem.ts`):

```ts
/** Provider-native id of a source-produced item. */
export function externalIdOf(item: MediaItem): number | undefined; // _sourceIds.radarr ?? _sourceIds.sonarr
/** Collision-free key for pooled matching: `${providerId}:${externalId}`. Internal map/set key,
 *  never an id that leaves the process. */
export function itemKey(item: MediaItem): string | undefined;
```

### `mergeEnrichment` (`server/modules/media/enrichmentMerge.ts`)

Signature loses both the type and the id-projection parameters — items self-describe:

```ts
export async function mergeEnrichment<T extends NormalizedMovie | NormalizedShow>(
  db: DrizzleDb,
  items: T[]
): Promise<void>
```

Implementation: collect `(providerId, externalId)` per item from `_sourceIds`; group by `providerId`
(a browse batch can span instances); per provider,
`SELECT mediaItems WHERE providerId = ? AND externalId IN (…)`; join
`media_enrichment ON mediaIdentityId`; build a `Map<itemKey, enrichmentRow>`; copy the canonical
columns onto items exactly as today. Two items from two instances that share a group correctly read
the *same* group-level enrichment — that is the model, not a bug: watched-ness is a fact about the
title. No instance-attribution ambiguity remains because attribution is a relational join through
`media_item`, not a type-string equality.

Caller updates: `MediaQueryEngine.evaluate` calls `mergeEnrichment(this.db, items)` — the
`source.enrichmentSourceType` / `source.idOf` arguments disappear.

---

## 5. The enrichment job's grouping key

`EnrichmentJob` (`server/modules/media/enrichmentJob.ts`) stays a group-level job — it enumerates
`media_identity` (unchanged `FROM media_identity LEFT JOIN media_enrichment`), and that is *more*
correct under the new model, not less: enrichment is title-level, so the job's unit of work is the
group, and multi-instance adds zero fan-out here (`EnrichmentJobFactory` reads only
TAUTULLI/OVERSEERR/PLEX/TMDB, all still under the single-active invariant).

Two changes:

- **`hydrate(identity)`** stops synthesizing `ids.radarr`/`ids.sonarr` (the columns are gone; no
  enricher ever matched on them — verified in `enricherAdapters.ts`) and instead builds
  `{ identity: identity.id, tmdb?, tvdb?, tvmaze?, plex?, imdb? }`, adding an `identity?: number`
  key to the `_sourceIds` type.
- **`identityKey(item)`** stays `JSON.stringify(item._sourceIds)` but is now collision-free *by
  construction*: the group's surrogate id is in the bag. Without it, two kind-scoped groups sharing a
  numeric `tmdbId` (movie 603 vs. tv 603) would hydrate to identical `_sourceIds` and collide in
  `resolvePrecedence`'s grouping — the exact class of bug this design exists to kill. Enrichers
  ignore keys they don't speak, so the extra key is inert to them.

No instance axis is needed in this key — the job never touches per-instance items. The earlier
spec's worry ("`_sourceIds` needs an instance dimension") dissolves: instance provenance lives on
*source-produced* items (§4); *group-hydrated* items are keyed by the group itself.

---

## 6. Role-membership authority and `assertNoActiveConflict`

### Where the one authority lives: `server/modules/providers/roles.ts`

The `OWNER_TYPE`-in-media vs. `isMediaActuator`-in-providers asymmetry is resolved by splitting what
was conflated — **role membership** (a fact about provider types/instances) from **role contract**
(a port that names `MediaItem`):

- **Membership facts live providers-side, in `roles.ts`** — the existing role-vocabulary home.
  `MediaActuator` membership is already declared there (instance-level, duck-typed via
  `isMediaActuator`, because actuator tasks are capabilities of a *constructed instance* carrying
  runners). `MediaSource` membership joins it as declared data, because catalog ownership must be
  known *before* any instance exists — at settings-validation time and at content-type routing time:

  ```ts
  // roles.ts additions
  export type MediaKind = 'movie' | 'show';

  /** The single authority for MediaSource role membership: which provider type owns
   *  which media kind's catalog. Every other surface derives from this map. */
  export const SOURCE_OWNER_BY_KIND: Record<MediaKind, MetadataProviderType> = {
    movie: MetadataProviderType.RADARR,
    show: MetadataProviderType.SONARR,
  };

  export function isMediaSourceType(type: MetadataProviderType): boolean {
    return Object.values(SOURCE_OWNER_BY_KIND).includes(type);
  }
  export function kindOfSourceType(type: MetadataProviderType): MediaKind | undefined { … }
  ```

  Exported through `providers/index.ts`. The two membership checks are deliberately *differently
  shaped* (instance predicate vs. type map) because they answer differently-shaped questions; what is
  now symmetric is their home and ownership.

- **The `MediaSource` contract and its adapters stay media-owned**
  (`modules/media/mediaSource.ts`, `sourceAdapters.ts`) — they name `MediaItem`, and the North Star's
  exception-free `media → providers` direction (fracture ledger, "North Star exception" entry) is
  exactly why they cannot move. The contract *derives from* the membership fact; it is not a second
  copy of it.

Consequences, so there is exactly one authority:

- `OWNER_TYPE` in `media/mediaSourceFactory.ts` is **deleted**; `MediaSourceFactory` and
  `sourceOwnership()` import `SOURCE_OWNER_BY_KIND` (a legal `media → providers` value import). The
  wire projection (`GET /api/media/sources`) is unchanged in meaning — the healed "MediaSource
  ownership vocabulary" ledger entry's guarantee (client derives, never re-declares) is preserved;
  only the authority's home moves one module down the allowed direction.
- `ContentType` in `media/filterRegistry.ts` becomes `export type ContentType = MediaKind` (type
  alias, single vocabulary, no translator). Every existing `ContentType` consumer — `mediaQueries`,
  the client — is untouched; media keeps re-exporting the name.
- Why not DI-inject a media-owned predicate into `ProviderSettingsService` instead? Because the fact
  isn't media's: "Radarr instances own the movie catalog" is a statement about the provider system,
  the same species as "Radarr is an actuator" (declared on the connection class, providers-side).
  Injection would also make provider-settings *validity* depend on media-module wiring — a hidden
  runtime edge the dependency graph can't see, which is worse than the explicit, CI-checkable import
  this design uses. And the identity job (providers-side) independently needs `kind` and the owner
  map for its grouping key — the authority's consumers are majority-providers-side.

### `assertNoActiveConflict` (`server/modules/providers/providerSettingsService.ts`)

```ts
private async assertNoActiveConflict(type: MetadataProviderType, excludeId?: number): Promise<void> {
  if (isMediaSourceType(type)) return; // MediaSource role: any number of active instances
  …existing check unchanged…
}
```

Role-scoped, not type-hardcoded — a type graduating into the source role (Plex, per the intent doc's
forward-compatibility section) inherits multi-instance by editing only the authority map. Non-source
types (TMDB, Overseerr, Plex-as-enricher, Tautulli, Jellyfin) keep the invariant and its
`ValidationError`. The D8 comment is updated to state the role scoping.

---

## 7. `ProviderFactory` / `ProviderSet`

`server/modules/providers/providerFactory.ts`:

```ts
export interface ProviderInstance<T extends AnyProvider = AnyProvider> {
  settings: MetadataProvider; // settings.id is the providerId
  provider: T;
}

/** Construct every provider, one entry per configured instance. Never collapses. */
createInstances(providers: MetadataProvider[], logger: Logger): ProviderInstance[] {
  return providers.map((settings) => ({ settings, provider: this.create(settings, logger) }));
}
```

`ProviderSet` **loses its `radarr` and `sonarr` slots** — the type dimensions to only what the
single-active invariant still guarantees is singular (`plex`, `tautulli`, `overseerr`, `tmdb`), and
`createMany` drops its Radarr/Sonarr branches. This is the structural fix for
collapsing-to-one-slot: after this change the type system cannot express "the Radarr instance" at
all, so no future consumer can silently reintroduce last-one-wins. The two `createMany` consumers:

- `IdentityJobFactory` — moves to `createInstances` (§3).
- `EnrichmentJobFactory` (`media/enrichmentJobFactory.ts`) — unchanged: it destructures only
  `{ tautulli, overseerr, plex, tmdb }`, all still legitimately singular.

`media.handler.ts`'s browse fetchers already loop `findActiveByTypes` results and call
`factory.create` per instance — they never used `createMany` and need only the provenance changes of
§8.

---

## 8. Browse/query matching and library display dedup

### Collision-free matching (`mediaQueryEngine.ts`)

`MediaQueryEngine.combine` stops using `source.idOf` as the pool identity and keys on
`itemKey(item)` (`${providerId}:${externalId}`, §4). `combinationEvaluator.ts` already accepts
`ItemId = number | string` — no change there. `evaluate` keeps its single-`source` shape; the
per-entry provider gate (§10) is added to the predicate loop in `matchItems`:

```ts
filterValues.every((entry) => {
  const rule = getRule(entry.key, contentType);
  if (!rule) return true;
  if (entry.providerId !== undefined && item._sourceIds.providerId !== entry.providerId) return false;
  return rule.predicate(item, entry.value);
})
```

(A provider-qualified entry is a claim about one instance's namespace; an item from another instance
cannot satisfy it, so it fails — it does not pass-through.)

### Browse handler (`media.handler.ts`)

- `getMovies()`/`getSeries()` caches become per-instance sublists:
  `Array<{ providerId: number; providerName: string; movies: RadarrMovie[] }>` (resp. `series`),
  preserving the existing per-provider error aggregation. `yearRange` computes over the flattened
  set as today.
- The inline `MediaSource` normalizes with provenance:
  `getMediaItems: async () => sublists.flatMap(({ providerId, movies }) => movies.map((m) => normalizeRadarrMovie(m, providerId)))`.
- Raw-row recovery switches from `matchedIds.has(m.id)` to a `Set` of `itemKey`s, matching raw rows
  as `(sublist.providerId, m.id)` pairs — colliding raw ids across instances are now distinct by
  construction.
- **Display dedup** (adopting the recovered "Library-view display grouping" decision wholesale):
  after sort, group the matched raw rows by the native primary id — `m.tmdbId` (movies) /
  `s.tvdbId` (series), fallback grouping key `${providerId}:${id}` (an item with no primary id is its
  own row) — computed live per request over provider data, no DB join, no dependency on the identity
  job having run, same key the auto-resolver uses so view and persistence agree by construction.
  - **Filter semantics: ANY** — grouping happens *after* engine matching, so a title appears if at
    least one of its copies matched ("do I have this in 4k?" works, subject to §10's qualification).
  - **Row composition: representative + badge** — the representative is the first matched copy in
    the current sort order; the row gains additive fields `sourceCount: number` and
    `sourceProviderIds: number[]` (the matched copies collapsed into it). Cross-copy aggregation
    (sum `sizeOnDisk`, union tags, …) stays deferred exactly as the recovered doc decided — with one
    instance every group is a singleton, so today's rows are byte-identical apart from the additive
    fields.
  - Pagination and totals operate on grouped rows.
- Option catalogs gain provenance (feeds §10's UI): `listTags` / `listQualityProfiles` decorate each
  element with `{ providerId, providerName }`. `listSources`' `MediaSourceDescriptor` gains
  `instances: Array<{ id: number; name: string }>` (from `providerSettingsService.list()`), so the
  client can label per-instance options and know when qualification is needed. All additive.

---

## 9. Saved-query instance binding

**Decision: saved queries stay instance-agnostic; binding lives where action lives.** A
`MediaQueryRecord` is a reusable *spec* (`contentType` + `filterValues`) — the schema already says so
structurally: `automation_query_sources` exists to let multiple automations share one query, and the
canonical multi-instance workflow ("same query, 4k and non-4k automations") depends on that sharing.
Binding a `providerId` onto the query row would make the primary use-case impossible without
duplicating every query per instance, and would create the second competing instance-reference the
constraints forbid. `automations.providerId` remains the *only* targeting binding, unchanged —
mirroring the documented `AutomationExecutor` pattern is achieved by *keeping* the binding there, not
copying it.

**Preview** (`GET /media-queries/:id/preview`, `mediaQueries.handler.ts`) becomes a fan-out read:

- `MediaSourceFactory.forContentType` is **replaced** by
  `sourcesFor(contentType): Promise<Array<{ providerId: number; name: string; source: MediaSource }>>`
  — `findActiveByTypes([SOURCE_OWNER_BY_KIND[contentType]])`, one constructed
  `mediaSourceFor(provider, settings.id)` per active instance. (`forContentType`'s only caller is
  this preview, so nothing else moves.)
- The handler evaluates the spec once per instance and returns
  `{ count, instances: [{ providerId, name, count }] }` where `count` is the sum of per-instance
  match counts — item counts, not deduped title counts, because preview answers "how many items would
  this spec act on", and action is per-item. With zero instances: `{ count: 0, instances: [] }`
  (today's `if (!source) return { count: 0 }` generalized). With one instance the count is
  bit-identical to today and `instances` is a length-1 additive field.
- `MediaQuery`/`MediaQuerySpec` in `mediaQueryEngine.ts` are unchanged in shape — the engine stays
  single-source-per-evaluate; fan-out is the caller's loop, consistent with the executor and browse.

The earlier spec's demanded "clear signal instead of a silent guess" is satisfied by construction:
nothing picks an arbitrary instance; the response names every instance it evaluated.

---

## 10. Per-instance filter-value semantics

**The class:** rules whose values are provider-*defined* id spaces — `qualityProfileIds` and `tagIds`
(both content-type variants in `filterRegistry.ts`). A profile id is minted by one instance;
`genres`/`certification`/`network` (strings) and everything numeric-measured are universal and
untouched.

**Decision: instance-qualified by data, enforced in the engine — not excluded, not encoded into id
strings.**

- `MediaRule` gains `instanceScoped?: boolean`, set `true` on the four rules above. It flows into
  `MediaRuleDescriptor` automatically (the `Omit` keeps it), so the client learns the class from the
  registry projection — no client-side list, per the Phase-4 healing.
- `FilterValueEntry` (`filterRegistry.ts`) gains `providerId?: number`. Persisted via
  `media_query_filter_values.providerId` (§1.1); `mediaQueryService` reads/writes it;
  `mediaQuerySchemas.create` accepts it per entry.
- Semantics (implemented as the single gate in `matchItems`, §8):
  - **Unqualified entry (`providerId` undefined)** — today's behavior exactly: the native id is
    interpreted in each item's own instance namespace. This is *correct* whenever evaluation is bound
    to one instance — i.e. every automation (bound via `automations.providerId`) and every
    single-instance deployment. All existing saved values keep working unchanged.
  - **Qualified entry** — matches only items whose `_sourceIds.providerId` equals the entry's. This
    is what makes cross-instance browse honest: "quality profile = *4k-Radarr's* profile 5" can never
    silently match non-4k-Radarr's unrelated profile 5.
- UI: when more than one active instance of a rule's source type exists, the filter bar renders
  instance-scoped rules' options grouped per instance (provenance from §8's decorated
  `listQualityProfiles`/`listTags` + `listSources.instances`) and emits qualified entries. With one
  instance it emits unqualified entries — the wire traffic of today's deployments is unchanged.
- **Misconfiguration surfaces through `QueryHealth`, not silence** (`mediaQueryService.ts`'s existing
  `computeHealth`): two new degradation reasons — an entry qualified to a `providerId` that is not an
  active instance (including post-`SET NULL` dangles, which arrive as unqualified entries on an
  instance-scoped rule while multiple instances are active), and, on the automation surface, an entry
  qualified to a provider other than the automation's own `providerId` (which by the gate above
  matches nothing).

**On the competing-instance-reference guardrail:** `FilterValueEntry.providerId` is *predicate data
qualification* — "which namespace does this id belong to" — not *targeting*. `automations.providerId`
remains the only construct that answers "which instance does this action run against". They are
different questions; the alternatives (a `providerId:id` composite string inside `value`, which is
Brief B's rejected ref smuggled into filter values, or banning these filters cross-instance, which
contradicts the display-grouping design's own motivating example "do I have this in 4k?") are both
worse. This is the explicit resolution of the tension between item 8's ANY-dedup browse and this
item: the browse *keeps* instance-scoped filters, and qualification is what makes that sound.

---

## 11. Task targeting for automations

**Confirmed unchanged — the recovered doc's decision holds under this model, and the model makes it
cleaner.** An automation binds one `providerId`; `AutomationExecutor.executeWithSources` builds that
one provider, wraps it (`mediaSourceFor(source, providerSettings.id)` — the only executor change),
evaluates, projects `mediaSource.idOf(item)` (provider-native ids, single namespace, exactly what
`task.run(ids)` speaks), and runs the task. No group-level fan-out: the group (`media_identity`) is a
display/enrichment/correction construct, never a routing one. Running one query against the 4k and
non-4k instance is two automations sharing the query record (§9). Enrichment predicates in an
automation's query (watched, requested) read group-level facts through the §4 join — title-level by
design, so a "watched" fact from Plex correctly gates *both* instances' automations.

---

## Guardrail check

- **One authority:** `SOURCE_OWNER_BY_KIND`/`isMediaSourceType`/`kindOfSourceType` in
  `providers/roles.ts` is the sole membership/ownership fact; `OWNER_TYPE` is deleted, media derives,
  `sourceOwnership()` projects, the invariant checks it, the identity job's per-kind grouping reads
  it. No second list anywhere.
- **No `providers → media` import:** providers gains only self-owned concepts (`MediaKind`, the owner
  map, `media_item` writes via `@server/database/schema`). Media's derivations are `media →
  providers`, the declared direction; dependency-cruiser stays green with zero rule changes.
- **Single-instance behavior preserved:** every read path returns today's data for zero-or-one
  instance — migration is 1:1 group-per-item, browse groups are singletons, preview count is
  identical, unqualified filter entries behave exactly as now, `createMany` consumers that remain are
  untouched. New response fields are strictly additive.
- **No second instance-reference:** `automations.providerId` remains the only targeting binding
  (§9, §11); `FilterValueEntry.providerId` is namespace qualification, argued in §10.

## Implementation order (phasing, not scope reduction)

1. **Authority + factory surface** — `roles.ts` additions; delete `OWNER_TYPE` (media derives);
   `ContentType = MediaKind`; `ProviderInstance`/`createInstances`; slim `ProviderSet`. No behavior
   change (invariant still global).
2. **Schema + migration** — `0014` split, `0015` filter-value column; drizzle schema; `resolveGroup`.
3. **Identity job** — instance loop, upsert-on-`(providerId, externalId)`, prune, kind-scoped Plex
   stamp, orphan sweep.
4. **Enrichment paths** — `hydrate`/`identityKey` re-key; provenance on normalizers/adapters/
   `_sourceIds`; `mergeEnrichment` rewrite; `MediaSource` contract change; engine `itemKey` matching;
   executor's two-line adaptation.
5. **Preview fan-out** — `MediaSourceFactory.sourcesFor`, preview handler + response.
6. **Relax the invariant** — the `isMediaSourceType` early-return in `assertNoActiveConflict` ships
   *only after 2–5*, since it is the switch that makes a second instance reachable.
7. **Browse dedup + filter qualification** — per-instance sublists, grouped rows, decorated option
   catalogs, `instanceScoped`/`FilterValueEntry.providerId`, `matchItems` gate, `QueryHealth`
   reasons, client filter bar + badges (Ladle story first, per repo convention).
8. **Docs lifecycle** — when this ships: delete this file; trim
   `docs/intent/provider-media-identity-model.md` to its still-open remainder (open `MediaItem` field
   shape, derived rule gating, provider-depends-on-provider) — the entity model, multi-instance, and
   grouping sections are then *built* and belong in `docs/architecture/` as fresh prose; update
   `media-query-engine.md` ("Current invariant" and the preview row), `provider-roles-and-identity.md`
   (limitation 1, the identity-model section), `media-enricher-role.md` (hydration/key paragraphs),
   `VOCABULARY.md` (`MediaSource` contract, `media_item`), and re-check every doc `grep -rl` hit for
   `OWNER_TYPE`, `enrichmentSourceType`, `sourceType`, `forContentType` per the docs convention.
