# Phase 4 — Client derives the rule vocabulary (server-first)

**Status:** IN PROGRESS — Stage 1 (server) shipped 2026-07-05. Stage 2 (client) is broken into sub-stages
2a–2d (below); 2a shipped 2026-07-06, 2b–2d not started. Supersedes the earlier "client query alignment"
framing. TDD (server naming + projection, then client hooks) + `impeccable` (filter view visual).
**Depends on:** Phase 1 (engine + honest `/preview`).

**Stage 1 is done; this is the handoff to whoever picks up Stage 2 next.** Read the "Stage 2" section below
for what's left, and `docs/architecture/fracture-ledger.md`'s "Filter/rule vocabulary" entry for the as-built
state Stage 1 left behind (what changed, what's still Open, and why). One constraint carries real urgency:
**Stage 1 alone breaks saving any query with a bounded filter** — `useMediaQueries.ts`'s
`KEY_RENAMES`/`toFilterValues()` still emit the 8 pre-collapse keys (`yearMin`, `imdbRatingGte`, etc.) as
bare scalars, and the server no longer resolves them (`MediaQueryService.create()` now throws
`ValidationError` for any of the eight). Do not consider Stage 1 shippable to production on its own; Stage 2
needs to land before or together with it, not sometime after.

## The one thing not to get wrong

This is a **replacement, not a mapping.** The client's `FILTER_FIELDS` catalogue
(`src/hooks/useMediaFilters.ts`) is a *second vocabulary* for the server's rule catalogue — the same
two-designs-for-one-process fracture Phase 3 closed for tasks. The fix is to make the server rule catalogue
the single authority and have the client **derive** from it, exactly as Phase 3b made the client derive
its tasks. Do **not** build a `FilterState → MediaQuery source` translation between the two vocabularies —
that translator *is* the fracture (it is the analogue of the type-keyed `taskManifest` table Phase 3
deleted). If a step makes you map one key set onto another, the design is wrong — stop.

## The fracture (a renamed vocabulary duplicated in three live places)

The **match contract** is already single-authority: `FILTER_REGISTRY` (`server/utils/filterRegistry.ts`)
owns the predicates, keyed by `(key, contentType)` via `getFilterDef`; the engine matches via
`getFilterDef().apply`; persisted `filterValues` are `{ key, value }` under **registry keys**. There is no
parallel *predicate* table.

But a **renamed key vocabulary** for those same rules is duplicated across the boundary — and not only on
the client. The same rename lives in:

1. **Client** — `FILTER_FIELDS` (`src/hooks/useMediaFilters.ts`) declares the renamed keys and re-hardcodes
   each rule's `dataType`/content-type scope, minus `sourceProviders` (so no provider-gating client-side).
2. **Server browse handler** — `MOVIE_PARAM_TO_KEY` / `SERIES_PARAM_TO_KEY` + `toFilterValues`
   (`server/modules/media/media.handler.ts:90–156`) translate the renamed URL params back to registry keys
   before evaluation. This is the literal `taskManifest`-analogue: a translator bridging two designs for
   one process, living server-side.
3. **Migration** — `0007_query_model_rewrite.sql` rewrote already-persisted saved-query keys to registry
   keys (historical; leave it).

**A fourth, previously undocumented surface exists and must not be duplicated by Stage 1.**
`server/modules/filterFields/filterFields.handler.ts` (`getFilterFields`, routed at `GET /api/filter-fields`
via `filterFields.routes.ts`, mounted in `server/modules/index.ts`) already projects `FILTER_REGISTRY` to a
predicate-free shape (`{ key, label, dataType, contentTypes }`). It shipped in Phase 2c
(`356dd3f feat(phase-2c): query model rewrite + schema-driven API contracts`) — it predates this plan and was
missed when the table above was written, not built by an earlier Stage 1 attempt. It has its own integration
suite (`server/__tests__/integration/filterFields.integration.test.ts`) asserting today's un-gated,
un-collapsed shape (raw registry keys, e.g. `imdbRatingGte`), and **zero client consumers** — nothing calls
`GET /api/filter-fields` today. Stage 1 must **extend this endpoint/handler in place** (rename toward the
`MediaRule`/`MediaRuleDescriptor` vocabulary, add `sourceProviders` + provider-gating via
`providerSettingsService`, reflect the range collapse) rather than standing up a new descriptors endpoint
beside it — a second endpoint here would be exactly the fracture this phase exists to close. Its existing
integration test's key-based assertions (`imdbRatingGte`, `imdbRatingLte`, etc.) will need rewriting once the
range collapse lands, not merely left green.

**A fifth live surface, also previously undocumented:** `KEY_RENAMES` + `toFilterValues()` in
[`src/hooks/useMediaQueries.ts:21–52`](ref:path:src/hooks/useMediaQueries.ts) — a **second, independent
client-side translator**, distinct from `FILTER_FIELDS` itself, that maps `FilterState`/`FILTER_FIELDS` keys
back to registry keys (`radarrImdbRatingGte → imdbRatingGte`, `sonarrRatingGte → communityRatingGte`, etc.)
before `save()` persists a saved query via `POST /api/saved-queries`. It is the client-side mirror of the
server's `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` translator (#2 below) — same fracture, opposite
direction, and confusingly named identically (`toFilterValues`) to the one in `media.handler.ts`; don't
conflate them when tracing call sites. Deleting `FILTER_FIELDS` alone does not retire this: `KEY_RENAMES` and
`toFilterValues()` in `useMediaQueries.ts` must be deleted too once the client emits registry keys directly,
or the saved-query persistence path keeps a translator the browse path no longer has.

Phase 4 deletes #1 **and** #2: the client emits registry keys directly (per-page `contentType`
disambiguates what the `movie*`/`series*` prefixes worked around), so `toFilterValues` collapses to identity
and the `PARAM_TO_KEY` maps are removed. The renamed keys retired:

