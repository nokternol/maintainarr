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
- **Close the loop on docs**: each shipped phase updates the fracture ledger (surface-by-surface), and
  the final phase moves the North Star doc from `docs/intent/` to `docs/architecture/`.
  `graphify update .` + the doc linker run after each doc edit.

## Phases

| Phase | Heals | Observable value | Kind |
|---|---|---|---|
| **0** | MediaQuery naming residue | Client speaks only `/api/media-queries`; the `/api/saved-queries` alias is deleted | TDD |
| **1 ✅ shipped** | MediaSource ownership vocabulary | Client derives source ownership from a server projection; no literal `RADARR`/`SONARR` gating in pages | TDD |
| **2 ✅ shipped** | Server layering (foundation) | `server/kernel/` exists and is the only home for infrastructure; nothing imports `logger`/`errors`/`config`/db/middleware/`defineRoute` from old paths | Relocation |
| **3** | Server layering (providers) | `modules/providers/` owns connections, roles, factory, settings service, task enablement, identity job — behind one crafted interface | Relocation |
| **4** | Server layering (media) | `modules/media/` owns normalize, domain shapes, filterRegistry, query engine, enrichment, and absorbs the `filterFields`/`backdrops`/`search` modules | Relocation |
| **5** | Server layering (mediaQueries) | `modules/mediaQueries/` owns filter construction over enriched source data — `MediaQueryService`, filter-value persistence, query health — behind its own interface | Relocation |
| **6** | Server layering (automations) | `modules/automations/` owns its services and the scheduler, consuming mediaQueries only via its public interface + the database join | Relocation |
| **7** | Server layering (auth + system + settings) | `modules/auth/` owns authService + session store; `modules/system/` merges both `health` homes + `systemTaskRunner`; `server/services/`, `jobs/`, `cron/`, `domain/`, `health/` are gone | Relocation |
| **8** | Server layering (closure) | Interface-only imports enforced by an automated check; North Star doc promoted to `docs/architecture/`; ledger entry moves to Healed | Enforcement |

## Phase 0 — Client speaks MediaQuery

The class-level rename shipped 2026-06-24; the HTTP boundary and one prop still speak the dead
vocabulary. Surfaces (verified 2026-07-07):

- `src/hooks/useMediaQueries.ts` — `KEY = '/api/saved-queries'` → `/api/media-queries`.
- `src/components/QuerySourceList/index.tsx` — preview URLs `/api/saved-queries/:id/preview`, and the
  `savedQueries` prop (fed from `src/components/AutomationBuilder/index.tsx`) → rename to `queries`
  (or the settled term the tests land on).
- `src/pages/automations/index.tsx` — `saved-queries` heading ids (cosmetic, same sweep).
- `server/modules/index.ts` — delete the `/api/saved-queries` alias mount **last**, once no client
  call site remains; the route integration tests assert the alias 404s and the canonical path serves.

Ships: ledger's "MediaQuery naming residue" → Healed; deprecated row in `VOCABULARY.md` marked deleted.

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

## Phase 3 — providers module

Move into `server/modules/providers/`: all of `server/providers/` (connections, `roles.ts`,
`mediaSource.ts`, `mediaSourceFactory.ts`, `taskEnablement.ts`, normalize *stays for Phase 4*),
`services/providerSettingsService.ts`, `services/plexService.ts`, `services/tmdbService.ts`,
`utils/keyResolver.ts` (API-key resolution priority — a provider-connection concern),
`jobs/identityResolutionJob.ts` + `jobs/identityJobFactory.ts`. Craft `index.ts` as the public
interface — roles, factory, descriptor types, settings service, chosen export by export, never a
wholesale re-export. The existing `providers.handler/routes/schemas` stay — the module now owns its
logic as the North Star prescribes.

## Phase 4 — media module

Move into `server/modules/media/`: `domain/movie.ts` + `domain/show.ts`, `providers/normalizeMedia.ts`,
`utils/filterRegistry.ts` (+ `ContentType`), `utils/ratingsAggregation.ts`,
`services/mediaQueryEngine.ts`, `services/enrichmentMerge.ts`, `jobs/enrichmentJob.ts` +
`enrichment/` + `enrichmentJobFactory.ts`.
Absorb the three route-drawn modules: `filterFields/` (the descriptor projection), `backdrops/`,
`search/`. The crafted interface exports: `MediaItem`, `Normalized*`, `MEDIA_RULES`/`getRule`/the
descriptor projection, the engine. `automations` and `mediaQueries` consume only that interface.

## Phase 5 — mediaQueries module

`services/mediaQueryService.ts` → `modules/mediaQueries/`. This module owns the *construction* of
filters over enriched source data — `MediaQueryRecord` CRUD, filter-value persistence, query health —
its own domain, deliberately not grouped with automations. Its `index.ts` exports the crafted
interface (`MediaQueryService`, `MediaQueryRecord`, the health types) that automations and the HTTP
layer consume.

## Phase 6 — automations module

`services/automationService.ts`, `automationExecutor.ts`, `automationRunService.ts`,
`combinationEvaluator.ts`, `cron/automationScheduler.ts` → `modules/automations/`. Automations *use*
media queries; the logic stays separate — the join is the `automation_query_sources` database relation
plus the mediaQueries public interface. Verify the dependency direction holds: `automations` imports
only the `media`, `mediaQueries`, `providers` interfaces and kernel, and never reaches into query
internals.

## Phase 7 — auth, system, settings

`services/authService.ts` + `database/drizzleStore.ts` → `modules/auth/` (schema/migrations stay in
`server/database/`). Merge the name collision: `server/health/` (self-healing) + `modules/health/`
(liveness) + `services/systemTaskRunner.ts` → `modules/system/`. `settings` already matches the target.
End state: `server/services/`, `server/jobs/`, `server/cron/`, `server/domain/`, `server/health/`,
and `server/utils/` (emptied across Phases 2–6) deleted — empty directories are the phase's proof.

## Phase 8 — Enforcement and closure

- An automated import-boundary check (lint rule or a small arch test walking the dependency graph)
  fails CI on any cross-module import that bypasses a module's public interface or violates the
  declared direction.
- `docs/intent/server-architecture-north-star.md` → `docs/architecture/` (it is now fact);
  fracture ledger's "Server layering" entry → Healed with the final surface list; README updates
  (`server/README.md` directory map) land in the same PR.
