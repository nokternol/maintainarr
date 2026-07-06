# Fracture ledger — two-designs-for-one-process, tracked to code

**Status:** AS-BUILT (current fact) — a living ledger, not a plan. Extended as each fracture heals or a new
one is found; entries move from Open to Healed, never deleted. Companion to two documents that do *not*
overlap with it: `docs/in_progress/README.md` (the phase-by-phase *plan* for healing what's still Open here)
and the Ubiquitous Language table in [`docs/architecture/warden-core-model.md`](ref:path:docs/architecture/warden-core-model.md)
(the settled *names* for concepts once healed). This doc answers a narrower question than either: **for a
named fracture, what surfaces actually exist in code right now** — verified directly against source, not
against what a plan document claims.

## Why this exists

A "fracture" here is Warden's recurring failure mode: one real-world process (task execution, rule
matching) grows a second, renamed vocabulary at a boundary, so two designs answer one question and can
disagree. Healing one replaces the second vocabulary with a derivation from the first authority; it never
adds a translator between them (a translator *is* the fracture, persisted).

Plan documents drift from what Stage N actually shipped, and `docs/in_progress/` is deliberately excluded
from the graph (it's a plan, not fact) — so nothing forced a documented cross-check against the live tree
before more code landed. Concretely: `server/modules/filterFields/filterFields.handler.ts` (Phase 2c, real,
tested, mounted, unconsumed) sat undocumented in `docs/architecture/` and was absent from the Phase 4 plan's
own "live places" inventory, so an agent working Stage 1 fresh could easily have stood up a second
descriptors endpoint beside it — reproducing the fracture while believing it was closing one. This ledger
exists so that question — *does a surface already exist for this vocabulary?* — has one place to check that
is graphed, dated, and verified against code, not inferred from a plan.

## Healed

### Actuator tasks (Phase 3)

- **Fracture:** a type-keyed `taskManifest` table (Phase 2) duplicated what `MediaActuator.tasks()` should
  own — the client held its own ~30-task catalogue, detached from what any instance could actually run.
- **Healed by:** the role owns its tasks —
  [`ActuatorTask` / `ActuatorTaskDescriptor`](ref:path:server/providers/roles.ts), instance-keyed discovery
  at [`providers.handler.ts`](ref:path:server/modules/providers/providers.handler.ts)
  (`GET /api/providers/tasks`), per-instance enablement via
  [`taskEnablement.ts`](ref:path:server/providers/taskEnablement.ts). The client derives via
  [`useProviderTasks`](ref:path:src/hooks/useProviderTasks.ts) and holds no catalogue; the old catalogue
  (`src/lib/tasks.ts`) is deleted and the `tasks` surface removed from
  [`provider-registry.ts`](ref:path:src/lib/provider-registry.ts).
- **Full spec:** [`docs/architecture/actuator-task-ownership.md`](ref:path:docs/architecture/actuator-task-ownership.md).

## Open

### Filter/rule vocabulary (Phase 4 — Stage 1 shipped 2026-07-05, Stage 2a shipped 2026-07-06, 2b–2d not started)

- **Stage 2 is sub-staged** (the blast radius — `FilterState`, `useMediaFilters`, `useMediaQueries.save()`,
  `MediaFilterBar`'s ~33 `setX` props, `MediaContent`, `MediaPage` — is one tightly-coupled chain, not a
  single change): **2a** `useMediaRules` hook (done), **2b** `useMediaQueries.ts` persists registry keys
  directly (deletes `KEY_RENAMES`/`toFilterValues`), **2c** `useMediaFilters.ts` derives `FilterState` from
  the registry (deletes `FILTER_FIELDS`), **2d** `MediaFilterBar`/`MediaContent`/`MediaPage` render
  generically from descriptors — `impeccable`, Ladle-first, not TDD, only after 2b/2c are green. 2b and 2c
  land together (2b's `save()` signature change breaks its only caller until 2c changes that caller's
  shape). Full breakdown: `docs/in_progress/phase-4-client-query-alignment.md`'s "Stage 2" section.
- **2a shipped 2026-07-06:** `src/hooks/useMediaRules.ts` (SWR, MSW-mocked) fetches the provider- and
  contentType-gated `GET /api/filter-fields`, mirroring `useProviderTasks`'s shape. Purely additive — zero
  consumers yet, nothing deleted, none of Stage 1's deployment risk carried by this sub-stage alone.

- **Deployment-order constraint, not a Stage 1 defect:** Stage 1's rename/collapse is server-only by design
  (the client stays untouched until Stage 2 makes it derive from the registry). Between the two stages,
  `useMediaQueries.ts`'s `KEY_RENAMES`/`toFilterValues()` still emit the eight pre-collapse keys
  (`yearMin`/`yearMax`, `imdbRatingGte`/`Lte`, etc.) as bare scalars. `MediaQueryService.create()` now
  rejects every one of those keys outright (`getRule()` no longer resolves them) — **saving any query with a
  bounded filter is fully broken for the entire window Stage 1 is deployed without Stage 2.** This is not a
  code defect to patch in Stage 1 (fixing it *is* Stage 2's client-derives work) but a hard requirement that
  Stage 1 and Stage 2 ship together, or that Stage 1 not reach production alone. Flag this to whoever
  schedules the rollout.
- The **predicate contract** is single-authority and was renamed, not moved, by Stage 1: `FILTER_REGISTRY` /
  `FilterDefinition` / `getFilterDef()` in
  [`filterRegistry.ts`](ref:path:server/utils/filterRegistry.ts) are now `MEDIA_RULES` / `MediaRule` /
  `getRule()`, still keyed by `(key, contentType)`. Every `*Gte`/`*Lte` bound pair (plus `yearMin`/`yearMax`)
  collapsed into one `dataType: 'range'` rule with a `{ min?, max? }` value — 34 entries became 26 — so the
  invariant "one rule = one control = one value shape" now holds structurally. `MediaRuleDescriptor` (the
  predicate-free projection) and `toDescriptor()` were added alongside.
- A **renamed key vocabulary** for those same rules is still live in three client-side places — Stage 1 was
  server-only and did not touch these, verified directly against source on 2026-07-05:
  1. `FILTER_FIELDS` in [`useMediaFilters.ts`](ref:path:src/hooks/useMediaFilters.ts) — the client still
     independently re-declares each rule's renamed key, `dataType`, and content-type scope, minus
     `sourceProviders` (no client-side provider-gating). Unchanged by Stage 1; Stage 2 deletes it.
  2. `MOVIE_PARAM_TO_KEY` / `SERIES_PARAM_TO_KEY` + `toFilterValues()` in
     [`media.handler.ts`](ref:path:server/modules/media/media.handler.ts) — the server-side translator from
     renamed URL params to registry keys is still live (its *deletion* is Stage 2, gated on the client
     emitting registry keys directly). Stage 1 did have to touch its internals: each mapping entry now
     carries an optional `bound: 'min' | 'max'`, and `toFilterValues()` merges paired Gte/Lte params into one
     `{ min?, max? }` entry before evaluation — plumbing for the range collapse, not the translator's removal.
  3. `KEY_RENAMES` + `toFilterValues()` in
     [`useMediaQueries.ts`](ref:path:src/hooks/useMediaQueries.ts) — the second, independent client-side
     translator mapping `FilterState` keys back to registry keys before `save()` persists a saved query.
     Untouched by Stage 1; Stage 2 deletes it alongside `FILTER_FIELDS`.
  4. Migration `0007_query_model_rewrite.sql` — historical, one-time rewrite of persisted keys; not live
     duplication, left as-is.
- **Resolved by Stage 1** (no longer a gap in the ledger): the fourth surface previously flagged as
  orphaned/undocumented — `getFilterFields()` in
  [`filterFields.handler.ts`](ref:path:server/modules/filterFields/filterFields.handler.ts), routed at
  `GET /api/filter-fields` via
  [`filterFields.routes.ts`](ref:path:server/modules/filterFields/filterFields.routes.ts) — was extended in
  place rather than duplicated, closing the risk this ledger was written to catch. It is now
  `createFilterFieldsHandlers(cradle)`, cradle-injected (mirrors `createMediaHandlers`/
  `createProvidersHandlers`), projects full `MediaRuleDescriptor` (`sourceProviders`, `required` included),
  and provider-gates its output — only returning rules whose `sourceProviders` intersect the currently
  active configured providers, the same `GET /api/providers/tasks` gating shape used for actuator tasks. Its
  integration suite (`server/__tests__/integration/filterFields.integration.test.ts`) now asserts the gated,
  range-collapsed shape and seeds providers via `ProviderSettingsService`. It still has **zero client
  consumers** — that is Stage 2's job (`useMediaRules` derives from it) — so this surface is prepared, not
  yet the single source the client reads.
- The wire contract also widened to carry the range shape: `FilterValueSchema` /
  `FilterValueEntrySchema` in [`src/lib/api/schemas.ts`](ref:path:src/lib/api/schemas.ts) (shared
  client/server) and the server-only `mediaQuerySchemas` in
  [`mediaQueries.schemas.ts`](ref:path:server/modules/mediaQueries/mediaQueries.schemas.ts) now accept
  `{ min?, max? }` alongside `string | number | boolean`; persisted range values are JSON-(de)serialized by
  `MediaQueryService` rather than `String()`-coerced.
- Migration `0013_media_rule_range_collapse.sql` rewrites already-persisted
  `media_query_filter_values` rows from the eight old keys to their collapsed range keys, the same kind of
  historical rewrite `0007_query_model_rewrite.sql` did for the earlier rename — otherwise those rows would
  silently stop matching (`getRule()` no longer resolves the old key; `matchItems` treats an unresolved key
  as an automatic pass, not a failure). `MediaQueryService.create()` also now validates a filter value's
  shape against its rule's `dataType`, not just that the key exists: a bare scalar destructures to
  `{ min: undefined, max: undefined }` for a range rule, which `inRange` reads as "no bound set" and matches
  every item — previously silent, now rejected at write time.
- **Plan:** `docs/in_progress/phase-4-client-query-alignment.md`, `docs/in_progress/phase-4-prompt.md`.
- **When healed:** `MediaRule` / `MediaRuleDescriptor` join the Ubiquitous Language table in
  `docs/architecture/warden-core-model.md` (mirroring how `ActuatorTask` / `ActuatorTaskDescriptor` were
  added there for Phase 3), this entry moves to Healed pointing at the as-built doc, and the Phase 4
  `docs/in_progress/` files are deleted per the project's docs convention. Stage 2 (client derives from
  `GET /api/filter-fields`, deletes `FILTER_FIELDS` and both `KEY_RENAMES`/`toFilterValues` translators) is
  the remaining work.

### MediaSource ownership vocabulary (spotted 2026-07-06, tracing Phase 4 Stage 2d — not yet worked)

- **Fracture:** the server has a single authority for "which provider type owns this content type" —
  `MediaSourceFactory.OWNER_TYPE` (`server/providers/mediaSourceFactory.ts:11`, `{ movie: RADARR, show:
  SONARR }`), used to resolve the active `MediaSource` for a `ContentType` (see the Provider role model —
  Source/Enricher/Actuator — in `docs/architecture/warden-core-model.md`). The client never reads this;
  it independently re-hardcodes the identical mapping as literal string checks in four places:
  `MediaFilterBar`'s `hasMovieSection`/`hasSeriesSection` gating
  ([`src/components/MediaFilterBar/index.tsx:921,923`](ref:path:src/components/MediaFilterBar/index.tsx)),
  and `MediaPage`'s empty-state gating
  ([`src/pages/media/index.tsx:652,732`](ref:path:src/pages/media/index.tsx)) — all four spell
  `configuredTypes.has('RADARR'|'SONARR')` rather than deriving from anything server-projected. Same
  two-designs-for-one-process shape as the rule vocabulary above, over source ownership instead of
  predicates: today the mapping happens to agree by coincidence, not by construction, so a future change to
  `OWNER_TYPE` silently desyncs from these four call sites.
- **Not yet worked.** Spotted while tracing Phase 4 Stage 2d's section-gating rewrite; out of that stage's
  scope (rules/predicates, not source ownership) and not folded in. No plan document owns this yet — whoever
  picks it up should decide whether the fix is projecting `OWNER_TYPE` onto an existing client-facing
  surface (e.g. `GET /api/providers` or a new small endpoint) or something narrower.