| Server `FILTER_REGISTRY` key | Client `FILTER_FIELDS` key |
|---|---|
| `watched` | `tautulliWatched` |
| `imdbRatingGte` / `imdbRatingLte` | `radarrImdbRatingGte` / `radarrImdbRatingLte` |
| `communityRatingGte` / `communityRatingLte` | `sonarrRatingGte` / `sonarrRatingLte` |
| `ended` | `sonarrEnded` |
| `lastAiredDaysAgoGte` / `lastAiredDaysAgoLte` | `sonarrLastAiredDaysAgoGte` / `…Lte` |
| `episodePercentageGte` / `episodePercentageLte` | `sonarrPercentEpisodesGte` / `…Lte` |
| `tagIds` / `genres` / `qualityProfileIds` | `movie*` / `series*` variants |

## Ubiquitous language (named here, applied across server + client + graph)

"Filter" is a UI word only — the `MediaFilterBar` composes inputs; the server and wire never "filter."
The server vocabulary is **rules** and **predicates**, mirroring Phase 3's task/run split:

| Concept | Type | Phase 3 analogue |
|---|---|---|
| The boolean logic that applies one value to one item | `Predicate<T> = (item: T, value: FilterValue) => boolean` | — |
| A declared, content-typed unit media can be constrained by | `MediaRule extends MediaRuleDescriptor { predicate: Predicate }` | `ActuatorTask` |
| Its JSON-honest transport projection (no `predicate`) | `MediaRuleDescriptor { key, label, contentTypes, dataType, sourceProviders, required }` | `ActuatorTaskDescriptor` |
| The catalogue — the single authority | `MEDIA_RULES: MediaRule[]` (renamed `FILTER_REGISTRY`) | `MediaActuator.tasks()` |

`predicate` is the analogue of `run`: behaviour that stays server-side. `MediaRuleDescriptor` serializes
complete and is what crosses the boundary. `FilterDefinition → MediaRule`, `getFilterDef → getRule`. The
UI layer keeps the word "filter" (`MediaFilterBar`, `useMediaFilters`) as the input-composition surface
that produces a `MediaQuerySource`'s `filterValues` — rule-keyed values.

## How rules thread to enrichers and queries (not one-to-one)

The join between a rule and an enricher is the **field**, and it is many-to-many:

- A `MediaRule.predicate` reads one item field. Some fields are owned by the source (`hasFile`,
  `monitored`, `sizeOnDiskBytes`); some are contributed by an enricher (`tmdbStatus`, `overseerrHasIssue`,
  `imdbRating`, `playCount`). The item does not rank them — see `docs/intent/media-item-shape.md`.
- One enricher feeds many rules (TMDB → `tmdbStatus`, `genres`, `certification`, `communityRating`); one
  rule accepts many providers (`certification` ← Radarr | Sonarr | TMDB | OMDB).
