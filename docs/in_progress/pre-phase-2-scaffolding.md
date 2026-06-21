# Pre-Phase-2 — Source-of-truth scaffolding

**Status:** Strand 1 SHIPPED · Strand 2 DEFERRED — scaffolding between **Phase 1** (shipped:
`docs/architecture/media-query-engine.md`) and **Phase 2** (shipped:
`phase-2-actuator-role-and-task-manifest.md`). TDD (backend). **Depends on:** Phase 1.

**Strand 1 shipped:** `MediaSource` read role (`server/providers/mediaSource.ts`) on Radarr/Sonarr;
`MediaQueryEngine` evaluates through `source` on a single path (movie/show branch gone); the four
`MediaItemSet` id-projection casts collapsed to `source.idOf`; `MediaSourceFactory.forContentType`
resolves a content type to its active owner source (consumed by preview; browse keeps its raw-list
source for pagination). **Strand 2 (MediaQuery / SavedMediaQuery ubiquitous language) is deferred** to
a later pass — the engine seam Phase 2 needed is delivered by Strand 1.

This is a **source-of-truth refactor**, not a feature. It closes two naming/ownership fractures the
engine exposed, so Phase 2 lands on clean ground. It is deliberately **incremental** — the blast radius
on complexity is paid down as we go, never big-bang. Behaviour is preserved at every step; existing tests
are the guards.

## Why before Phase 2

Phase 2 *declares* `MediaSource` / `MetadataEnricher` / `MediaActuator` as type-level `implements`
clauses whose only observable proof is the actuator manifest. It never defines the **MediaSource read
contract** nor wires the engine to it. Doing that read-side extraction first means:

- Phase 2's `class RadarrProvider implements MediaSource` satisfies a **real** contract, not a marker.
- Phase 2 shrinks to the actuator/manifest concern only (its genuine subject).
- The engine's two known design-debts (the `movie`/`show` branch and the `MediaItemSet` narrowing
  casts) close here, where they belong, instead of leaking into Phase 2.

---

## Strand 1 — MediaSource read role (kills the engine branch + the `MediaItemSet` casts)

### Model

`MediaSource` is the role from `docs/intent/system-roles-and-capabilities.md`. Its **read contract**
(undefined by Phase 2) is:

```ts
interface MediaSource {
  getMediaItems(): Promise<MediaItemSet>;          // already normalized
  idOf(item: NormalizedMovie | NormalizedShow): number | undefined;
  readonly enrichmentSourceType: 'RADARR' | 'SONARR';
}
```

Method names are **role-named** — a source advertises "media items", not `getMovies`/`getSeries`.
`RadarrProvider` serves movies, `SonarrProvider` serves shows, but the engine never sees that.

### What it removes

With `idOf` and `enrichmentSourceType` on the source, `MediaQueryEngine.evaluate` collapses to **one
path** — `contentType` becomes only the `matchItems` registry key:

```ts
const items = await query.source.getMediaItems();
if (db) await mergeEnrichment(db, items, query.source.enrichmentSourceType, query.source.idOf);
return this.combine(items, query.sources, query.contentType, query.source.idOf);
```

The four `MediaItemSet` casts are **id-projection casts** (`(matched as NormalizedMovie[]).map(m =>
m._sourceIds.radarr!)`). They exist only because the union element's id key differs per variant. `idOf`
is the polymorphic answer, so **all four disappear** — and `MediaItemSet` itself stays a union (no
generic `evaluate<C>` machinery needed). Cast sites: `automationExecutor.ts:143,151`,
`media.handler.ts:272,294`, plus the engine test helper. Same `idOf` removes both the branch and the casts.

### Seams (verified this session)

- `MediaQuery.provider` → rename to `source: MediaSource` (`server/services/mediaQueryEngine.ts`).
- `radarrProvider.ts` / `sonarrProvider.ts` — add `getMediaItems`/`idOf`/`enrichmentSourceType`.
  `getMediaItems` delegates to the existing `getMovies()`/`getSeries()` + `normalize*Media`. **Keep
  `getMovies`/`getSeries`** — `identityResolutionJob.ts:71,117`, `providers.handler.ts:42,53`, and the
  internal `unmonitor*` (`radarrProvider.ts:88`, `sonarrProvider.ts:97`) still call them. The change is
  additive.
- `normalizeRadarrMovie`/`normalizeSonarrSeries` (`providers/normalizeMedia.ts`) have **only the engine
  and the browse adapter** as non-test callers — cheap to move behind the source.
- `_sourceIds.radarr|.sonarr` — 8 non-test sites, all in engine/executor/handler; replaced by `idOf`.
- **`MediaSourceFactory.forContentType(contentType): Promise<MediaSource>`** — consolidates the preview
  handler's `OWNER_TYPE` map + `findActiveByTypes` + `factory.create`. Used by **preview and browse**.
  The **executor does not use it** — it binds a specific provider by `automation.provider.id` and passes
  that concrete instance as `MediaSource` (it needs the actuator role on the same object for `task.run`).

### Browse nuance (do not lose)

