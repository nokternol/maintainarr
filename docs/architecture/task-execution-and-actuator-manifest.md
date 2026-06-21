# Task Execution & the Actuator Manifest (as-built)

**Status:** AS-BUILT (current fact). The server owns a single declaration of the actuator tasks a system
can run, the executor dispatches from it, and automation create validates against it. This is the
realised form of the **MediaActuator** role; the unifying three-role model is
`docs/intent/system-roles-and-capabilities.md`, and the source/enricher roles are
`docs/architecture/provider-roles-and-identity.md`.

## The manifest is the single definition of an actuator task

`server/services/taskManifest.ts` holds one map keyed by `MetadataProviderType`, each value a list of
`TaskDescriptor`:

```ts
interface TaskDescriptor {
  id: string;
  label: string;
  destructive: boolean;
  affects?: 'media';
  run: (provider: RadarrProvider | SonarrProvider, ids: number[]) => Promise<void>;
}
```

A descriptor unifies what was previously split across the HTTP boundary: the client's presentation shape
(`id`, `label`, `destructive`) and the server's dispatch (`run`, `affects`). `taskManifest(type)` returns
a type's descriptors; `publicTaskManifest()` projects every entry with `run` stripped
(`PublicTaskDescriptor`) — the serializable shape the client consumes.

Actuator tasks today, in full:

- **RADARR:** `unmonitorMovie`, `triggerSearch`, `deleteMovieWithFiles` (destructive)
- **SONARR:** `unmonitorSeries`, `triggerSearch`, `deleteSeriesWithFiles` (destructive)

Every other type maps to `[]`. A type holds tasks only when it plays the actuator role, so enricher-only
and inert systems (TMDB/OMDB/TVMaze, Plex, Jellyfin, Tautulli, Overseerr) expose **none** — the
false-equality assumption (advertising tasks for systems that cannot act) is gone, asserted directly by
`taskManifest('TMDB') === []`.

## The executor dispatches from the manifest

`server/services/automationExecutor.ts` resolves a provider task by
`taskManifest(provider.type).find(t => t.id === taskId)` and calls `descriptor.run(source, ids)`. The
standalone `RADARR_TASKS` / `SONARR_TASKS` dispatch tables are deleted — the manifest is the only place a
provider task is declared. `descriptor.affects` drives the `media:changed` event emission.

`SYSTEM_TASKS` (`system:enrichment`, `system:identity-resolution`) remain separate: they are internal
jobs run via `SystemTaskRunner`, not provider actuator actions, and are not part of the manifest surface.

## Roles are declared, not duck-typed

`server/providers/roles.ts` declares `MediaSource`, `MetadataEnricher`, and `MediaActuator`; concrete
providers `implements` the ones they hold (Radarr/Sonarr currently declare all three — though the
`MetadataEnricher` declaration is the mis-grounded one noted below). `BaseMetadataProvider` is
renamed `BaseProviderConnection` to reflect that it is a connection/HTTP base, not a metadata contract.
The roles are mostly type-level; their observable proof is the manifest — an enricher-only type yields an
empty task list.

## Create-time validation closes the over-promise

`automationService.create` rejects a `taskId` absent from the bound provider's manifest (a
`ValidationError`), replacing the old `taskId: z.string().min(1)`. An automation can no longer persist a
task the executor cannot run — including a `destructive` one — so the previous "persists cleanly, throws
at run time" failure mode is gone.

## Exposure

`GET /api/providers/tasks` (`server/modules/providers/providers.routes.ts`) returns
`publicTaskManifest()` — the per-type manifest with `run` stripped — so the client derives its task
catalogue from the server instead of holding its own.

## Known limitations (corrective targets)

1. **The enricher role is mis-grounded (`MetadataEnricher`).** As built, `MetadataEnricher` is the owner
   key (`enrichmentSourceType: 'RADARR'|'SONARR'`) implemented only by Radarr/Sonarr — the inverse of the
   role. The genuine enrichers (Plex/Tautulli/Overseerr/TMDB) declare nothing, and `TmdbProvider`
   implements no role. The corrected target — rename to `MediaEnricher`, behavioral `enrich(items)`,
   canonical-`MediaItem` shared model — is `docs/intent/media-enricher-role.md`. The actuator concern this
   doc records is unaffected by that drift.
2. **`filterCapabilities` remains a half-formed declaration.** `ProviderEntry.filterCapabilities:
   string[]` is still client-side, free-text, untyped, and unconnected to the role model — it documents
   capability without modelling it. Unifying it with the role/manifest surface is unstarted.
</content>
