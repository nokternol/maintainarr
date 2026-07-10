# Provider/media boundary redesign — providers stop speaking MediaItem

**Status:** proposal, not yet a phase. Supersedes the Finding-1 conclusion of
`docs/plans/module-import-boundary-fixes.md` (see §8). Written 2026-07-10 against the live tree.

## 1. Current coupling, precisely traced

`grep -rn "modules/media" server/modules/providers --include="*.ts"` (non-test) finds **11 files**
importing from media, not the 2 the North Star sanctions:

| File | Imports from media | Why |
|---|---|---|
| `server/modules/providers/mediaSource.ts` | `MediaItem`, `MediaItemSet` | the `MediaSource` contract names them (`getMediaItems(): Promise<MediaItemSet>`, `idOf(item: MediaItem)`) |
| `server/modules/providers/roles.ts` | `MediaItem` | `MediaEnricher<TField>.enrich(items: MediaItem[])`; `EnrichmentResult.items: (MediaItem & Pick<MediaItem, TField>)[]` |
| `connections/radarrProvider.ts` | `MediaItem`, `MediaItemSet`, `normalizeRadarrMovie` (a **value** import) | implements `MediaSource`: `getMediaItems()` = `(await this.getMovies()).map(normalizeRadarrMovie)`; `idOf` reads `_sourceIds.radarr` |
| `connections/sonarrProvider.ts` | `MediaItem`, `MediaItemSet`, `normalizeSonarrSeries` | same shape, via `getSeries()` |
| `connections/plexProvider.ts` | `MediaItem` | implements `MediaEnricher<'playCount'|'lastWatchedAt'>`: `enrich` = `decorate(items, i => i._sourceIds.plex, mapPlexItems(await this.getAllItems()))` |
| `connections/tautulliProvider.ts` | `MediaItem` | same, via `getHistory()` + `mapTautulliHistory` |
| `connections/overseerrProvider.ts` | `MediaItem` | same, via `getRequests()`/`getIssues()` + `mapOverseerr` |
| `connections/tmdbProvider.ts` | `MediaItem` | `enrich` loops items, dedupes `_sourceIds.tmdb`, calls its own `getStatus(tmdbId)` per id, then `decorate` |
| `enrichment/decorate.ts` | `MediaItem` | pure join: `(items: MediaItem[], keyOf, fieldsByKey: Map<K, Partial<MediaItem>>) => MediaItem[]` — merges provider fields onto canonical items |
| `enrichment/mappers.ts` | `MediaItem` | pure translators producing `Map<key, Pick<MediaItem, ...>>` from provider DTOs (`TautulliHistoryItem`, `PlexMediaItem`, `OverseerrRequest/Issue`) |
| `mediaSourceFactory.ts` | `ContentType` (from `filterRegistry.ts`) | keys `OWNER_TYPE: Record<ContentType, MetadataProviderType>` and types `forContentType()` — with an in-file comment admitting the index import would be circular |

Who actually *consumes* the role contracts (graph-verified):

- `MediaSource` (graphify degree 13): implemented by `RadarrProvider`/`SonarrProvider`; consumed by
  **media's** `mediaQueryEngine.ts` (`evaluate({ source })` reads `getMediaItems()`,
  `enrichmentSourceType`, `idOf`), by providers' own `mediaSourceFactory.ts` (which **casts**
  `providerFactory.create(settings) as MediaSource`), by `mediaQueries.handler.ts` (preview:
  `mediaSourceFactory.forContentType(query.contentType)` → engine), and by
  `automations/automationExecutor.ts` (casts `providerFactory.create(...) as RadarrProvider |
  SonarrProvider`, uses it simultaneously as source, actuator, and id-projector).
- `MediaEnricher` (degree 14): implemented by the four enricher connections; consumed **only** by
  media's `enrichmentJob.ts`. The instances are constructed by media's `enrichmentJobFactory.ts`
  (`providerFactory.createMany(...)` → `ProviderSet` slots used directly as enrichers).
- `EnrichmentResult` (providers-owned) is consumed by media's `enrichment/precedence.ts`
  (`resolvePrecedence`) and `enrichmentJob.ts` — a providers-owned type whose only real consumers
  are media internals.
- `sourceOwnership()` (degree 2 in the graph beyond its own file): one consumer,
  `media.handler.ts:435` (`GET /api/media/sources`) — media reaching into providers for a
  projection of a content-type-keyed map.

Two facts that shape the whole design:

1. **Every role method on every provider is a thin composition of (a) a native method the class
   already exposes and (b) a media-shaped translator.** `getMediaItems` = `getMovies()` +
   `normalizeRadarrMovie` (media-owned); `enrich` = `getHistory()/getAllItems()/getRequests()` +
   `mappers` + `decorate` (media-*shaped*, providers-housed). The role methods contain no
   provider knowledge that isn't already on the native surface, except "which native method and
   which `_sourceIds` key".
