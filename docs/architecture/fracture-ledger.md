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
- **Healed by:** the role owns its tasks —
  [`ActuatorTask` / `ActuatorTaskDescriptor`](ref:path:server/modules/providers/roles.ts), instance-keyed discovery
  at [`providers.handler.ts`](ref:path:server/modules/providers/providers.handler.ts)
  (`GET /api/providers/tasks`), per-instance enablement via
  [`taskEnablement.ts`](ref:path:server/modules/providers/taskEnablement.ts). The client derives via
  [`useProviderTasks`](ref:path:src/hooks/useProviderTasks.ts) and holds no catalogue; the old catalogue
  (`src/lib/tasks.ts`) is deleted and the `tasks` surface removed from
  [`provider-registry.ts`](ref:path:src/lib/provider-registry.ts).
- **Full spec:** [`docs/architecture/actuator-task-ownership.md`](ref:path:docs/architecture/actuator-task-ownership.md).

### Filter/rule vocabulary (Phase 4 — shipped 2026-07-06)

- **Fracture:** the client independently re-declared the server's rule catalogue — a static `FILTER_FIELDS`
  object (`src/hooks/useMediaFilters.ts`) duplicating each `MEDIA_RULES` entry's renamed key, `dataType`,
  and content-type scope — plus two client-side translators (`KEY_RENAMES` in `useMediaQueries.ts`, the
  server's own `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` in `media.handler.ts`) bridging the renamed
  vocabulary back to registry keys at two different boundaries (save, browse).
- **Healed by:** the registry is the single authority, projected once, consumed generically.
  `MEDIA_RULES`/`MediaRule`/`getRule()` in
  [`filterRegistry.ts`](ref:path:server/utils/filterRegistry.ts) own the predicate contract; every
  `*Gte`/`*Lte` bound pair collapsed into one `dataType: 'range'` rule (`{ min?, max? }`), so "one rule = one
  control = one value shape" holds structurally. `GET /api/filter-fields`
  ([`filterFields.handler.ts`](ref:path:server/modules/filterFields/filterFields.handler.ts)) projects the
  provider-gated `MediaRuleDescriptor[]` the client reads via
  [`useMediaRules`](ref:path:src/hooks/useMediaRules.ts) (SWR). `useMediaFilters`
  ([`useMediaFilters.ts`](ref:path:src/hooks/useMediaFilters.ts)) derives `FilterState = { shared, movie,
  show, movieSort, seriesSort }` from that registry instead of the deleted `FILTER_FIELDS` — scoped by
  content type (not one flat map) because `MEDIA_RULES` intentionally reuses the same key (`tagIds`,
  `qualityProfileIds`, `genres`) across its movie- and show-scoped entries; a flat map holding both
  simultaneously would silently collide on save. `useMediaQueries.save()` persists those registry keys
  directly — `KEY_RENAMES` and the old `toFilterValues()` are deleted. `MediaFilterBar`
  ([`index.tsx`](ref:path:src/components/MediaFilterBar/index.tsx)) renders **data-driven** from
  `MediaRuleDescriptor[]`: control type per `dataType`, section grouping derived from `contentTypes`/
  `sourceProviders` (`groupsFor`), collapsing its ~33 explicit `setX` props to `values` + a single
  `onRuleChange(scope, key, value)`. `MediaContent`/`MediaPage`
  ([`src/pages/media/index.tsx`](ref:path:src/pages/media/index.tsx)) updated to match.
- **One surface stays a translator, deliberately:** `MOVIE_PARAM_TO_KEY`/`SERIES_PARAM_TO_KEY` +
  `toFilterValues()` in [`media.handler.ts`](ref:path:server/modules/media/media.handler.ts) still bridge
  the browse path's renamed URL params to registry keys — its deletion needs the client to emit registry
  keys for browsing too, which wasn't in this phase's scope. `src/pages/media/mediaQueryAdapters.ts`'s
  `toBrowseParams()` mirrors it client-side (`GET /api/media/movies|series` still expects the old param
  names) until that translator is retired; `toSaveValues()` in the same file is the permanent save-path
  adapter, not a shim.
- **Deliberate behavior refinement, not a preserved bug:** `hasFile` is declared shared
  (`contentTypes: ['movie', 'show']`) in the registry, but the old hand-built `MediaFilterBar` only ever
  rendered it in the Movies section — series were never filterable by file presence via UI despite the
  registry always allowing it. The generic renderer now offers it in both sections when both providers are
  configured, since nothing about the field is actually movie-specific.
- Migrations `0007_query_model_rewrite.sql` (historical rename rewrite) and
  `0013_media_rule_range_collapse.sql` (historical range-collapse rewrite) are left as-is — not live
  duplication.
- **Spec:** the `MediaRule` / `MediaRuleDescriptor` entry in
  [`docs/architecture/VOCABULARY.md`](ref:path:docs/architecture/VOCABULARY.md) (mirroring
  `ActuatorTask`/`ActuatorTaskDescriptor` for Phase 3).

### MediaSource ownership vocabulary (spotted 2026-07-06 — healed 2026-07-07, North Star Phase 1)

- **Fracture:** the server has a single authority for "which provider type owns this content type" —
  `OWNER_TYPE` in [`mediaSourceFactory.ts`](ref:path:server/modules/providers/mediaSourceFactory.ts)
  (`{ movie: RADARR, show: SONARR }`) — but the client never read it: `MediaPage`'s empty-state gating
  spelled `configuredTypes.has('RADARR'|'SONARR')` literally, agreeing with the authority by
  coincidence, not by construction.
- **Healed by:** the authority is projected once and derived generically.
  [`sourceOwnership()`](ref:path:server/modules/providers/mediaSourceFactory.ts) (beside `OWNER_TYPE` itself)
  maps each `ContentType` to `MediaSourceDescriptor { contentType, ownerType, configured }`, joining
  active instances via `ProviderSettingsService.activeTypes()` (extracted — the same join
  [`filterFields.handler.ts`](ref:path:server/modules/filterFields/filterFields.handler.ts) already
  did). `GET /api/media/sources` ([`media.handler.ts`](ref:path:server/modules/media/media.handler.ts))
  serves it; the client reads it via [`useMediaSources`](ref:path:src/hooks/useMediaSources.ts) (SWR),
  and `MediaPage` ([`src/pages/media/index.tsx`](ref:path:src/pages/media/index.tsx)) derives both the
  empty-state gating **and its copy** (provider name via `PROVIDER_REGISTRY[ownerType].label`) from the
  projection — the literal checks and the `providersLoaded` gate are deleted. A change to `OWNER_TYPE`
  now flows to the client by construction.
- **Adjacent, deliberately untouched:** `MediaFilterBar`'s `groupsFor`
  ([`index.tsx`](ref:path:src/components/MediaFilterBar/index.tsx)) still spells `'RADARR'`/`'SONARR'`
  when grouping shared rules — but it reads them off each rule's own server-provided `sourceProviders`,
  a naming-convention dependency rather than a duplicated authority. Worth the next person's awareness,
  not necessarily a fix.

### MediaQuery naming residue — the `SavedMediaQuery` second vocabulary (recorded 2026-07-07 — healed 2026-07-09, North Star Phase 0)

- **Fracture:** one concept, two names at the HTTP/client boundary. The settled vocabulary (see
  [`VOCABULARY.md`](ref:path:docs/architecture/VOCABULARY.md)) is `MediaQuery` /
  `MediaQueryRecord` — "saved" is a state of a database entity, not a name — and the server already
  spoke it: [`MediaQueryService`](ref:path:server/services/mediaQueryService.ts) (cradle key
  `mediaQueryService`), `MediaQueryRecord`, tables `media_queries` / `media_query_filter_values`,
  canonical route `/api/media-queries`. The old vocabulary survived as a live translator at the HTTP
  boundary: `server/modules/index.ts` mounted `/api/saved-queries` as a back-compat alias, and the
  client still called it — `useMediaQueries` (`KEY`), `QuerySourceList` (preview URLs, plus a
  `savedQueries` prop fed from `AutomationBuilder`).
- **How it misled:** this doc set itself was infected — the class-level rename shipped 2026-06-24
  (`SavedMediaQueryService` → `MediaQueryService`, `SavedMediaQueryRecord` → `MediaQueryRecord`,
  `useSavedQueries` → `useMediaQueries`), but the core model's Ubiquitous Language table kept recording
  the *deprecated* names as canonical, sending anyone who trusted the table hunting for classes that no
  longer existed (fixed 2026-07-07 when the vocabulary moved to `VOCABULARY.md`).
- **Healed by:** deleting the second vocabulary rather than translating it. The client speaks only the
  canonical route: [`useMediaQueries.ts`](ref:path:src/hooks/useMediaQueries.ts)
  (`KEY = '/api/media-queries'`), [`QuerySourceList`](ref:path:src/components/QuerySourceList/index.tsx)
  (preview URLs via a single `previewUrl()`, prop renamed to `queries`, fed from
  [`AutomationBuilder`](ref:path:src/components/AutomationBuilder/index.tsx)). The `/api/saved-queries`
  alias mount is deleted from [`server/modules/index.ts`](ref:path:server/modules/index.ts);
  [`mediaQueryRoutes.integration.test.ts`](ref:path:server/__tests__/integration/mediaQueryRoutes.integration.test.ts)
  pins the canonical path. Test vocabulary followed (MSW `mediaQueriesHandlers`, integration mounts,
  contract-test labels).

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
- **Fracture:** not a vocabulary split but the same shape one level up — multiple designs answer the
  structural question "which layer owns this code," so every new feature re-litigates it. The surfaces,
  verified against the tree:
  - **Transport modules vs flat services.** [`server/modules/`](ref:path:server/modules/index.ts) holds
    schemas/handlers/routes per HTTP surface while business logic sits in a flat `server/services/`
    (auth, automations, the media-query engine and service — the provider services left for their
    module in Phase 3). Until 2026-07-07, [`server/modules/README.md`](ref:path:server/modules/README.md)
    declared each module "owns its schemas, handlers, routes, and services" — the doc now states the
    actual split, but the split itself remains for every module except providers: neither design is
    enforced, so services accrete wherever the author leaned.
  - **Module boundaries drawn by route, not domain.** `filterFields`
    ([`filterFields.handler.ts`](ref:path:server/modules/filterFields/filterFields.handler.ts)) is a
    one-endpoint module projecting the media rule registry; `backdrops` and `search` are media concerns
    with their own top-level modules.
  - **Orphan directories outside both designs:** [`server/cron/`](ref:path:server/cron/automationScheduler.ts)
    (one file, the automation scheduler), [`server/jobs/`](ref:path:server/jobs/enrichmentJob.ts)
    (enrichment — identity resolution moved into the providers module in Phase 3),
    [`server/domain/`](ref:path:server/domain/movie.ts) (two type files the `Normalized*` shapes live
    in), each a layer with a single tenant.
  - **The rule authority lives in "utils".** [`filterRegistry.ts`](ref:path:server/utils/filterRegistry.ts)
    — the single authority the Phase 4 heal established — sits in `server/utils/` beside small
    helpers. [`server/README.md`](ref:path:server/README.md) now flags it in place ("the
    media-rule authority"), but domain authority filed under utilities is the location fracture itself.
  - **One name, two homes:** [`server/modules/health/`](ref:path:server/modules/health/health.handler.ts)
    (HTTP liveness) and [`server/health/`](ref:path:server/health/systemHealthCheck.ts) (system
    self-healing: `ensureSystemJobs`, `failedStateMiddleware`) are different processes sharing the name
    `health` — a naming collision that reads as duplication until traced.
  - **Doc fiction as a third design (pruned 2026-07-07):** the server READMEs and the deleted
    `docs/agent/architecture.md` described a boilerplate "clean architecture" on TypeORM —
    `DataSource`, entities, repositories — while the code is Drizzle
    ([`server/database/index.ts`](ref:path:server/database/index.ts): `DrizzleDb`, `getDb()`). Agents
    reading those docs built against an ORM that isn't installed.
- **Direction:** a single target design is declared in `docs/intent/` (the server-architecture North
  Star). This entry tracks only what exists; it heals surface-by-surface as relocations ship and gets
  verified here against the tree, not against the plan.
