# Server North Star heal — phased plan

**Status:** IN PROGRESS — active implementation plan. Resolves every Open entry in
`docs/architecture/fracture-ledger.md` by converging the server on the target design in
`docs/intent/server-architecture-north-star.md`: full DDD feature modules (modules own schemas,
handlers, routes, services, domain logic, and jobs), sharing via deliberately crafted public
interfaces (each module's `index.ts` exports its designed contract — never a wholesale barrel)
plus a small `server/kernel/`, dependency direction following the product loop
(`automations → media, mediaQueries`; `mediaQueries → media, providers`; `media → providers`;
everyone → `kernel`).

This plan supersedes the System-Roles & MediaQueryEngine program, whose unshipped remainder was
relegated to `docs/intent/system_roles_heal/` for later review. It is a plan, not fact: the ledger
tracks what actually exists at any moment, verified against the tree.

**Only this plan is active.** Everything under `docs/intent/` — including `system_roles_heal/` and
`enrichment_filters/` — is aspiration awaiting review, not a task source. No phase may pull work from
an intent doc; if an intent doc contradicts a phase, the phase wins and the conflict is surfaced in
the phase's PR rather than silently reconciled.

## Ground rules (every phase)

- **Behavior-preserving phases are gated by the existing suite**, not new feature tests: green
  `yarn test`, `yarn typecheck:server`, `yarn typecheck:client`, `yarn lint` before and after. Phases
  that change observable behavior (0, 1) run strict TDD (`plan-and-go:tdd`).
- **One phase, one PR, one branch** (`feat/north-star-phase-N-<topic>`).
- **Imports move with the file.** A relocation phase ends with zero imports from the old path — no
  re-export shims left behind ("a translator *is* the fracture, persisted").
- **Every module phase produces its own container registrations slice** (added after Phase 2 shipped,
  applies to Phases 4 onward): a `<module>.registrations.ts` beside the module's `index.ts`, exporting
  a `<Module>Cradle` interface and a `register<Module>Dependencies(container)` function — the pattern
  `providers.registrations.ts` established in Phase 3. `server/container.ts` composes `Cradle` from
  `KernelCradle` (the mechanism, `server/kernel/container.ts`) and each module's `<Module>Cradle`, and
  calls each module's registration function; it never registers a module's services inline. A phase
  that moves services into a module without also moving their registration out of `server/container.ts`
  is incomplete.
- **Close the loop on docs**: each shipped phase updates the fracture ledger (surface-by-surface), and
  the final phase moves the North Star doc from `docs/intent/` to `docs/architecture/`.
  `graphify update .` + the doc linker run after each doc edit.

## Phases

| Phase | Heals | Observable value | Kind |
|---|---|---|---|
| **0 ✅ shipped** | MediaQuery naming residue | Client speaks only `/api/media-queries`; the `/api/saved-queries` alias is deleted | TDD |
| **1 ✅ shipped** | MediaSource ownership vocabulary | Client derives source ownership from a server projection; no literal `RADARR`/`SONARR` gating in pages | TDD |
| **2 ✅ shipped** | Server layering (foundation) | `server/kernel/` exists and is the only home for infrastructure; nothing imports `logger`/`errors`/`config`/db/middleware/`defineRoute` from old paths | Relocation |
| **3 ✅ shipped** | Server layering (providers) | `modules/providers/` owns connections, roles, factory, settings service, task enablement, identity job — behind one crafted interface | Relocation |
| **4 ✅ shipped** | Server layering (media) | `modules/media/` owns normalize, domain shapes, filterRegistry, query engine, enrichment, and absorbs the `filterFields`/`backdrops`/`search` modules | Relocation |
| **5 ✅ shipped** | Server layering (mediaQueries) | `modules/mediaQueries/` owns filter construction over enriched source data — `MediaQueryService`, filter-value persistence, query health — behind its own interface | Relocation |
| **6 ✅ shipped** | Server layering (automations) | `modules/automations/` owns its services and the scheduler, consuming mediaQueries only via its public interface + the database join | Relocation |
| **7** | Server layering (auth + system + settings) | `modules/auth/` owns authService + session store; `modules/system/` merges both `health` homes + `systemTaskRunner`; `server/services/`, `jobs/`, `cron/`, `domain/`, `health/` are gone | Relocation |
| **8** | Server layering (closure) | Interface-only imports enforced by an automated check; North Star doc promoted to `docs/architecture/`; ledger entry moves to Healed | Enforcement |

## Phase 0 — Client speaks MediaQuery ✅ (shipped 2026-07-09)

The client speaks only `/api/media-queries`: `useMediaQueries` (`KEY`), `QuerySourceList` preview URLs
(single `previewUrl()`, prop renamed `queries`, fed from `AutomationBuilder`), automations-page heading
ids. The `/api/saved-queries` alias mount is deleted from `server/modules/index.ts`;
`mediaQueryRoutes.integration.test.ts` pins the canonical path (a 404 assertion on the retired alias
was judged scaffolding and not kept). Test vocabulary followed (`mediaQueriesHandlers`, integration
mounts, contract-test labels). Ledger's
"MediaQuery naming residue" → Healed; `VOCABULARY.md` deprecated row marked deleted.

## Phase 1 — Source ownership projected, not spelled ✅ (shipped 2026-07-07)

Design pass chose a dedicated projection over piggybacking existing surfaces: `sourceOwnership()`
beside `OWNER_TYPE` itself, served as `GET /api/media/sources`
(`MediaSourceDescriptor { contentType, ownerType, configured }`), read via `useMediaSources`.
`MediaPage` derives empty-state gating and copy from it; the literal checks are deleted. Ledger entry
moved to Healed; `MediaSourceDescriptor` recorded in `VOCABULARY.md`.

## Phase 2 — Kernel ✅ (shipped 2026-07-08)

`server/kernel/` created and now the only home for infrastructure: `eventBus`, `logger`, `config`,
`errors`, `env`, `middleware/`, `defineRoute`, and `kernel/db.ts` re-exporting the `DrizzleDb` handle
contract the container injects (`server/database/` stays put as the schema + migrations home). Every
import updated — zero old-path imports, no shims; kernel-owned tests moved to
`server/__tests__/kernel/`. The direction rule holds: every module may import kernel; kernel imports
no module. Ledger's "Server layering" entry records the kernel surface as healed.

**Gap closed 2026-07-09:** `server/kernel/container.ts` shipped with Phase 2 as the container
*mechanism* (`createKernelContainer()` — registers `config`/`db`/`eventBus`, no domain meaning), but
`server/container.ts` (assembly) never called it — it still called `createContainer()` directly and
re-registered `config`/`db`/`eventBus` itself, duplicating the mechanism instead of composing it.
`buildContainer()` now calls `createKernelContainer<Cradle>(deps)` and `Cradle` extends `KernelCradle`
instead of redeclaring its fields; six dead provider-class imports left over from before Phase 3 were
also removed. Behavior-preserving — gated by the existing `container.test.ts` suite, no new tests
needed.

## Phase 3 — providers module ✅ (shipped 2026-07-08)

`server/modules/providers/` now owns the provider domain end to end: the connections in a
`connections/` subdirectory (`BaseProviderConnection` + one class per system), `roles.ts`,
`mediaSource.ts`, `mediaSourceFactory.ts`, `providerFactory.ts`, `taskEnablement.ts`,
`providerSettingsService.ts`, `plexService.ts`, `tmdbService.ts`, `keyResolver.ts`, and the
identity-resolution job + factory, beside the transport files it already had. `index.ts` is the
crafted public interface — roles, source shapes, factories, descriptor types, settings service, and
the connection classes and payload types media and other consumers need. Everything outside the module
imports only that interface; zero old-path imports remain. Module-owned tests moved to
`server/__tests__/modules/providers/`. Ledger's "Server layering" entry records the providers surface as
healed.

## Phase 4 — media module ✅ (shipped 2026-07-09)

`server/modules/media/` now owns normalize, the domain shapes, the rule registry, the query engine, and
enrichment: `movie.ts` + `show.ts` (flattened — no `domain/` subdirectory; two type files didn't warrant
one, matching providers' flat layout where `connections/` is the only subdirectory because it's a real
one-file-per-system fan-out), `mediaItem.ts`, `normalizeMedia.ts`, `filterRegistry.ts` (+ `ContentType`),
`ratingsAggregation.ts`, `mediaQueryEngine.ts`, `enrichmentMerge.ts`, `enrichmentJob.ts` +
`enrichmentJobFactory.ts`. Absorbed the three route-drawn modules as `media.filterFields.*`/
`media.backdrops.*`/`media.search.*` beside the pre-existing `media.handler.ts`/`media.routes.ts`;
route mounts unchanged. `index.ts` is the crafted public interface: `MediaItem`/`MediaItemSet`,
`Normalized*`, `normalizeRadarrMovie`/`normalizeSonarrSeries`, `MEDIA_RULES`/`getRule`/`toDescriptor`/the
descriptor projection, `MediaQueryEngine`, `mergeEnrichment`, `EnrichmentJobFactory`,
`aggregateRatings`/`formatRating`/`getSummaryText`. `server/services/mediaQueryService.ts` and
`automationExecutor.ts` (still-open Phase 5/6 surfaces) consume only that interface.

Added `media.registrations.ts`: `MediaCradle` (`mediaQueryEngine`, `enrichmentJobFactory`) and
`registerMediaDependencies()`; removed both from `server/container.ts`'s inline registration block and
extended `Cradle` from `MediaCradle`.

**Design correction mid-phase:** tracing `MediaEnricher`'s actual call graph found the enrichment
mechanics (`decorate()`'s join, the per-provider `mapTautulliHistory`/`mapPlexItems`/`mapOverseerr` DTO
translators) only ever need providers' own DTOs plus `Pick<MediaItem, ...>` field subsets — never the
full canonical item — so they moved to `server/modules/providers/enrichment/` instead of media, typed as
compiler-checked subsets of media's `MediaItem` rather than a hand-duplicated field list. This surfaced
the one deliberate exception to "media → providers, never the reverse": `MediaSource`/`MediaEnricher`
(providers' role contracts, unchanged location) reference media's `MediaItem` directly, because a role
contract has to name the shape it operates on. `RadarrProvider`/`SonarrProvider`'s `MediaSource`
implementation was *not* dead code — the media-query preview endpoint
(`mediaSourceFactory.forContentType()` → `mediaQueryEngine.evaluate()`) depends on it — so it was kept,
not deleted. Recorded in `VOCABULARY.md`'s `MediaItem` entry and the ledger rather than left implicit.
Behavior-preserving throughout — gated by the existing suite (all 636 server + 468 client tests), no new
tests needed. Ledger's "Server layering" entry records the media surface as healed.

**Gap closed 2026-07-09:** a code-review pass on the shipped phase flagged `ratingsAggregation.ts` as
misplaced — it aggregates a rating from `TmdbProvider`/`OmdbProvider`/`TvMazeProvider` DTOs and has zero
dependency on any media type (`NormalizedMovie`/`NormalizedShow`/`MediaItem`). Moved to
`server/modules/providers/ratingsAggregation.ts`; `aggregateRatings`/`formatRating`/`getSummaryText`/
`AggregatedRatings` dropped from `modules/media/index.ts`'s exports. It stays module-private in
providers rather than joining `providers/index.ts`'s crafted interface — its only consumers are
`providers.handler.ts` (intra-module) and the client's `RatingsDisplay` (a documented leaf-type import
straight to the file, bypassing both module systems so the client tsconfig program never pulls in
either module's value exports).

## Phase 5 — mediaQueries module ✅ (shipped 2026-07-09)

`server/services/mediaQueryService.ts` → `server/modules/mediaQueries/mediaQueryService.ts`. This
module owns the *construction* of filters over enriched source data — `MediaQueryRecord` CRUD,
filter-value persistence, query health — its own domain, deliberately not grouped with automations.
`index.ts` is the crafted public interface: `MediaQueryService`, `MediaQueryRecord`, `MediaQueryValue`,
`ProviderStatus`/`QueryHealth`, `createMediaQueryRoutes`. `automationExecutor.ts`/`automationService.ts`
(still-open Phase 6 surfaces) and `server/modules/index.ts` consume only that interface. Added
`mediaQueries.registrations.ts`: `MediaQueriesCradle` (`mediaQueryService`) and
`registerMediaQueriesDependencies()`; removed from `server/container.ts`'s inline block and extended
`Cradle` from `MediaQueriesCradle`.

**Design correction mid-phase:** the relocation surfaced a direction violation invisible until
`mediaQueryService.ts` had a module boundary to cross — `media/mediaQueryEngine.ts` imported
`FilterValueEntry` from `services/mediaQueryService.ts`, i.e. `media → mediaQueries`, backwards from the
declared `mediaQueries → media` direction. `FilterValueEntry` is structurally a media concept (it pairs
with `FilterValue` and is the element type of `mediaQueryEngine.ts`'s own `MediaQuerySource.filterValues`),
so it moved to `filterRegistry.ts` beside `FilterValue` and joined media's crafted interface;
`mediaQueryService.ts` now imports it from there like any other `mediaQueries → media` consumer.
`automationService.ts`'s `ContentType` import was redirected the same way — straight from media rather
than through mediaQueries' now-removed re-export, since `ContentType` is media's, not mediaQueries'.

Behavior-preserving — gated by the existing suite (1104 tests green), typecheck, and lint. Ledger's
"Server layering" entry records the mediaQueries surface as healed.

## Phase 6 — automations module ✅ (shipped 2026-07-09)

`server/services/automationService.ts`, `automationExecutor.ts`, `automationRunService.ts`, and
`server/cron/automationScheduler.ts` → `server/modules/automations/` (now dissolving `server/cron/`),
beside the transport files it already had. `index.ts` is the crafted public interface — currently just
`createAutomationRoutes` and the container contribution, since no other module consumes automations'
own DTOs yet. Verified the dependency direction holds: `automations` imports only the `media`,
`mediaQueries`, `providers` interfaces and kernel, and never reaches into query internals. Added
`automations.registrations.ts`: `AutomationsCradle` (`automationService`, `automationRunService`,
`automationExecutor`, `automationScheduler`) and `registerAutomationsDependencies()`; removed from
`server/container.ts`'s inline block and extended `Cradle` from `AutomationsCradle`.

**Deviation from this phase's own file list:** `combinationEvaluator.ts` was planned to move here too,
but its only consumer is `media/mediaQueryEngine.ts` — nothing automations-domain touches it. Moving it
to automations would have created a real `media → automations` reverse-direction violation the moment
it crossed a module boundary, the same shape as the `ratingsAggregation.ts` (Phase 4) and
`FilterValueEntry` (Phase 5) corrections. It moved to `server/modules/media/combinationEvaluator.ts`
instead, staying module-private there.

Behavior-preserving — gated by the existing suite (1104 tests green), typecheck, and lint. Ledger's
"Server layering" entry records the automations surface as healed.

## Phase 7 — auth, system, settings

`services/authService.ts` + `database/drizzleStore.ts` → `modules/auth/` (schema/migrations stay in
`server/database/`). Merge the name collision: `server/health/` (self-healing) + `modules/health/`
(liveness) + `services/systemTaskRunner.ts` → `modules/system/`. `settings` already matches the target.
End state: `server/services/`, `server/domain/`, `server/health/`, and `server/utils/` (emptied across
Phases 2–6; `server/jobs/` and `server/cron/` are already gone) deleted — empty directories are the
phase's proof. Add `auth.registrations.ts` (`AuthCradle`: `authService`) and `system.registrations.ts`
(`SystemCradle`: `systemTaskRunner`); by the end of this phase `server/container.ts`'s inline
registration block is empty — every entry in `Cradle` comes from `KernelCradle` or a module's
`<Module>Cradle`.

## Phase 8 — Enforcement and closure

- An automated import-boundary check (lint rule or a small arch test walking the dependency graph)
  fails CI on any cross-module import that bypasses a module's public interface or violates the
  declared direction.
- `docs/intent/server-architecture-north-star.md` → `docs/architecture/` (it is now fact);
  fracture ledger's "Server layering" entry → Healed with the final surface list; README updates
  (`server/README.md` directory map) land in the same PR.