`media.handler` caches **raw** `RadarrMovie[]`/`SonarrSeries[]` for `yearRange`, sort, and pagination,
then maps the engine's id set back onto that raw list. So the browse `MediaSource` wraps the cached raw
list: `getMediaItems = () => all.map(normalize…)`, `idOf` projects back to the raw `.id`. Pagination/sort
stay on raw. Don't try to display the normalized items.

### Cycles (incremental, mostly refactor-under-guard)

1. **MediaSource on the concretes** — add the three members to Radarr/Sonarr; `getMediaItems` delegates.
   Guard: provider tests + everything green (additive). *No fresh behaviour.*
2. **Engine consumes `source`** — rename `MediaQuery.provider → source`; collapse the branch; use
   `idOf`/`enrichmentSourceType`. Guard: engine + executor + browse + preview tests. Update mocks
   (`getMovies`→`getMediaItems`, ~15 sites). Removes the engine branch.
3. **Drop the casts at call sites** — executor (143/151) and browse (272/294) use `source.idOf`. Guard:
   same suites.
4. **`forContentType` factory** — introduce it; rewrite preview + browse to resolve their source through
   it. Guard: preview integration + browse integration.

`BaseMetadataProvider` → connection/HTTP-base **rename is left to Phase 2** (it owns that REFACTOR); this
strand doesn't touch it.

---

## Strand 2 — `MediaQuery` / `SavedMediaQuery` ubiquitous language

### The fracture

The graph names the type `MediaQuery`; the code says `savedQuery` / `savedFilter` / `SavedQueryDto`
interchangeably. One concept, three names → the same fracture Phase 1 healed at the behaviour level,
unhealed at the language level. Fix the words so the client phases (Phase 4) inherit one vocabulary.

### Model (three precise nouns)

```ts
// The persistable, source-less core — what a filter view builds and what a row stores.
type MediaQuerySpec = { contentType: ContentType; sources: MediaQuerySource[] };

// Evaluatable: a spec bound to a source. The engine's input. (Strand 1.)
type MediaQuery = MediaQuerySpec & { source: MediaSource };

// Persisted: a spec with a DB identity + presentation metadata.
type SavedMediaQuery = MediaQuerySpec & { id: number; name: string; health: QueryHealth; createdAt: string };
```

The user's framing, made exact: **a `SavedMediaQuery` is a `MediaQuery` with a database row id** — the
*functional shape is the same* (`MediaQuerySpec`). The only real difference at rest is that a saved query
has **no bound source**; the engine binds one via `forContentType` at evaluate time. That binding is the
sole reason "saved" and "evaluatable" are distinct types rather than one.

Today's `SavedQueryDto.filterValues: FilterValueEntry[]` is the single-include-source sugar
(`sources: [{ filterValues, role: 'include' }]`). Keep `filterValues` as a convenience accessor during
migration; lead with `sources`.

### Migration order (pay complexity down as we go — do NOT big-bang)

1. **Types first** — `SavedQueryDto → SavedMediaQuery`, introduce `MediaQuerySpec`; alias the old name so
   imports don't break in one commit.
2. **Service/handler/module names** — `SavedQueryService` → `SavedMediaQueryService` (or
   `MediaQueryStore`), `modules/savedQueries` → `modules/mediaQueries`. Mechanical; one rename per commit.
3. **Routes** — `/saved-queries` → `/media-queries` (keep a redirect/alias until Phase 4 client lands).
4. **DB tables last** — `savedQueries`/`savedQueryFilterValues` are the heaviest (migration + data); only
   when 1–3 are settled. May defer past Phase 2 entirely if cost outweighs value.

**Ubiquitous-language rule going forward:** the type is `MediaQuery`; the persisted one is
`SavedMediaQuery`; the source-less core is `MediaQuerySpec`. Stop writing `savedFilter`/`savedQuery` in
new code and comments.

### Relationship to Strand 1

Strand 1 gives `MediaQuery` its `source`; Strand 2 names the source-less core (`MediaQuerySpec`) that
both `MediaQuery` and `SavedMediaQuery` share. Do **Strand 1 first** — it's the engine seam and unblocks
the cleaner Phase 2 `MediaSource`. Strand 2 is naming and can run partly in parallel / be deferred at the
DB layer.

---

## Adjustment made to Phase 2

`phase-2-actuator-role-and-task-manifest.md` previously implied `MediaSource` is introduced *with* the
actuator roles as a type-level marker. Edited so Phase 2 treats `MediaSource` as **already extracted and
consumed here**, and introduces only `MetadataEnricher` / `MediaActuator` (+ the `BaseMetadataProvider`
rename). No other Phase 2 content changed.

## Gates

`yarn test`, `yarn typecheck:server`, `yarn lint` green at every cycle. `graphify update .` at the end.
On completion: move the durable MediaSource read-contract note into `docs/architecture/` (extend
`provider-roles-and-identity.md` or the media-query-engine doc) and delete this file.

## Out of scope

- The actuator manifest, `taskId` validation, the `BaseMetadataProvider` rename — **Phase 2**.
- The `media_item` migration (`docs/intent/provider-source-model.md`) — lands into `MediaItemSet` later;
  it will collapse `idOf` to `item.id`.
- Any client change — **Phase 4** consumes the new vocabulary and routes.
