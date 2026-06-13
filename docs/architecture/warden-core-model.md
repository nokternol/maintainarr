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
Providers are the root dependency — nothing else has value without them. Each provider added unlocks more metadata → more predicates → more queries → more automations. Current: Radarr, Sonarr, Plex, Jellyfin, TMDB, OMDB, Overseerr, Tautulli, TvMaze. All extend `BaseMetadataProvider`, discriminated by `MetadataProviderType`. `ProviderSettingsService` is the central node feeding the media handler, automation executor, search, and settings. Invariant: **one active provider per type** (Phase 0).

## Filtering — single engine
One predicate registry (`server/utils/filterRegistry.ts`) backs both the automation executor and the media browse handler. Predicates apply to `Normalized*` domain shapes (`server/providers/normalizeMedia.ts`); enrichment (`media_enrichment`) is merged in via the shared `server/services/enrichmentMerge.ts`. Enriched predicates (overseerr/tmdb/watched) exclude on missing data rather than keeping all.

## Tasks & execution
`AutomationExecutor` runs a task against the ids a query matches. Task dispatch tables live in the executor (`RADARR_TASKS`, `SONARR_TASKS` — e.g. unmonitor, triggerSearch); `system` automations dispatch to `SystemTaskRunner` (identity/enrichment jobs). Scheduling via `croner`. The client task catalog (`PROVIDER_TASKS`/`PROVIDER_REGISTRY`) is the UI surface for the same set.

## Doc/graph conventions
`QUERIES_*` and `docs/in_progress/` are planning artifacts — read as intent, not built fact; deleted/moved when a phase ships (see root `CLAUDE.md`). The graphify graph is the searchable single source of truth for *what code exists and how it connects*; this file carries the *why* the graph can't derive from the AST.