- `sourceProviders` is the existing encoding of "who can supply this rule's field." Provider-gating the UI
  *is* "offer a rule only when one of its `sourceProviders` is configured."

## Range rules — one control, one predicate, one value

Today every bounded field is **two** rules — `yearMin`/`yearMax`, `addedDaysAgoGte`/`Lte`,
`sizeOnDiskGbGte`/`Lte`, `imdbRatingGte`/`Lte`, `communityRatingGte`/`Lte`, `lastAiredDaysAgoGte`/`Lte`,
`episodePercentageGte`/`Lte`, `lastWatchedDaysAgoGte`/`Lte` — read by two predicates against one item field.
That is the only place the rule→control mapping is not 1:1 (two keys, one UI intent).

**Collapse each pair into a single range rule:** `dataType: 'range'`, value `{ min?: number; max?: number }`,
one `predicate` testing the item's field against both bounds. The control is one range input. This keeps
the invariant **one rule = one control = one value shape**, so the single-authority claim is structural,
not asserted — there is no pair-grouping metadata for the client to hold.

Safe because every existing `*Gte`/`*Lte` pair already shares identical `sourceProviders` (verified across
the registry): both bounds come from the same provider, so a range is never half-available, and gating
stays coherent. Cost: `FilterValue` widens from `string | number | boolean` to include the range object,
and persisted `filterValues` carry a structured value for range rules (coerced by `dataType` as today).

## Stage 1 — the server names the rule and projects its descriptor (DONE — shipped 2026-07-05)

- ✅ Renamed `FilterDefinition → MediaRule`, `apply → predicate` (typed `Predicate`), `FILTER_REGISTRY →
  MEDIA_RULES`, `getFilterDef → getRule` in `server/utils/filterRegistry.ts`. Behaviour-preserving —
  engine/`matchItems`/`combinationEvaluator` tests stayed green throughout.
- ✅ Added `MediaRuleDescriptor` = `MediaRule` minus `predicate`, and `toDescriptor()` projecting it.
- ✅ Collapsed each `*Gte`/`*Lte` pair (plus `yearMin`/`yearMax`) into one `dataType: 'range'` rule with a
  `{ min?, max? }` value and a single predicate — 34 entries became 26. `FilterValue` widened to include the
  range object, both in the server registry and the shared wire schema (`src/lib/api/schemas.ts`).
  Migration `0013_media_rule_range_collapse.sql` rewrites already-persisted `media_query_filter_values` rows
  from the eight old keys to their collapsed range keys, with its own regression suite
  (`server/__tests__/database/mediaRuleRangeCollapse.test.ts`) — this is the equivalent of what
  `0007_query_model_rewrite.sql` did for the earlier rename, and was *not* in the original plan; it was
  added after review flagged the gap (see the fracture ledger for why it mattered).
  `MediaQueryService.create()` also now validates a filter value's shape against its rule's `dataType`
  (a bare scalar previously destructured to `{ min: undefined, max: undefined }` for a range rule and
  silently matched every item).
- ✅ Extended the existing `GET /api/filter-fields` endpoint (`filterFields.handler.ts` /
  `filterFields.routes.ts`) **in place** — no parallel endpoint added. Now `createFilterFieldsHandlers(cradle)`,
  projects full `MediaRuleDescriptor`s (`sourceProviders`, `required`), and provider-gates its output the
  same way `GET /api/providers/tasks` gates actuator tasks. `filterFields.integration.test.ts` rewritten for
  the range-collapsed keys plus gating coverage. This is the single source Stage 2's `useMediaRules` reads
  from — it has **zero client consumers today**, that wiring is Stage 2's job.
- **Deferred to Stage 2, not done:** `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` and `toFilterValues`
  (`media.handler.ts`) are still live — Stage 1 only updated their internals (each mapping entry now carries
  an optional `bound: 'min' | 'max'`, merging paired Gte/Lte URL params into one range value) so the browse
  path keeps working against the collapsed registry keys. Deleting the translator entirely still needs the
  client to emit registry keys directly, per Stage 2 below.

## Accepted edge case — the engine does not enforce provider-gating

