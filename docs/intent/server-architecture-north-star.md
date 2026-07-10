# Server architecture North Star — full DDD feature modules

**Status:** INTENT (unbuilt). This is the single design every server-side change should converge on.
It exists because the server currently runs three competing designs at once (see the "Server layering"
entry in `docs/architecture/fracture-ledger.md` for the as-built evidence): a boilerplate
"clean architecture" the READMEs used to describe, a transport-modules + flat-services split that is
what's actually built, and the domain-module ambition `server/modules/README.md` always hinted at.
This doc picks one — the third — and defines it precisely enough that any relocation question has
exactly one answer.

## The design

**Feature modules own everything for their domain** — schemas, handlers, routes, services, domain
logic, and jobs. The flat `server/services/` layer dissolves into the modules that own each service.
A module is a vertical slice of the product, not an HTTP surface.

**Sharing model: public-API imports + a small kernel.**

- Each module exposes a **deliberately crafted public interface** via its `index.ts`. This is *not* a
  barrel file — it must never wholesale re-export the module's internals. It exports the minimal,
  intentionally designed surface other modules and the HTTP layer consume: the types, functions, and
  services that form the module's contract, chosen one by one. Anything not exported is private, and a
  growing export list is a design smell to challenge, not a convenience.
- A small `server/kernel/` holds true infrastructure with no domain meaning: the event bus, logger,
  config, database handle, error hierarchy, middleware, and `defineRoute`. Every module may depend on
  the kernel; the kernel depends on no module.
- **The container splits into mechanism, registrations, and assembly**, and every module phase
  produces its own registrations slice — this is not optional scaffolding, it's how a module's public
  interface extends to its DI contract. `server/kernel/container.ts` is the mechanism: it registers
  only the kernel's own dependencies (`config`, `db`, `eventBus`) with no domain meaning.
  Each module owns a `<module>.registrations.ts` beside its `index.ts`, exporting a
  `<Module>Cradle` interface (the slice of the app cradle the module contributes) and a
  `register<Module>Dependencies(container)` function (the `asClass`/`asValue` bindings for that
  slice) — `server/modules/providers/providers.registrations.ts` is the shipped template. `server/
  container.ts` is assembly: it composes `Cradle` from `KernelCradle` and every module's `<Module>
  Cradle`, calls `createKernelContainer()` then each module's `register<Module>Dependencies()`, and
  owns nothing domain-specific itself. A module phase is incomplete if its services are still
  registered inline in `server/container.ts` instead of through its own registrations file.
- No event-driven ceremony for synchronous flows: when automations needs to evaluate media rules, it
  imports the media module's public API directly. The event bus is for genuinely asynchronous
  domain events, not a mandatory indirection.

**Dependency direction follows the product loop** (providers unlock metadata → predicates → queries →
automations): `automations → media, mediaQueries`; `mediaQueries → media, providers`;
`media → providers`; everyone → `kernel`. Cycles between module interfaces are design errors.

One narrow, deliberate exception: providers' `MediaSource`/`MediaEnricher` role contracts
(`modules/providers/mediaSource.ts`, `roles.ts`) reference media's `MediaItem` type directly. A role
contract has to name the shape it operates on, and `MediaItem` is media's canonical superset
(`NormalizedMovie | NormalizedShow`) — there is no meaningful role vocabulary that doesn't mention it.
Everything a provider *contributes* stays expressed as a `Pick<MediaItem, ...>` of that shape rather than
a hand-declared parallel type, so the subset relationship is compiler-checked, not just structural
coincidence. The exception extends to every concrete class that *implements* one of these roles
(`RadarrProvider`/`SonarrProvider` implementing `MediaSource`; `PlexProvider`/`TautulliProvider`/
`OverseerrProvider`/`TmdbProvider` implementing `MediaEnricher`; the `enrichment/` mapping helpers
feeding them) — a class can't implement a contract that names `MediaItem` without referencing
`MediaItem` itself, so the contract and its implementations share one boundary, not two. This is the
only sanctioned `providers → media` import; a new one anywhere else is a design error like any other
cycle.

## Target module inventory

```
server/
  kernel/          # eventBus, logger, config, db, errors, middleware, defineRoute
  modules/
    providers/     # connections (BaseProviderConnection + per-system), roles,
                   # MediaSourceFactory, provider settings service, task enablement,
                   # identity-resolution job
    media/         # normalize + NormalizedMovie/NormalizedShow shapes, filterRegistry
                   # + MediaRuleDescriptor projection (today's filterFields endpoint),
                   # mediaQueryEngine, enrichment job + merge, backdrops, search
    mediaQueries/  # MediaQueryRecord CRUD + query health
    automations/   # automation service, executor, run service, combinationEvaluator,
                   # scheduler (today's server/cron/)
    auth/          # authService, session store (drizzleStore)
    system/        # health endpoints, systemHealthCheck, ensureSystemJobs,
                   # systemTaskRunner, failedStateMiddleware
    settings/
```

Boundary decisions this inventory encodes:

- **`filterFields`, `backdrops`, `search` are media concerns**, not modules — they were separate only
  because module boundaries were drawn by HTTP route, not by domain aggregate.
- **`mediaQueries` stays its own module** (not folded into media, and never grouped with automations):
  it owns the *construction* of filters over enriched source data — `MediaQueryRecord` CRUD,
  filter-value persistence, query health — which is enough logic to live on its own. Automations
  *use* media queries but their logic is separate: the join is database entities
  (`automation_query_sources` relates an automation to the queries it runs against) plus the
  mediaQueries public interface — automations never reach into query internals.
- **Both `health` homes merge into `system`.** Today `server/modules/health/` (HTTP liveness) and
  `server/health/` (system self-healing: `ensureSystemJobs`, `failedStateMiddleware`) are two different
  processes sharing one name; `system` owns both.
- **`filterRegistry` leaves `utils/`.** The single authority for the rule vocabulary is media-module
  domain logic, not a "small utility" beside `defineRoute`.
- **Orphan directories dissolve**: `server/cron/` → automations, `server/jobs/` → media (enrichment)
  and providers (identity), `server/domain/` → media, `server/health/` → system.

## What does not change

- The transport pattern inside a module (schemas / handlers / routes, `defineRoute`, Zod validation,
  Awilix cradle injection) is kept as-is — it is the part of the current design that works.
- Server-side authority principles already won by healed fractures stay won: registries project
  descriptors, roles own their tasks, the client derives and never re-declares.

## Migration stance

No migration plan lives here. Moves toward this design are phased through `docs/in_progress/` plans as
they are picked up; each shipped move updates `docs/architecture/` (and the fracture ledger) to record
the new as-built state. When the layout above is fully real, this doc moves to `docs/architecture/`.
