# Task Execution & the Actuator Gap (as-built)

**Status:** AS-BUILT (current fact) — documents what the code does today, including the divergence
between advertised and executable tasks. The corrective target is the actuator role in
`docs/intent/system-roles-and-capabilities.md`.

## Tasks have no single definition — they exist in two unconnected places

"What can be done to media" is defined twice, on opposite sides of the HTTP boundary, with no shared
type and no reference between them:

- **Advertised (client):** `src/lib/provider-registry.ts` declares, per provider type, a
  `tasks: TaskDef[]` where `TaskDef = { id, label, description?, destructive }`. ~30 tasks across the
  providers. This is what the UI offers when building an automation.
- **Executable (server):** `server/services/automationExecutor.ts` holds three string-keyed dispatch
  tables — `RADARR_TASKS`, `SONARR_TASKS`, `SYSTEM_TASKS` — where each entry is `{ run, affects }`.
  This is what can actually run.

The only thing joining the two is `automations.taskId` (a bare `text` column) matching a key in both by
convention. There is no `Task` type, node, or community shared between them; the knowledge graph cannot
see the relationship because no code edge exists.

## The catalogue over-promises; the executor under-delivers

Executable provider tasks today, in full:

- `RADARR_TASKS`: `unmonitorMovie`, `triggerSearch`
- `SONARR_TASKS`: `unmonitorSeries`, `triggerSearch`
- `SYSTEM_TASKS`: `system:enrichment`, `system:identity-resolution` (internal jobs, not provider actions)

Everything else the UI advertises — `deleteMovieWithFiles`, `changeQualityProfile`, `addTag`,
`removeTag`, the entire Plex / Jellyfin / Tautulli task lists — has **no executor entry**. The executor
throws `Task "<id>" is not yet implemented` when such an automation runs.

There is **no guard** preventing this: the create/update schema validates `taskId: z.string().min(1)`
(`server/modules/automations/automations.schemas.ts`), so an automation bound to an unrunnable task —
including a `destructive` one — persists cleanly and only fails at execution time.

## The actuator role is duck-typed, and falsely universal

`BaseMetadataProvider` (`server/providers/baseMetadataProvider.ts`) is **only** a config holder plus a
configured `ky` HTTP client. It declares no `getMovies`, no enrichment, and no task contract. A concrete
provider (e.g. `RadarrProvider`) simply exposes whatever methods it needs — `getMovies()` (source),
`getTags()` (enricher), `unmonitorMovies()` / `triggerMoviesSearch()` (actuator) — all on one class with
nothing marking which role each method serves.

Because there is no actuator contract, the client registry treats **every** provider type as a potential
task host. Tasks are advertised for systems that cannot act on the catalog at all:

| Type | Source | Enricher | Actuator advertised | Actuator executable |
|---|---|---|---|---|
| RADARR | ✓ | ✓ | delete±files, unmonitor, search, quality, tags | unmonitorMovie, triggerSearch |
| SONARR | ✓ | ✓ | delete±files, unmonitor, search, quality, tags | unmonitorSeries, triggerSearch |
| PLEX | — | ✓ | delete, trash, refresh, mark played/unplayed | none |
| JELLYFIN | — | (wired for search/conn-test only) | delete, refresh, mark, add-to-collection | none |
| TAUTULLI | — | ✓ | delete history, notify, terminate stream | none |
| OVERSEERR | — | ✓ | (empty) | none |
| TMDB / OMDB / TVMAZE | — | ✓ | (none) | none |

Only the two catalog-owner types have any executable task. The actuator role advertised on
enricher-only and inert systems is the same false-equality assumption that the source/identity work
already corrected for the catalog-ownership role (see
`docs/architecture/provider-roles-and-identity.md`).

## `filterCapabilities` is a half-formed capability declaration

`ProviderEntry.filterCapabilities: string[]` (e.g. `['Watch history', 'Play statistics']`) is a per-type
declaration of what a system contributes — the right instinct toward a capability manifest. But it is
client-side, free-text display strings, untyped, unenforced, and unconnected to the source/enricher/
actuator roles or to anything the server consumes. It documents capability without modelling it.

## Why this is recorded

These are not bugs to be silently patched; they are the as-built shape of a single missing concept — the
**actuator role** and a server-authoritative **task manifest**. Recording them keeps the gap visible so
per-task work stops re-encoding the false-equality assumption, and so the corrective model in
`docs/intent/system-roles-and-capabilities.md` has a concrete starting point.
</content>