Gating answers "which rules are *offered*" at compose time, against the providers configured **then**. A
saved `MediaQuery` is a snapshot from that moment. The engine deliberately does **not** re-check gating at
evaluate time, and that is correct, not a gap: enriched fields are **not** cleared when a provider later
goes unavailable, so a saved rule's field is usually still present and still matches. A genuinely missing
field simply fails its predicate (`=== undefined → false`) — no error, no false match. The residual case (a
provider removed *and* its enrichment purged) is small and self-correcting. Gating is a compose-time
affordance by design; the engine's contract is "match what the item carries."

## Stage 2 — the client derives (delete the second vocabulary)

Only after Stage 1. The *goal* the earlier Phase 4 had right, the *mechanism* it had wrong. The blast
radius (`FilterState`, `useMediaFilters`, `useMediaQueries.save()`, `MediaFilterBar`'s ~33 explicit `setX`
props, `MediaContent`, `MediaPage`) is one tightly-coupled chain, not a single-session change, so Stage 2
is split into four independently-shippable sub-stages. Each is TDD except 2d, which is `impeccable`
(Ladle-first) by the plan's own original sequencing — the visual, generic-render pass happens only after
the logic underneath it is green.

### Stage 2a — `useMediaRules` (DONE — shipped 2026-07-06)

