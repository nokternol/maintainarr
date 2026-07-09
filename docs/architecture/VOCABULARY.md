# Vocabulary — the product's Ubiquitous Language

**Status:** AS-BUILT (current fact). The canonical name for each crystallized product concept, what it
means, and where it binds in code. **The TypeScript type is the binding source of truth**; this table is
the discoverable index into it. When a concept gets a settled name, record it here and stop writing the
deprecated names in new code. Formerly a section of
[`warden-core-model.md`](ref:path:docs/architecture/warden-core-model.md), which keeps the product loop
and model narrative; this doc owns the names.

Naming principle, learned the hard way (see the MediaQuery entry): **states are not names.** A persisted
query is not a different concept from a query — "saved" is a state of a database entity, so the persisted
shape is the concept's name plus `Record`, never a re-prefixed second vocabulary. Any surface that grows
a renamed second vocabulary for an existing concept is a fracture
([`fracture-ledger.md`](ref:path:docs/architecture/fracture-ledger.md)).

## Providers & roles

| Term | Meaning | Binds in code |
|---|---|---|
| **System / Provider** | A configured external *system* — connection config only, discriminated by [`MetadataProviderType`](ref:path:server/database/schema.ts). Configuring one unlocks capabilities; it does nothing by itself. Invariant: one active provider per type. | [`server/database/schema.ts`](ref:path:server/database/schema.ts) |
| **BaseProviderConnection** | The shared HTTP-client + config base every system extends. A *connection* base, not a role or metadata contract. | [`server/modules/providers/connections/baseProviderConnection.ts`](ref:path:server/modules/providers/connections/baseProviderConnection.ts) |
| **MediaSource** | Role: owns a media collection — what *exists* + a canonical per-item id. Advertises `getMediaItems()`/`idOf()`, not `getMovies`/`getSeries`. | [`server/modules/providers/mediaSource.ts`](ref:path:server/modules/providers/mediaSource.ts) |
| **MediaEnricher** | Role: contributes metadata about media it does *not* own, joined by a logical key; `enrich(items)` decorates the canonical `MediaItem`, precedence resolved per field at write time. Spec: [`media-enricher-role.md`](ref:path:docs/architecture/media-enricher-role.md). | [`server/modules/providers/roles.ts`](ref:path:server/modules/providers/roles.ts) |
| **MediaActuator** | Role: exposes actions on addressable media and **owns its tasks** via `tasks(): ActuatorTask[]` — the sole authority for what tasks exist. Spec: [`actuator-task-ownership.md`](ref:path:docs/architecture/actuator-task-ownership.md). | [`server/modules/providers/roles.ts`](ref:path:server/modules/providers/roles.ts) |
| **MediaSourceFactory** | Resolves a `ContentType` to its active owner provider bound as a `MediaSource` (`OWNER_TYPE`: movie→Radarr, show→Sonarr). | [`server/modules/providers/mediaSourceFactory.ts`](ref:path:server/modules/providers/mediaSourceFactory.ts) |
| **MediaSourceDescriptor** | The wire projection of `OWNER_TYPE`: `{ contentType, ownerType, configured }` per content type, served by `GET /api/media/sources` and read via [`useMediaSources`](ref:path:src/hooks/useMediaSources.ts) — the client derives source-ownership gating from this, never from its own provider-type literals. | [`server/modules/providers/mediaSourceFactory.ts`](ref:path:server/modules/providers/mediaSourceFactory.ts) |

A system plays **up to three independent roles** (Source, Enricher, Actuator), declared per system by
the role interfaces it `implements`, never assumed from the connection base. As-built tiering:
[`provider-roles-and-identity.md`](ref:path:docs/architecture/provider-roles-and-identity.md).

## Media & identity

| Term | Meaning | Binds in code |
|---|---|---|
| **ContentType** | `'movie' \| 'show'` — the axis provider ownership, rules, and query scoping all key on. | [`server/modules/media/filterRegistry.ts`](ref:path:server/modules/media/filterRegistry.ts) |
| **NormalizedMovie / NormalizedShow** | The canonical domain shapes predicates run over. Types live in [`server/modules/media/movie.ts`](ref:path:server/modules/media/movie.ts) / [`server/modules/media/show.ts`](ref:path:server/modules/media/show.ts); the per-provider mapping functions live in [`normalizeMedia.ts`](ref:path:server/modules/media/normalizeMedia.ts). | [`server/modules/media/movie.ts`](ref:path:server/modules/media/movie.ts) |
| **MediaItem / MediaItemSet** | `MediaItem = NormalizedMovie \| NormalizedShow`; a `MediaItemSet` is the transient result of resolving a source. Media-owned (the canonical superset); the `MediaSource`/`MediaEnricher` roles in providers reference it directly — a deliberate, narrow `providers → media` exception to the North Star's default direction, since a role contract has to name the shape it operates on. | [`server/modules/media/mediaItem.ts`](ref:path:server/modules/media/mediaItem.ts) |
| **Identity resolution** | The system job that links provider-native ids (Radarr/Sonarr/Plex guids) into the `media_identity` table so enrichers can join media they don't own. | [`server/modules/providers/identityResolutionJob.ts`](ref:path:server/modules/providers/identityResolutionJob.ts) |
| **Enrichment** | The materialized join between "providers configured" and "filters that match something": the [`EnrichmentJob`](ref:path:server/modules/media/enrichmentJob.ts) writes the `media_enrichment` table; [`enrichmentMerge.ts`](ref:path:server/modules/media/enrichmentMerge.ts) reads it onto normalized items. Table-mediated data flow — writer and reader never reference each other in code. Per-provider DTO → contributed-field mapping ([`mappers.ts`](ref:path:server/modules/providers/enrichment/mappers.ts)) and the match-and-decorate join ([`decorate.ts`](ref:path:server/modules/providers/enrichment/decorate.ts)) are providers-owned, typed as `Pick<MediaItem, ...>` subsets of media's canonical shape; precedence resolution ([`precedence.ts`](ref:path:server/modules/media/enrichment/precedence.ts)) is media-owned. | [`server/modules/media/enrichmentJob.ts`](ref:path:server/modules/media/enrichmentJob.ts) |

