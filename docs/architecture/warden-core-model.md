# Warden — Core Model

**Read before any feature work.** Warden is a media-library *warden*: automate what happens to media based on its metadata. The whole product is one loop.

```
Providers (configured by user)
  → unlock metadata capabilities
  → metadata maps to filter predicates
  → predicates combine into saved queries
  → saved queries define a media collection
  → tasks run against that collection (scheduled or one-off)
  → that is an automation
```

**Example:** "Unmonitor items added by automatic lists, >90 days old, not watched."
Providers: Radarr (`addedBy`, `addedDate`) + Tautulli/Plex (watch history). Predicates: `addedBy=list`, `addedDaysAgo>90`, `watched=false`. Task: unmonitor in Radarr.

## Provider centrality
Provider configuration **defines the entire capability surface**: which filter controls render in the UI, which enrichment is fetchable, which query options exist, and which tasks an automation can run. That is why `ProviderSettingsService` is the god node — not edge count, but that everything downstream is gated by what providers are configured. Each provider added unlocks more metadata → more predicates → more queries → more automations. Current: Radarr, Sonarr, Plex, Jellyfin, TMDB, OMDB, Overseerr, Tautulli, TvMaze. All extend `BaseProviderConnection` (an HTTP-client + config base — *not* a role contract), discriminated by `MetadataProviderType`; the capability roles a system holds are declared by the role interfaces it `implements` (`server/providers/roles.ts`), never by extending the base. Invariant: **one active provider per type** (Phase 0).

## A configured system plays up to three roles
A "provider" is really a configured external *system* (just connection config), and a system plays **up to three independent capability roles**: **MediaSource** (owns catalog rows + a canonical id), **MetadataEnricher** (contributes metadata joined into the filter graph), **MediaActuator** (exposes actions/tasks). One system commonly holds several — Radarr is all three; TMDB is enricher-only. Roles are **declared per system, never assumed**: a system has a role only when it qualifies, so a system that lacks identifiers simply isn't a source, and a system with no write API simply has no tasks. This is the holistic model that per-task work must not contradict — collapsing the roles into one all-capable "provider" is the recurring source of design drift. Full model: `docs/intent/system-roles-and-capabilities.md`. As-built source/enricher tiering: `docs/architecture/provider-roles-and-identity.md`.

## Ubiquitous Language
The canonical name for each crystallized concept. **The TypeScript type is the binding source of truth**; this table is the discoverable index into it. When a concept gets a settled name, record it here. Stop writing the deprecated names in new code.

| Term | Meaning | Binds in code |
|---|---|---|
| **MediaSource** | Role: owns a media collection — what *exists* + a canonical per-item id. Advertises `getMediaItems()`/`idOf()`, not `getMovies`/`getSeries`. | `server/providers/mediaSource.ts` |
| **MetadataEnricher** | Role: contributes metadata about media it does *not* own, joined by a logical key. | `server/providers/roles.ts` |
| **MediaActuator** | Role: exposes actions (tasks) on addressable media. A system without it has no tasks. | `server/providers/roles.ts` |
| **BaseProviderConnection** | The shared HTTP-client + config base. A *connection* base, not a role/metadata contract. | `server/providers/baseProviderConnection.ts` |
| **MediaQuerySpec** | The persistable, source-less core: `{ contentType, sources }`. Shared by the two below. | `server/services/mediaQueryEngine.ts` |
| **MediaQuery** | A `MediaQuerySpec` bound to a `MediaSource` — the engine's input. | `server/services/mediaQueryEngine.ts` |
| **SavedMediaQuery** | A `MediaQuerySpec` with a database identity + presentation metadata (`id`, `name`, `health`). *Was `SavedQueryDto`.* | `server/services/savedMediaQueryService.ts` |
| **MediaItemSet** | The transient result of resolving/evaluating a source: normalized items. | `server/providers/mediaSource.ts` |
| **TaskDescriptor / task manifest** | The single server declaration of an actuator task (`id, label, destructive, affects?, run`) and the per-type map of them. | `server/services/taskManifest.ts` |
| **MediaSourceFactory** | Resolves a `ContentType` to its active owner provider bound as a `MediaSource`. | `server/providers/mediaSourceFactory.ts` |
| **Normalized\*** | Canonical domain shapes (`NormalizedMovie`/`NormalizedShow`) predicates run over. | `server/domain/`, `server/providers/normalizeMedia.ts` |