2. **Media already builds `MediaSource` adapters inline.** `media.handler.ts:305–345` wraps a raw
   `RadarrMovie[]`/`SonarrSeries[]` in an object literal `{ getMediaItems, idOf,
   enrichmentSourceType }` for the browse path. The proposed design is a generalization of code
   that already ships, not a new pattern.

## 2. The actual design tension

The North Star justified the exception as "a role contract has to name the shape it operates on."
True — but it follows that **the contract belongs to the module whose shape it names**.
`MediaSource`/`MediaEnricher` are media's *ports*: their vocabulary (`MediaItem`, `MediaItemSet`,
enrichable canonical fields) is media's, and their only consumers (`mediaQueryEngine`,
`enrichmentJob`) are media's. Housing the port in providers forces every implementer to import the
foreign vocabulary — that is what ballooned 2 sanctioned files into 11. The earlier spec's
diagnosis ("TypeScript needs the type to check an interface implementation") described the
mechanism, not the cause: TypeScript needs the type *because providers implement a contract that
names it*, and the contract names it because the port was placed in the implementer's module.

Moving the interface file alone doesn't fix this (providers implementing media's interface still
import media — same edge, different file), and `Pick<MediaItem, ...>` doesn't fix it (a `Pick` of
a foreign type still imports the foreign type). The coupling disappears only when **providers stop
implementing the media-facing roles at all** — when the thing that satisfies media's port is a
media-owned adapter over the provider's native surface.

## 3. Proposed design

**Providers own facts in their native vocabulary; media owns the ports, the adapters, and all
management of the resulting canonical data.**

Ownership after the change:

| Thing | Owner | Location |
|---|---|---|
| Native DTOs (`RadarrMovie`, `SonarrSeries`, `PlexMediaItem`, `TautulliHistoryItem`, `OverseerrRequest/Issue`, TMDB payloads) + native fetch methods (`getMovies`, `getSeries`, `getAllItems`, `getHistory`, `getRequests`, `getIssues`, `getStatus`) | providers | unchanged; already exported from `providers/index.ts` |
| `MediaActuator` / `ActuatorTask` / `modelledRun` | providers | `providers/roles.ts` (these never touch `MediaItem`) |
| `MediaSource` contract | **media** | `media/mediaSource.ts` (moved) |
| `MediaEnricher`, `EnrichableField`, `EnrichmentResult` contracts | **media** | `media/enrichment/enricher.ts` (moved out of `providers/roles.ts`) |
| `decorate()`, `mapPlexItems`, `mapTautulliHistory`, `mapOverseerr` | **media** | `media/enrichment/` beside `precedence.ts` (moved from `providers/enrichment/`) |
| Source adapters (new) | **media** | `media/sourceAdapters.ts` |
| Enricher adapters (new) | **media** | `media/enrichment/enricherAdapters.ts` |
| `MediaSourceFactory`, `OWNER_TYPE`, `sourceOwnership()` | **media** | `media/mediaSourceFactory.ts` (moved; registration moves from `providers.registrations.ts` to `media.registrations.ts`) |

A provider file afterward (signatures only):

```ts
// providers/connections/radarrProvider.ts — zero media imports
export class RadarrProvider extends BaseProviderConnection implements MediaActuator {
  getMovies(): Promise<RadarrMovie[]>;
  tasks(): ActuatorTask[];
  // getMediaItems / idOf / enrichmentSourceType deleted — they were the adapter, mishoused
}

// providers/connections/plexProvider.ts — zero media imports
export class PlexProvider extends BaseProviderConnection implements MediaActuator {
  getAllItems(): Promise<PlexMediaItem[]>;
  tasks(): ActuatorTask[];
  // enrich() deleted
}
```

The media-owned adapters (each a handful of lines — literally the inline object
`media.handler.ts` already builds):

```ts
// media/sourceAdapters.ts
export function radarrMediaSource(radarr: RadarrProvider): MediaSource;   // getMovies + normalizeRadarrMovie + _sourceIds.radarr
export function sonarrMediaSource(sonarr: SonarrProvider): MediaSource;   // getSeries + normalizeSonarrSeries + _sourceIds.sonarr
export function mediaSourceFor(p: RadarrProvider | SonarrProvider): MediaSource; // instanceof dispatch, for the executor

// media/enrichment/enricherAdapters.ts
export function plexEnricher(p: PlexProvider): MediaEnricher<'playCount' | 'lastWatchedAt'>;
export function tautulliEnricher(t: TautulliProvider): MediaEnricher<'playCount' | 'lastWatchedAt'>;
export function overseerrEnricher(o: OverseerrProvider): MediaEnricher<'overseerrRequestStatus' | 'overseerrHasIssue'>;
export function tmdbEnricher(t: TmdbProvider): MediaEnricher<'tmdbStatus'>;  // absorbs tmdbProvider.enrich's dedupe-and-loop; provider keeps getStatus(tmdbId)
```

