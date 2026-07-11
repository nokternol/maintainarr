# Non-source actuators can't yet derive ids to run against (intent)

**Status:** INTENT (not built). The one open item left from the three-role model
(MediaSource/MediaEnricher/MediaActuator) course-correction — everything else that model called for has
shipped and is recorded as as-built: `docs/architecture/provider-roles-and-identity.md`,
`docs/architecture/media-enricher-role.md`, `docs/architecture/actuator-task-ownership.md`.

## The gap

`PlexProvider`, `TautulliProvider`, and `JellyfinProvider` all `implements MediaActuator` and declare a
real task vocabulary (`deleteFromLibrary`, `markPlayed`, `terminateStream`, `refreshMetadata`, …), but
every single one of those tasks is still a **modelled stub** (`modelledRun`, throws "not yet
implemented") — confirmed in `server/modules/providers/connections/{plexProvider,tautulliProvider,
jellyfinProvider}.ts`. Unlike Radarr/Sonarr (which are `MediaSource` *and* `MediaActuator` — they own the
catalog rows their tasks act on), none of these three systems is a `MediaSource`: they have no canonical
per-item id of their own to hand `run(ids)`.

An automation binds `(provider instance, query, task)`; the query resolves against a `MediaSource` to get
ids. A Plex/Tautulli/Jellyfin task has no such source to resolve against — the ids an automation's query
produces come from Radarr/Sonarr, not from the actuator that would run the task. Wiring these tasks to do
anything real means answering: how does a non-source actuator translate the ids a query already resolved
(Radarr/Sonarr canonical ids) into *its own* addressable ids (a Plex `ratingKey`, a Jellyfin item id, a
Tautulli session)?

## What this needs (unbuilt)

- A translation step between "ids a query resolved via a `MediaSource`" and "ids a non-source
  `MediaActuator` can address" — most plausibly via the identity graph (`media_identity`) these actuators
  already join enrichment through, if the actuator can be reached by the same logical key
  (`tmdbId`/`tvdbId`/`plexRatingKey`) it already speaks for enrichment.
- Confirmation that every non-source actuator's task vocabulary is actually reachable this way — Plex and
  Jellyfin route by their own item id, not the movie/show canonical id, so the translation is per-system,
  not generic.
- Once resolvable, the modelled `deleteFromLibrary`/`markPlayed`/`terminateStream`/etc. stubs become real.

## Relationship to the shipped model

This is the one item the original "system roles & capabilities" course-correction didn't close (the
model, role interfaces, per-instance task ownership, and per-instance enablement all shipped — see the
three architecture docs above). It isn't a fracture in the shipped model; it's the next capability the
model enables once solved.