## Rules & queries

| Term | Meaning | Binds in code |
|---|---|---|
| **MediaRule / MediaRuleDescriptor** | The queryable predicate shapes: `MediaRule` pairs a `predicate` with `{ key, label, contentTypes, dataType, sourceProviders, required }`; `MediaRuleDescriptor` is its JSON-honest, predicate-free wire projection. `MEDIA_RULES` is the single authority — no client-side rule catalogue. Client derives its controls from `GET /api/filter-fields` ([`media.filterFields.handler.ts`](ref:path:server/modules/media/media.filterFields.handler.ts)) via [`useMediaRules`](ref:path:src/hooks/useMediaRules.ts), scoping state by content type because the registry intentionally reuses keys (`tagIds`, `qualityProfileIds`, `genres`) across movie/show. | [`server/modules/media/filterRegistry.ts`](ref:path:server/modules/media/filterRegistry.ts) |
| **MediaQuerySpec** | The persistable, source-less core of a query: `{ contentType, sources }`. | [`server/modules/media/mediaQueryEngine.ts`](ref:path:server/modules/media/mediaQueryEngine.ts) |
| **MediaQuery** | A `MediaQuerySpec` bound to a `MediaSource` — the engine's input. | [`server/modules/media/mediaQueryEngine.ts`](ref:path:server/modules/media/mediaQueryEngine.ts) |
| **MediaQueryRecord** | A `MediaQuerySpec` with database identity + presentation metadata (`id`, `name`, `health`). **"Saved" is a state, not a name** — the deprecated `SavedMediaQuery` vocabulary re-prefixed the concept instead of naming the state; its residue was healed in North Star Phase 0 (see the ledger). | [`server/modules/mediaQueries/mediaQueryService.ts`](ref:path:server/modules/mediaQueries/mediaQueryService.ts) |
| **MediaQueryService** | CRUD + health for `MediaQueryRecord`s (cradle key `mediaQueryService`, tables `media_queries` / `media_query_filter_values`, canonical route `/api/media-queries`). | [`server/modules/mediaQueries/mediaQueryService.ts`](ref:path:server/modules/mediaQueries/mediaQueryService.ts) |
| **Query health** | Per-record status (`healthy`/`degraded`/`unavailable`) derived from whether the providers its filter keys need are configured. | [`server/modules/mediaQueries/mediaQueryService.ts`](ref:path:server/modules/mediaQueries/mediaQueryService.ts) |

## Tasks & automations

| Term | Meaning | Binds in code |
|---|---|---|
| **ActuatorTask / ActuatorTaskDescriptor** | The role's task shapes: a descriptor (`id, label, destructive, affects?`) plus instance-bound `run(ids)`. Declared by `MediaActuator.tasks()` on the configured instance — no type-keyed table anywhere. | [`server/modules/providers/roles.ts`](ref:path:server/modules/providers/roles.ts) |
| **Task enablement** | Per-instance `settings.enabledTasks` (default off), read by `readEnabledTaskIds`; enforced at `automationService.create` and executor run. | [`server/modules/providers/taskEnablement.ts`](ref:path:server/modules/providers/taskEnablement.ts) |
| **Automation** | A query bound to a task on a schedule — the product's unit of action. `kind: 'user' \| 'system'`; system automations are invariants (Run-Now-only, cannot be disabled or deleted). Spec: [`system-vs-user-automations.md`](ref:path:docs/architecture/system-vs-user-automations.md). | [`server/modules/automations/automationService.ts`](ref:path:server/modules/automations/automationService.ts) |
| **AutomationExecutor** | Runs a task against the ids a query matches; binds the provider by `automation.provider.id`, dispatches via `source.tasks()`. Holds the in-flight guard that keeps manual and scheduled runs from overlapping. | [`server/modules/automations/automationExecutor.ts`](ref:path:server/modules/automations/automationExecutor.ts) |
| **SystemTaskRunner** | Dispatch target for `system` automations (identity/enrichment jobs) — internal jobs, deliberately not actuator tasks. | [`server/modules/system/systemTaskRunner.ts`](ref:path:server/modules/system/systemTaskRunner.ts) |
| **Run Now / Disable / Archive** | The UI verb model for automations — never Play/Pause, which would imply runtime control over an executing process. | [`src/pages/automations/index.tsx`](ref:path:src/pages/automations/index.tsx) |

## Deprecated names — stop writing these

| Deprecated | Canonical | Residue |
|---|---|---|
| `SavedMediaQuery`, `savedQueries`, `/api/saved-queries` | `MediaQuery` / `MediaQueryRecord`, `/api/media-queries` | Deleted (North Star Phase 0, healed) — the retired alias 404s by regression test. |
| `FILTER_FIELDS` (client rule catalogue) | Derived from `MediaRuleDescriptor[]` via `useMediaRules` | Deleted (Phase 4, healed). |
| `taskManifest` (type-keyed task table) | `MediaActuator.tasks()` on the instance | Deleted (Phase 3, healed). |
| `getMovies` / `getSeries` on sources | `getMediaItems()` on the `MediaSource` role | — |