Consumption changes:

- `enrichmentJobFactory.ts` (media): `createMany()` → wrap each `ProviderSet` slot in its adapter
  before handing `MediaEnricher[]` to `EnrichmentJob`. `enrichmentJob.ts` and `precedence.ts`
  import `MediaEnricher`/`EnrichmentResult` from within media instead of from `../providers`.
- `MediaSourceFactory.forContentType()` (now media): resolves settings via
  `providerSettingsService`, constructs via `providerFactory`, and **returns the adapter** —
  deleting today's unsound `as MediaSource` cast. `mediaQueries.handler.ts` changes one import
  (`@server/modules/providers` → `@server/modules/media`); its preview flow is otherwise untouched.
- `automationExecutor.ts` (automations): keeps the concrete `RadarrProvider | SonarrProvider` for
  the actuator role (`tasks()`, enablement), and binds `const source = mediaSourceFor(provider)`
  for evaluation and id projection (`source.idOf`). Both `automations → media` and
  `automations → providers` are sanctioned directions.
- `media.handler.ts` browse path: its two inline `MediaSource` literals can be replaced by (or
  share code with) the adapters — a dedupe, not a behavior change.
- `providers/index.ts`: drops `MediaSource`, `MediaEnricher`, `EnrichableField`,
  `EnrichmentResult`, `sourceOwnership`, `MediaSourceFactory`, `MediaSourceDescriptor` exports;
  keeps connection classes, native DTO types, `ProviderFactory`, `ProviderSettingsService`,
  `readEnabledTaskIds`, actuator vocabulary. (Its stale "until Phase 4" comment on the DTO
  exports finally becomes true documentation: the DTOs are exported *for media's translators*.)
- `media/index.ts`: additionally exports `MediaSource`, `MediaEnricher`, the adapters it wants
  public (`mediaSourceFor` for automations), `MediaSourceFactory`, `sourceOwnership`,
  `MediaSourceDescriptor`.

**The person's modeling question, answered directly:** provider domain entities already exist —
they are the native DTOs (`TautulliHistoryItem`, `PlexMediaItem`, `OverseerrRequest`, …), owned by
providers, expressing exactly what each provider knows, with no relationship to `MediaItem` at
all. The "subset of MediaItem" (`Pick<MediaItem, 'playCount' | 'lastWatchedAt'>`) is not a
property of the provider's entity — it is a property of **media's translation of it**, so the
`Pick` lives in media's mappers/adapters, where importing `MediaItem` is a same-module reference
and the compiler still checks the subset relationship against the real canonical shape. Providers
never model "a subset of MediaItem" because nothing on their side of the line needs to: the trap
("a `Pick` of a foreign type still imports the foreign type") is escaped by flipping who owns the
`Pick`, not by finding a cleverer way for providers to spell it.

Direction rule after this change: **`providers → media` has zero edges.** The North Star's
sanctioned-exception paragraph is deleted rather than widened; the boundary check Phase 8 wants
becomes a plain "no imports from `modules/media` under `modules/providers`" with no allowlist.

## 4. The `ContentType` / `sourceOwnership()` question — resolved

`OWNER_TYPE`, `sourceOwnership()`, and `MediaSourceFactory` move to media wholesale. "Which
provider type owns each content type" is media-catalog policy — it configures how media assembles
its canonical catalog from providers, and its key (`ContentType`) is media's own vocabulary while
its value (`MetadataProviderType`) is a database-schema enum any module may import. Its only
external consumer today is `media.handler.ts:435` (which becomes a same-module call) and
`mediaQueries.handler.ts` (which becomes a sanctioned `mediaQueries → media` import). This
resolves the question the earlier spec left open, and goes further than its recommended option (b)
(splitting the map between providers and media): no split is needed — the entire map was simply in
the wrong module, as its own circular-import comment was already hinting. The `media → providers`
imports the relocated factory needs (`ProviderSettingsService`, `IProviderFactory`) are the
sanctioned direction, and after §3 providers' index imports nothing from media, so no cycle is
possible.

## 5. "Separated from the management of resulting data" — where the line lands

Traced today: the merge/precedence pipeline is `enrich()` (providers) → `decorate()` (providers —
**merges provider fields onto canonical items**) → `resolvePrecedence()` + `ENRICHMENT_POLICY`
(media, write-time, per-field) → `EnrichmentJob` persistence (media) → `mergeEnrichment()`
read-time copy (media). The instinct is correct that the line is currently smudged at the front:
`decorate()` is canonical-data management (constructing decorated `MediaItem`s) living in
providers, and `EnrichmentResult` — a provenance vehicle that exists *only* so media's precedence
resolver can arbitrate — is providers-owned despite having no providers-side consumer. The
back half (precedence, persistence, read-merge) already lives where it belongs.

Under this design the line is exact: providers end at raw native facts; translation
(`mappers`), decoration (`decorate`), arbitration (`resolvePrecedence`), persistence
(`EnrichmentJob`), and read-merge (`mergeEnrichment`) are all media-owned. An optional later
refinement — narrowing `MediaEnricher` to return `{ provider, fieldsByKey: Map<LogicalKey,
Contribution> }` and letting the job decorate — would make "enrichers contribute facts keyed by
logical identity" literal in the type, but it changes a working runtime shape for no ownership
gain, so it is noted, not proposed.

## 6. Migration shape

Two phases, both behavior-preserving (gated by the existing suite per the ground rules):

**Phase A — the roles become media's ports (the 10 `MediaItem`-coupled files):**
1. Move contracts: `providers/mediaSource.ts` → `media/mediaSource.ts`; `MediaEnricher` /
   `EnrichableField` / `EnrichmentResult` out of `providers/roles.ts` into `media/enrichment/`.
   `providers/roles.ts` keeps only the actuator vocabulary.
2. Move `providers/enrichment/{decorate,mappers}.ts` → `media/enrichment/` (their `MediaItem`
   imports become local; their DTO imports come from `providers/index.ts`, sanctioned).
3. Add `media/sourceAdapters.ts` + `media/enrichment/enricherAdapters.ts`, lifting the bodies of
   the six connections' role methods verbatim.
4. Strip `implements MediaSource` / `implements MediaEnricher` and the role methods + media
   imports from the six connections.
5. Rewire consumers: `enrichmentJobFactory` (wrap in adapters), `mediaQueryEngine` /
   `enrichmentJob` / `precedence` (local imports), `automationExecutor` (`mediaSourceFor`),
   `media.handler` inline sources (share the adapters), both modules' `index.ts`, tests.

**Phase B — ownership policy comes home (the `ContentType` file):**
6. Move `mediaSourceFactory.ts` (class, `OWNER_TYPE`, `sourceOwnership`, `MediaSourceDescriptor`)
   to media; move its registration from `providers.registrations.ts` to `media.registrations.ts`;
   update `mediaQueries.handler.ts` and `media.handler.ts` imports.

Phase B is independent and could ship first, but A-then-B reads better (B's move is *justified* by
A deleting the exception). Doc updates ride with each phase: the North Star exception paragraph is
deleted (A), `docs/architecture/media-enricher-role.md`'s "the only outward type it imports is
`MediaItem`" and its wiring section are rewritten (A), `VOCABULARY.md`'s MediaItem entry loses the
exception note (A), and the fracture ledger gains the healed entry (A, B).

## 7. Alternatives considered and rejected

- **Doc-only patch (the previous spec's Finding-1 decision):** ratifies an 11-file boundary
  crossing as vocabulary instead of removing it; Phase 8 enforcement would need a permanent
  allowlist. Rejected — see §8.
- **Move the contracts to media, providers still implement them (imported or duck-typed):** the
  imported variant keeps the exact `providers → media` edge in every connection file; the
  duck-typed variant trades compile-time enforcement for invisible drift and still requires
  providers to *construct* canonical items (the `normalize*` value imports don't duck-type away).
  Rejected: relocating the port without relocating the implementation moves the file, not the
  coupling.
- **Generic contracts (`MediaSource<TItem>`, `MediaEnricher<TContribution>`) that providers
  implement without naming `MediaItem`:** each generic has exactly one real instantiation; the
  binding must still live somewhere (media), and enrichers would still need the `_sourceIds`
  join — canonical-identity knowledge — inside providers. Abstraction cost with no decoupling
  gain over plain media-owned adapters. Rejected.
- **Freestanding provider-owned "contribution entity" types (`RadarrCatalogEntry`,
  `PlexWatchFacts`) that media maps to `Partial<MediaItem>`:** the literal reading of the
  person's option 1. Rejected because those types already exist — they are the native DTOs — and
  inventing a renamed intermediate between DTO and `MediaItem` is precisely the
  translator-as-persisted-fracture the fracture ledger warns against.

## 8. Supersession note

**This proposal supersedes `docs/plans/module-import-boundary-fixes.md` Finding 1.** That spec
concluded the 8-file `MediaItem` coupling was "not a violation" and prescribed widening the North
Star's exception clause to cover role *implementations*. Under this design that conclusion is
reversed: the coupling was a symptom of the role contracts being housed in the implementer's
module, and the fix removes the exception entirely rather than documenting it wider. Finding 1's
open `ContentType` question is resolved by §4 (whole factory moves to media — beyond its
option (b)). Findings 2 (`MediaCache` → kernel, already shipped as `server/kernel/cache.ts`) and
3 (deep-import fix) are unaffected.
