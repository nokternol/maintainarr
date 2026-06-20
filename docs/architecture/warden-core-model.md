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
Provider configuration **defines the entire capability surface**: which filter controls render in the UI, which enrichment is fetchable, which query options exist, and which tasks an automation can run. That is why `ProviderSettingsService` is the god node — not edge count, but that everything downstream is gated by what providers are configured. Each provider added unlocks more metadata → more predicates → more queries → more automations. Current: Radarr, Sonarr, Plex, Jellyfin, TMDB, OMDB, Overseerr, Tautulli, TvMaze. All extend `BaseMetadataProvider`, discriminated by `MetadataProviderType`. Invariant: **one active provider per type** (Phase 0).

## A configured system plays up to three roles
A "provider" is really a configured external *system* (just connection config), and a system plays **up to three independent capability roles**: **MediaSource** (owns catalog rows + a canonical id), **MetadataEnricher** (contributes metadata joined into the filter graph), **MediaActuator** (exposes actions/tasks). One system commonly holds several — Radarr is all three; TMDB is enricher-only. Roles are **declared per system, never assumed**: a system has a role only when it qualifies, so a system that lacks identifiers simply isn't a source, and a system with no write API simply has no tasks. This is the holistic model that per-task work must not contradict — collapsing the roles into one all-capable "provider" is the recurring source of design drift. Full model: `docs/intent/system-roles-and-capabilities.md`. As-built source/enricher tiering: `docs/architecture/provider-roles-and-identity.md`.

## Filtering — single engine, fed by enrichment data
One predicate registry (`server/utils/filterRegistry.ts`) backs both the automation executor and the media browse handler. Predicates apply to `Normalized*` domain shapes (`server/providers/normalizeMedia.ts`).

**The enrichment job is the join between "providers configured" and "filters that match something."** Provider config says *what enrichment is possible*; the `EnrichmentJob` (`server/jobs/enrichmentJob.ts`) materializes it into the `media_enrichment` table; `enrichmentMerge.ts` reads that table onto the normalized items the predicates run over. This is a **table-mediated data flow, not a call** — the writer and reader never reference each other in code, so the AST graph cannot see the link (it surfaces only as shared `media_enrichment` schema). Concretely: enriched predicates (overseerr/tmdb/watched) exclude on missing data rather than keeping all, so they return 0 until the job has populated the table.

## Tasks & execution
`AutomationExecutor` runs a task against the ids a query matches. Task dispatch tables live in the executor (`RADARR_TASKS`, `SONARR_TASKS` — e.g. unmonitor, triggerSearch); `system` automations dispatch to `SystemTaskRunner` (identity/enrichment jobs). Scheduling via `croner`. The client task catalog (`PROVIDER_TASKS`/`PROVIDER_REGISTRY`) is the UI surface for the same set — but it is a **separate, hand-synced catalogue that has drifted**: it advertises ~30 tasks (including for enricher-only systems) while the executor implements ~3, and `taskId` is unvalidated, so unrunnable tasks persist and fail at run time. Tasks are the surface of the **MediaActuator** role, not a property of every provider. As-built gap and the per-type role/task matrix: `docs/architecture/task-execution-and-actuator-gap.md`.

**On-demand execution (Run Now).** `POST /api/automations/:id/run` runs an automation outside its schedule. It calls `executor.execute(id)` directly — **not** `scheduler.trigger`, which only fires automations currently in the scheduler's jobs map (so a paused/disabled automation could not be run). The endpoint validates the id exists (404 otherwise), kicks the run off in the background (`void execute().catch(log)`), and returns **202** immediately — enrichment/identity runs take minutes, so the request never blocks on completion. Because this bypasses croner's `{ protect: true }`, the executor holds an **in-flight guard** (a `Set<number>` of running ids): a second `execute(id)` while one is in flight is a silent no-op, cleared in `finally`, so a manual run cannot overlap a scheduled run of the same automation.

**System vs user controls.** System automations are invariants that must keep firing: they are **Run-Now-only** — `updateStatus` (disable/enable) and `delete` both reject `kind='system'` (`assertMutable`). User automations support Run Now + disable + delete. `AutomationRow` derives control visibility from `automation.kind`. The UI verb model (Run Now / Disable / Archive — never Play/Pause, which would imply runtime control over an executing process) is set out in `docs/intent/automation-verbs-and-separation.md`.

## Doc/graph conventions
`QUERIES_*` and `docs/in_progress/` are planning artifacts — read as intent, not built fact; deleted/moved when a phase ships (see root `CLAUDE.md`). The graphify graph is the searchable single source of truth for *what code exists and how it connects*; this file carries the *why* the graph can't derive from the AST.