**Deprecated → use:** `BaseMetadataProvider` → `BaseProviderConnection`; `SavedQueryDto`/`SavedQueryService` → `SavedMediaQuery`/`SavedMediaQueryService`; `savedQuery`/`savedFilter` (as a concept name) → `MediaQuery`/`SavedMediaQuery`. The `/api/saved-queries` route and the `savedQueries`/`savedQueryFilterValues` DB tables and the `savedQueryService` cradle key remain under their old names as a back-compat surface (alias mounted at `/api/media-queries`); the DB-table rename is deferred until its data-migration cost is worth paying.

## Filtering — single engine, fed by enrichment data
One predicate registry (`server/utils/filterRegistry.ts`) backs both the automation executor and the media browse handler. Predicates apply to `Normalized*` domain shapes (`server/providers/normalizeMedia.ts`).

**The enrichment job is the join between "providers configured" and "filters that match something."** Provider config says *what enrichment is possible*; the `EnrichmentJob` (`server/jobs/enrichmentJob.ts`) materializes it into the `media_enrichment` table; `enrichmentMerge.ts` reads that table onto the normalized items the predicates run over. This is a **table-mediated data flow, not a call** — the writer and reader never reference each other in code, so the AST graph cannot see the link (it surfaces only as shared `media_enrichment` schema). Concretely: enriched predicates (overseerr/tmdb/watched) exclude on missing data rather than keeping all, so they return 0 until the job has populated the table.

## Tasks & execution
`AutomationExecutor` runs a task against the ids a query matches. The **task manifest** (`server/services/taskManifest.ts`) is the single server-side declaration of actuator tasks — `TaskDescriptor { id, label, destructive, affects?, run }` keyed by `MetadataProviderType`. The executor dispatches from it (`taskManifest(providerType).find(...)`); `system` automations dispatch to `SystemTaskRunner` (identity/enrichment jobs), kept separate because they are internal jobs, not provider actuator tasks. Scheduling via `croner`. Tasks are the surface of the **MediaActuator** role, not a property of every provider — an enricher-only type (TMDB) contributes no manifest entries. `automationService.create` validates `taskId ∈ manifest(boundProviderType)`, so an unrunnable task **cannot persist** (it no longer fails at run time). `GET /api/providers/tasks` serves the `run`-stripped manifest; the client registry (`src/lib/provider-registry.ts`) is being migrated to derive from it (Phase 3) instead of hand-syncing. As-built gap and the per-type role/task matrix: `docs/architecture/task-execution-and-actuator-gap.md`.

**On-demand execution (Run Now).** `POST /api/automations/:id/run` runs an automation outside its schedule. It calls `executor.execute(id)` directly — **not** `scheduler.trigger`, which only fires automations currently in the scheduler's jobs map (so a paused/disabled automation could not be run). The endpoint validates the id exists (404 otherwise), kicks the run off in the background (`void execute().catch(log)`), and returns **202** immediately — enrichment/identity runs take minutes, so the request never blocks on completion. Because this bypasses croner's `{ protect: true }`, the executor holds an **in-flight guard** (a `Set<number>` of running ids): a second `execute(id)` while one is in flight is a silent no-op, cleared in `finally`, so a manual run cannot overlap a scheduled run of the same automation.

**System vs user controls.** System automations are invariants that must keep firing: they are **Run-Now-only** — `updateStatus` (disable/enable) and `delete` both reject `kind='system'` (`assertMutable`). User automations support Run Now + disable + delete. `AutomationRow` derives control visibility from `automation.kind`. The UI verb model (Run Now / Disable / Archive — never Play/Pause, which would imply runtime control over an executing process) is set out in `docs/intent/automation-verbs-and-separation.md`.

## Doc/graph conventions
`QUERIES_*` and `docs/in_progress/` are planning artifacts — read as intent, not built fact; deleted/moved when a phase ships (see root `CLAUDE.md`). The graphify graph is the searchable single source of truth for *what code exists and how it connects*; this file carries the *why* the graph can't derive from the AST.