- ✅ New hook (`src/hooks/useMediaRules.ts`, SWR, MSW-mocked in
  `src/hooks/__tests__/useMediaRules.test.tsx`) fetching `GET /api/filter-fields`, optionally scoped by
  `contentType` (mirrors `useProviderTasks`'s shape — same god-node-adjacent pattern Phase 3 established).
  Reuses the shared `ContentTypeSchema` from `src/lib/api/schemas.ts` rather than re-declaring the
  `'movie' | 'show'` union locally.
- Purely additive: nothing deleted, nothing else in the chain touched yet, so this sub-stage carries none
  of Stage 1's deployment risk on its own. It has zero consumers today — 2c is what wires it in.

### Stage 2b — `useMediaQueries.ts` persists registry keys directly (DONE — shipped 2026-07-06)

- ✅ Deleted `KEY_RENAMES` and the old `toFilterValues()`. `save(name, contentType, values)` now takes a
  plain `Record<string, FilterValue | undefined>` and emits `{ key, value }` entries directly — no
  translation, undefined values dropped. `useMediaQueries.ts` had no dedicated test file; wrote one
  test-first (`src/hooks/__tests__/useMediaQueries.test.tsx`) rather than adjusting a nonexistent one.
- Also deleted `buildQueryParams`, dead code with no callers outside the file.
- Landed together with 2c below, as planned — `save()`'s shape and its only caller's shape had to change
  in the same PR.

### Stage 2c — `useMediaFilters.ts` derives from the registry (DONE — shipped 2026-07-06)

- ✅ Replaced the static `FILTER_FIELDS` catalogue with `FilterState = { shared, movie, show, movieSort,
  seriesSort }`, each of `shared`/`movie`/`show` a `Record<string, FilterValue>` keyed by **registry keys
  directly** (`tagIds`, `genres`, `year`, etc.) sourced from `useMediaRules` (2a). Tracing the old
  `KEY_RENAMES`/`toFilterValues` translator surfaced a real, previously-undocumented bug it would have
  reproduced: `MEDIA_RULES` intentionally reuses the same key (`tagIds`, `qualityProfileIds`, `genres`)
  across its movie-scoped and show-scoped entries, and the old flat `FilterState` held both
  simultaneously (`movieGenres`/`seriesGenres` etc., both live since movies+series data stay mounted
  together regardless of active tab) — collapsing both back to bare registry keys for `toFilterValues()`
  would have silently pushed two `{ key: 'genres', ... }` entries into one saved query. Scoping
  `FilterState` by content type (rather than merging movie+show into one flat map) closes that outright:
  `toSaveValues(filterState, contentType)` merges only `shared` with the one relevant scope.
  `useMediaFilters.test.tsx`'s old assertions encoded the flat, renamed vocabulary (the wrong end shape);
  rewrote the suite against the target shape rather than layering a parallel one alongside a soon-dead one.
- Range rules parse from two `Min`/`Max` URL params into one `{ min?, max? }` value; URL param names for
  the three colliding key families are prefixed by scope (`movieTagIds`/`showTagIds`) via a mechanical
  function of collision, not a hand-maintained name table.
- **Known, accepted limitation:** `useMediaRules` resolves asynchronously, but `parseQuery` needs to know
  each key's `dataType` (for number/range coercion) synchronously at mount to read the URL. Numeric/range
  URL params parse as raw strings until rules load, then a one-time re-parse corrects them — a same-tick
  self-heal in practice, not a permanent client-side dataType table reappearing.
- **Temporary bridge, not the fracture reappearing:** `MediaFilterBar`/`MediaContent`/`MediaPage` (Stage
  2d) still expect the old flat, individually-named prop contract (~33 `setX` props) and the old
  browse-path param names (`server/modules/media/media.handler.ts`'s surface #2, undeleted). Rather than
  rewrite 2d's generic render pass early to keep the build green, added
  `src/pages/media/legacyFilterBridge.ts` — a small, explicitly-temporary adapter
  (`toLegacyFilterState`/`legacySetters`/`toSaveValues`/`toBrowseParams`) translating the new scoped state
  to/from the old flat shape at the `MediaPage` boundary only. `MediaFilterBar`'s own file is otherwise
  untouched (just repoints its `FilterState` import at the bridge's `LegacyFilterState`). **Deleted whole
  when 2d lands** — it is not a second permanent vocabulary, it is scaffolding for the gap between 2c
  landing and 2d rewriting the render layer.
- Added a default `GET /api/filter-fields` MSW handler (`tests/mocks/handlers/media.ts`) — previously
  unconsumed by any client hook, so no mock existed; now needed globally since `useMediaFilters` calls
  `useMediaRules` on every page render.

### Stage 2d — `MediaFilterBar` / `MediaContent` / `MediaPage` render generically (`impeccable`, not TDD)

- Only after 2b/2c are green. `MediaFilterBar` / `QueryRow` render **data-driven** from the descriptors:
  the control set, its `dataType`, and its gating all come from the server. This collapses the ~33
  explicit `setX` props (`MediaFilterBarProps`) to a single `onRuleChange(key, value)` and gates controls
  by configured provider — closing both problems in `docs/intent/filter-ui.md` (retired into this phase).
- Preview count (independent of the vocabulary fix, kept): `useQueryPreview(savedQueryId)` exposes the
  engine-backed `{ count }`; a query row bound to a saved query renders it. Include/exclude maps to
  `MediaQuerySource.role`.
- Ladle story first, per `CLAUDE.md`: the rule-driven `MediaFilterBar`, per-row preview count,
  include/exclude, provider-gated empty states.
- **Adjacent fracture spotted while tracing this sub-stage, not this phase's to fix:** the section-gating
  this sub-stage rewrites (`hasMovieSection`/`hasSeriesSection` in `MediaFilterBar`, the empty-state gating
  in `MediaPage`) independently hardcodes `configuredTypes.has('RADARR'|'SONARR')` in four places rather
  than deriving from the server's single authority for "which provider owns this content type" —
  `MediaSourceFactory.OWNER_TYPE` (`server/providers/mediaSourceFactory.ts:11`). Same
  two-designs-for-one-process shape as the rule vocabulary, over source-ownership instead of predicates.
  Recorded as its own Open entry in `docs/architecture/fracture-ledger.md`; not folded into Stage 2's scope.

## Out of scope (noted, not built here)

- **MediaItem shape** — identity + open provider-contingent field set (`docs/intent/media-item-shape.md`,
  Phase 5). Phase 4 closes the *vocabulary* fracture; it reads fields by today's keys regardless of shape.
- **Live count for an unsaved (draft) query** — needs a preview-by-spec server endpoint (engine accepting
  an inline `MediaQuery`). Small separate server addition.
- `/search/metadata` stays as-is, re-scoped or retired separately.

## Gates

`yarn test` (server + client), `yarn typecheck:server`, `yarn typecheck:client`, `yarn lint`. Unit-test at
boundaries (descriptors endpoint, MSW for the client hook); never mock internal domain (`MEDIA_RULES`,
`matchItems`, the engine).

## Done when

The rule catalogue is the single authority; its `MediaRuleDescriptor`s are projected and provider-gated;
the client derives its filter controls from them and holds no rule catalogue of its own; `FILTER_FIELDS`
and the cross-vocabulary mapping are gone; the UI shows the engine-backed preview count. The server half is
recorded in `docs/architecture/` when shipped; this plan is retired when Stage 2 lands.
