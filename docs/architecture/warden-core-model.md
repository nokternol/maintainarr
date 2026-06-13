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

## Filtering — single engine, fed by enrichment data
One predicate registry (`server/utils/filterRegistry.ts`) backs both the automation executor and the media browse handler. Predicates apply to `Normalized*` domain shapes (`server/providers/normalizeMedia.ts`).

**The enrichment job is the join between "providers configured" and "filters that match something."** Provider config says *what enrichment is possible*; the `EnrichmentJob` (`server/jobs/enrichmentJob.ts`) materializes it into the `media_enrichment` table; `enrichmentMerge.ts` reads that table onto the normalized items the predicates run over. This is a **table-mediated data flow, not a call** — the writer and reader never reference each other in code, so the AST graph cannot see the link (it surfaces only as shared `media_enrichment` schema). Concretely: enriched predicates (overseerr/tmdb/watched) exclude on missing data rather than keeping all, so they return 0 until the job has populated the table.

## Tasks & execution
`AutomationExecutor` runs a task against the ids a query matches. Task dispatch tables live in the executor (`RADARR_TASKS`, `SONARR_TASKS` — e.g. unmonitor, triggerSearch); `system` automations dispatch to `SystemTaskRunner` (identity/enrichment jobs). Scheduling via `croner`. The client task catalog (`PROVIDER_TASKS`/`PROVIDER_REGISTRY`) is the UI surface for the same set.

## Doc/graph conventions
`QUERIES_*` and `docs/in_progress/` are planning artifacts — read as intent, not built fact; deleted/moved when a phase ships (see root `CLAUDE.md`). The graphify graph is the searchable single source of truth for *what code exists and how it connects*; this file carries the *why* the graph can't derive from the AST.
