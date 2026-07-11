# Fracture ledger — two-designs-for-one-process, tracked to code

**Status:** AS-BUILT (current fact) — a living ledger, not a plan. Extended as each fracture heals or a new
one is found; entries move from Open to Healed, never deleted. Companion to two documents that do *not*
overlap with it: `docs/in_progress/README.md` (the phase-by-phase *plan* for healing what's still Open here)
and the vocabulary in [`docs/architecture/VOCABULARY.md`](ref:path:docs/architecture/VOCABULARY.md)
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
- **Healed by:** the role owns its tasks — `ActuatorTask` / `ActuatorTaskDescriptor`, instance-keyed
  discovery at `providers.handler.ts` (`GET /api/providers/tasks`), per-instance enablement via
  `taskEnablement.ts`. The client derives via `useProviderTasks` and holds no catalogue; the old
  catalogue (`src/lib/tasks.ts`) is deleted and the `tasks` surface removed from `provider-registry.ts`.
- **Full spec (at time of healing):** `docs/architecture/actuator-task-ownership.md`.

### Filter/rule vocabulary (Phase 4 — shipped 2026-07-06)

- **Fracture:** the client independently re-declared the server's rule catalogue — a static `FILTER_FIELDS`
  object (`src/hooks/useMediaFilters.ts`) duplicating each `MEDIA_RULES` entry's renamed key, `dataType`,
  and content-type scope — plus two client-side translators (`KEY_RENAMES` in `useMediaQueries.ts`, the
  server's own `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` in `media.handler.ts`) bridging the renamed
  vocabulary back to registry keys at two different boundaries (save, browse).
- **Healed by:** the registry is the single authority, projected once, consumed generically.
  `MEDIA_RULES`/`MediaRule`/`getRule()` in `filterRegistry.ts` own the predicate contract; every
  `*Gte`/`*Lte` bound pair collapsed into one `dataType: 'range'` rule (`{ min?, max? }`), so "one rule =
  one control = one value shape" holds structurally. `GET /api/filter-fields`
  (`media.filterFields.handler.ts`) projects the provider-gated `MediaRuleDescriptor[]` the client reads
  via `useMediaRules` (SWR). `useMediaFilters` (`useMediaFilters.ts`) derives `FilterState = { shared,
  movie, show, movieSort, seriesSort }` from that registry instead of the deleted `FILTER_FIELDS` —
  scoped by content type (not one flat map) because `MEDIA_RULES` intentionally reuses the same key
  (`tagIds`, `qualityProfileIds`, `genres`) across its movie- and show-scoped entries; a flat map holding
  both simultaneously would silently collide on save. `useMediaQueries.save()` persists those registry
  keys directly — `KEY_RENAMES` and the old `toFilterValues()` are deleted. `MediaFilterBar`
  (`index.tsx`) renders **data-driven** from `MediaRuleDescriptor[]`: control type per `dataType`,
  section grouping derived from `contentTypes`/`sourceProviders` (`groupsFor`), collapsing its ~33
  explicit `setX` props to `values` + a single
  `onRuleChange(scope, key, value)`. `MediaContent`/`MediaPage` (`src/pages/media/index.tsx`) updated to
  match.
- **One surface stays a translator, deliberately:** `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` +
  `toFilterValues()` in `media.handler.ts` still bridge the browse path's renamed URL params to registry
  keys — its deletion needs the client to emit registry keys for browsing too, which wasn't in this
  phase's scope. `src/pages/media/mediaQueryAdapters.ts`'s `toBrowseParams()` mirrors it client-side
  (`GET /api/media/movies|series` still expects the old param names) until that translator is retired;
  `toSaveValues()` in the same file is the permanent save-path adapter, not a shim.
- **Deliberate behavior refinement, not a preserved bug:** `hasFile` is declared shared
  (`contentTypes: ['movie', 'show']`) in the registry, but the old hand-built `MediaFilterBar` only ever
  rendered it in the Movies section — series were never filterable by file presence via UI despite the
  registry always allowing it. The generic renderer now offers it in both sections when both providers are
  configured, since nothing about the field is actually movie-specific.
- Migrations `0007_query_model_rewrite.sql` (historical rename rewrite) and
  `0013_media_rule_range_collapse.sql` (historical range-collapse rewrite) are left as-is — not live
  duplication.
- **Spec (at time of healing):** the `MediaRule` / `MediaRuleDescriptor` entry in
  `docs/architecture/VOCABULARY.md` (mirroring `ActuatorTask`/`ActuatorTaskDescriptor` for Phase 3).

### MediaSource ownership vocabulary (spotted 2026-07-06 — healed 2026-07-07, North Star Phase 1)

- **Fracture:** the server has a single authority for "which provider type owns this content type" —
  `OWNER_TYPE` in `mediaSourceFactory.ts` (`{ movie: RADARR, show: SONARR }`) — but the client never read
  it: `MediaPage`'s empty-state gating spelled `configuredTypes.has('RADARR'|'SONARR')` literally,
  agreeing with the authority by coincidence, not by construction.
- **Healed by:** the authority is projected once and derived generically. `sourceOwnership()` (beside
  `OWNER_TYPE` itself) maps each `ContentType` to `MediaSourceDescriptor { contentType, ownerType,
  configured }`, joining active instances via `ProviderSettingsService.activeTypes()` (extracted — the
  same join `media.filterFields.handler.ts` already did). `GET /api/media/sources` (`media.handler.ts`)
  serves it; the client reads it via `useMediaSources` (SWR), and `MediaPage`
  (`src/pages/media/index.tsx`) derives both the empty-state gating **and its copy** (provider name via
  `PROVIDER_REGISTRY[ownerType].label`) from the projection — the literal checks and the
  `providersLoaded` gate are deleted. A change to `OWNER_TYPE` now flows to the client by construction.
- **Adjacent, deliberately untouched:** `MediaFilterBar`'s `groupsFor` (`index.tsx`) still spells
  `'RADARR'`/`'SONARR'` when grouping shared rules — but it reads them off each rule's own
  server-provided `sourceProviders`, a naming-convention dependency rather than a duplicated authority.
  Worth the next person's awareness, not necessarily a fix.

### MediaQuery naming residue — the `SavedMediaQuery` second vocabulary (recorded 2026-07-07 — healed 2026-07-09, North Star Phase 0)

- **Fracture:** one concept, two names at the HTTP/client boundary. The settled vocabulary (see
  `VOCABULARY.md`) is `MediaQuery` / `MediaQueryRecord` — "saved" is a state of a database entity, not a
  name — and the server already spoke it: `MediaQueryService` (cradle key `mediaQueryService`),
  `MediaQueryRecord`, tables `media_queries` / `media_query_filter_values`, canonical route
  `/api/media-queries`. The old vocabulary survived as a live translator at the HTTP boundary:
  `server/modules/index.ts` mounted `/api/saved-queries` as a back-compat alias, and the client still
  called it — `useMediaQueries` (`KEY`), `QuerySourceList` (preview URLs, plus a `savedQueries` prop fed
  from `AutomationBuilder`).
- **How it misled:** this doc set itself was infected — the class-level rename shipped 2026-06-24
  (`SavedMediaQueryService` → `MediaQueryService`, `SavedMediaQueryRecord` → `MediaQueryRecord`,
  `useSavedQueries` → `useMediaQueries`), but the core model's Ubiquitous Language table kept recording
  the *deprecated* names as canonical, sending anyone who trusted the table hunting for classes that no
  longer existed (fixed 2026-07-07 when the vocabulary moved to `VOCABULARY.md`).
- **Healed by:** deleting the second vocabulary rather than translating it. The client speaks only the
  canonical route: `useMediaQueries.ts` (`KEY = '/api/media-queries'`), `QuerySourceList` (preview URLs
  via a single `previewUrl()`, prop renamed to `queries`, fed from `AutomationBuilder`). The
  `/api/saved-queries` alias mount is deleted from `server/modules/index.ts`;
  `mediaQueryRoutes.integration.test.ts` pins the canonical path. Test vocabulary followed (MSW
  `mediaQueriesHandlers`, integration mounts, contract-test labels).

## Open

### Server layering — three designs for "where does feature logic live" (recorded 2026-07-07, healing surface-by-surface)

- **Healed so far — infrastructure has one home (North Star Phase 2, 2026-07-08):**
  [`server/kernel/`](ref:path:server/kernel/db.ts) now owns everything infrastructural with no domain
  meaning: `config`, `env`, `errors`, `logger`, `eventBus`, `defineRoute`, `middleware/`, and `db.ts` —
  the database-handle surface re-exporting the `DrizzleDb` contract from
  [`server/database/`](ref:path:server/database/index.ts), which stays the schema + migrations home.
  Zero imports from the old locations remain (`server/config.ts`, `server/errors.ts`,
  `server/logger.ts`, `server/env.ts`, `server/middleware/`, `server/services/eventBus.ts`,
  `server/utils/defineRoute.ts` are gone); the direction rule holds — kernel imports no service or
  module. [`server/container.ts`](ref:path:server/container.ts) — the app's assembly layer — builds on
  [`server/kernel/container.ts`](ref:path:server/kernel/container.ts)'s `createKernelContainer()`
  mechanism rather than duplicating config/db/eventBus registration itself (closed 2026-07-09).
- **Healed so far — providers is the first full feature module (North Star Phase 3, 2026-07-08):**
  [`server/modules/providers/`](ref:path:server/modules/providers/index.ts) owns the provider domain
  end to end beside the transport files it already had: the connections
  ([`connections/`](ref:path:server/modules/providers/connections/baseProviderConnection.ts) — the
  base plus one class per external system), [`roles.ts`](ref:path:server/modules/providers/roles.ts),
  [`mediaSource.ts`](ref:path:server/modules/providers/mediaSource.ts),
  [`mediaSourceFactory.ts`](ref:path:server/modules/providers/mediaSourceFactory.ts),
  [`providerFactory.ts`](ref:path:server/modules/providers/providerFactory.ts),
  [`taskEnablement.ts`](ref:path:server/modules/providers/taskEnablement.ts), the provider settings
  service, `plexService`, `tmdbService`, `keyResolver`, and the identity-resolution job + factory.
  Everything outside the module imports only the crafted public interface
  ([`index.ts`](ref:path:server/modules/providers/index.ts)); zero old-path imports remain.
  `server/providers/` keeps only `normalizeMedia.ts` — a media concern the media-module phase
  relocates. The remaining surfaces below are still open.
- **Healed so far — media is the second full feature module (North Star Phase 4, 2026-07-09):**
  [`server/modules/media/`](ref:path:server/modules/media/index.ts) owns normalize, the domain shapes,
  the rule registry, the query engine, and enrichment: `movie.ts`/`show.ts`, `mediaItem.ts`,
  [`normalizeMedia.ts`](ref:path:server/modules/media/normalizeMedia.ts),
  [`filterRegistry.ts`](ref:path:server/modules/media/filterRegistry.ts),
  [`mediaQueryEngine.ts`](ref:path:server/modules/media/mediaQueryEngine.ts),
  `enrichmentMerge.ts`, `enrichmentJob.ts` + `enrichmentJobFactory.ts`, and absorbs the three
  route-drawn `filterFields`/`backdrops`/`search` modules as `media.filterFields.*`/`media.backdrops.*`/
  `media.search.*` beside the pre-existing `media.handler.ts`. `server/domain/`, `server/utils/
  filterRegistry.ts`, `server/utils/ratingsAggregation.ts`, `server/providers/normalizeMedia.ts`, and
  `server/jobs/` are gone. `index.ts` is the crafted public interface; `mediaQueryService.ts`
  (Phase 5) and `automationExecutor.ts` (still open, Phase 6) consume only that interface.
  Per-provider enrichment mechanics that only need providers' own vocabulary — the
  `decorate()` join and the `mapTautulliHistory`/`mapPlexItems`/`mapOverseerr` DTO translators — moved to
  [`server/modules/providers/enrichment/`](ref:path:server/modules/providers/enrichment/decorate.ts)
  instead, typed as `Pick<MediaItem, ...>` subsets of media's canonical shape rather than a
  hand-duplicated field list; `resolvePrecedence` (needs cross-provider precedence over the canonical
  item) stays media-owned. This is the one deliberate, narrow exception to "media → providers, never the
  reverse": the `MediaSource`/`MediaEnricher` role contracts in `providers/mediaSource.ts` and
  `providers/roles.ts` reference media's `MediaItem` directly, because a role contract has to name the
  shape it operates on — recorded in `VOCABULARY.md`'s MediaItem entry rather than left implicit.

  **Gap closed 2026-07-09:** a code-review pass flagged `ratingsAggregation.ts` as misplaced — it
  aggregates ratings from `TmdbProvider`/`OmdbProvider`/`TvMazeProvider` DTOs and has no dependency on
  any media type, so it moved to
  [`server/modules/providers/ratingsAggregation.ts`](ref:path:server/modules/providers/ratingsAggregation.ts).
  It stays module-private (only `providers.handler.ts` and the client's `RatingsDisplay` — a documented
  leaf-type cross-boundary import — consume it), so it is not part of `providers/index.ts`'s crafted
  interface.
- **Healed so far — mediaQueries is the third full feature module (North Star Phase 5, 2026-07-09):**
  [`server/modules/mediaQueries/`](ref:path:server/modules/mediaQueries/index.ts) owns the construction
  of filters over enriched source data:
  [`mediaQueryService.ts`](ref:path:server/modules/mediaQueries/mediaQueryService.ts) (`MediaQueryRecord`
  CRUD, filter-value persistence, query health), beside the transport files it already had
  (`mediaQueries.handler.ts`/`.routes.ts`/`.schemas.ts`). `index.ts` is the crafted public interface —
  `MediaQueryService`, `MediaQueryRecord`, `MediaQueryValue`, the health types, `createMediaQueryRoutes`
  — that automations (still open, Phase 6) and the HTTP layer consume; `server/services/` no longer has
  a `mediaQueryService.ts`. Added `mediaQueries.registrations.ts`: `MediaQueriesCradle`
  (`mediaQueryService`) and `registerMediaQueriesDependencies()`, composed into `server/container.ts`
  alongside the kernel, media, and providers registrations.

  This surfaced a pre-existing, un-flagged direction violation: `media/mediaQueryEngine.ts` imported
  `FilterValueEntry` from `services/mediaQueryService.ts` — `media → mediaQueries`, backwards from the
  declared `mediaQueries → media` direction, invisible before mediaQueryService had a module boundary to
  cross. `FilterValueEntry` (`{ key, value }`, one predicate application) is structurally a media concept
  — it pairs with `FilterValue` and is the element type of `MediaQuerySource.filterValues`, which
  `mediaQueryEngine.ts` already owns — so it moved to
  [`filterRegistry.ts`](ref:path:server/modules/media/filterRegistry.ts) beside `FilterValue` and is now
  part of media's crafted interface; `mediaQueryService.ts` imports it from there like any other
  mediaQueries → media consumer.
- **Healed so far — automations is the fourth full feature module (North Star Phase 6, 2026-07-09):**
  [`server/modules/automations/`](ref:path:server/modules/automations/index.ts) owns
  [`automationService.ts`](ref:path:server/modules/automations/automationService.ts),
  `automationExecutor.ts`, `automationRunService.ts`, and `automationScheduler.ts` (formerly
  `server/cron/`, now dissolved), beside the transport files it already had
  (`automations.handler.ts`/`.routes.ts`/`.schemas.ts`). `index.ts` is the crafted public interface —
  currently just `createAutomationRoutes` and the container contribution, since no other module consumes
  automations' own DTOs yet. Added `automations.registrations.ts`: `AutomationsCradle`
  (`automationService`, `automationRunService`, `automationExecutor`, `automationScheduler`) and
  `registerAutomationsDependencies()`, composed into `server/container.ts`. Verified the dependency
  direction holds: automations imports only the `media`, `mediaQueries`, `providers` interfaces and
  kernel, never query internals.

  **Deviation from the plan's file list:** the plan listed `combinationEvaluator.ts` as moving to
  `modules/automations/` alongside the other four files, but tracing its only consumer found
  `media/mediaQueryEngine.ts` — nothing automations-domain ever imports it. Moving it to automations
  would have created a real `media → automations` reverse-direction violation the moment it crossed a
  module boundary, mirroring the `ratingsAggregation.ts` (Phase 4) and `FilterValueEntry` (Phase 5)
  corrections. It moved to
  [`server/modules/media/combinationEvaluator.ts`](ref:path:server/modules/media/combinationEvaluator.ts)
  instead, where its only consumer already lives; it stays module-private (not part of media's crafted
  interface) since nothing outside `mediaQueryEngine.ts` needs it.
- **Healed so far — auth and system are the fifth and sixth full feature modules (North Star Phase 7,
  2026-07-09):** [`server/modules/auth/`](ref:path:server/modules/auth/index.ts) owns
  [`authService.ts`](ref:path:server/modules/auth/authService.ts) and
  [`drizzleStore.ts`](ref:path:server/modules/auth/drizzleStore.ts) (the session store; schema/migrations
  stay in `server/database/`), beside its transport files.
  [`server/modules/system/`](ref:path:server/modules/system/index.ts) resolves the "one name, two homes"
  collision — HTTP liveness (`server/modules/health/`) and system self-healing (`server/health/`:
  `ensureSystemJobs`, `failedStateMiddleware`, `systemHealthCheck`) merge with
  [`systemTaskRunner.ts`](ref:path:server/modules/system/systemTaskRunner.ts) under one module and one
  name. Both add a `<module>.registrations.ts`; `server/container.ts`'s inline registration block is now
  empty — every `Cradle` entry comes from `KernelCradle` or a module's `<Module>Cradle`.
  `server/services/`, `server/health/`, `server/domain/`, `server/utils/`, `server/jobs/`, and
  `server/cron/` are all gone. `server/modules/settings/` gets a minimal `index.ts` too, for
  consistency — it has no domain logic of its own, only `providerSettingsService` from providers.
  `server/modules/README.md`'s stale intro (still describing "providers is the first module converged")
  and its "register a service" walkthrough (hand-editing `server/container.ts`, predating the
  registrations pattern) are corrected to match the shipped convention.
- **Fracture:** not a vocabulary split but the same shape one level up — multiple designs answer the
  structural question "which layer owns this code," so every new feature re-litigates it. The surfaces,
  verified against the tree:
  - **Doc fiction as a third design (pruned 2026-07-07):** the server READMEs and the deleted
    `docs/agent/architecture.md` described a boilerplate "clean architecture" on TypeORM —
    `DataSource`, entities, repositories — while the code is Drizzle
    ([`server/database/index.ts`](ref:path:server/database/index.ts): `DrizzleDb`, `getDb()`). Agents
    reading those docs built against an ORM that isn't installed.
- **Direction:** a single target design is declared in `docs/intent/` (the server-architecture North
  Star). This entry tracks only what exists; it heals surface-by-surface as relocations ship and gets
  verified here against the tree, not against the plan.
