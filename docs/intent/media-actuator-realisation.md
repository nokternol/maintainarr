# Realising the MediaActuator pattern

**Status:** INTENT (future state, not built) — design questions resolved, see "Resolved decisions"
below; implementation in progress on branch `actuator-realisation`. The `MediaActuator` role itself is shipped and as-built —
`server/modules/providers/roles.ts`, `docs/architecture/actuator-task-ownership.md`. This document covers
making the *non-source* actuators (Plex, Jellyfin, Tautulli) actually execute their declared tasks instead
of rejecting with "not yet implemented," plus the parameter contract several tasks need regardless of
provider. It's a distinct theme from the `MediaFieldProvider`/`MediaFieldSource` field-ownership model
(`docs/architecture/media-field-provider-role.md`, shipped) —
this work consumes whatever identity model exists today; it does not require that model to change first.

## The problem

`PlexProvider`, `TautulliProvider`, and `JellyfinProvider` all `implements MediaActuator` and declare a
real task vocabulary, but every task is a `modelledRun(...)` stub — confirmed in
`server/modules/providers/connections/{plexProvider,tautulliProvider,jellyfinProvider}.ts`. Unlike
Radarr/Sonarr (which are `MediaSource` *and* `MediaActuator` — they own the catalog rows their tasks act
on), none of these three is a `MediaSource`: they have no canonical per-item id of their own to hand
`run(ids)`. An automation's query resolves ids through Radarr/Sonarr; a Plex task has no way to translate
those into a `ratingKey`. Separately, four known tasks across both source and non-source actuators
(`changeQualityProfile`, `addTag`, `removeTag` on Radarr/Sonarr; `addToCollection` on Jellyfin) are
modelled but parameterless — `run(ids)` has nowhere to carry "which profile," "which tag," or "which
collection."

## Scoping the task vocabulary first

Not every declared task belongs in this system's domain, and pruning before designing the translation
seam matters — it changes how many real problems there are to solve:

- **`terminateStream` (Tautulli) is out of scope, prune it.** It addresses a live playback *session*, not
  an item in the media collection — a fundamentally different addressing concept (no stable identity the
  way a movie/show has one). This system acts on the collection, not on what's currently playing.
- **`sendNotification` (Tautulli) is out of scope, prune it.** It declares no `affects` and has no media
  target at all — it doesn't fit the item-addressed model any actuator task is expected to follow, and
  isn't an action on the media collection either.
- Everything else Plex/Jellyfin/Tautulli declare **is** item-addressed (`affects: 'media'`, or
  equivalent): `deleteFromLibrary`, `moveToTrash`, `refreshMetadata`, `markPlayed`, `markUnplayed`
  (Plex); `deleteItem`, `refreshMetadata`, `markPlayed`, `markUnplayed`, `addToCollection` (Jellyfin);
  `deleteWatchHistory` (Tautulli, the one task it has left after pruning). These are the real translation
  targets.
- These two prunes are decided but **not yet made in code** — this document records the decision for
  whoever picks up implementation; the actual deletion from `tautulliProvider.ts` happens then.

## Why it needs solving

- Two full actuator vocabularies (Plex, Jellyfin) plus one task (Tautulli's `deleteWatchHistory`) are
  currently dead code — declared, discoverable, enablable, but guaranteed to reject on invocation.
- Users can see and enable these tasks in an automation builder today (discovery already works), building
  automations that will always fail at run time. That's a worse experience than not exposing the task at
  all.

## The shape of the fix: id translation

- **There are two real translation targets, not three.** `media_identity` already carries
  `plexRatingKey` and `jellyfinItemId` columns. But only the Plex one is actually populated —
  `IdentityResolutionJob.runForPlex()` stamps `plexRatingKey` today. **There is no `runForJellyfin`
  anywhere in the codebase** — `jellyfinItemId` exists in the schema and migration and is written by
  nothing. So Plex's seam is half-built (column exists, resolution job doesn't fully cover it — verify
  coverage), and Jellyfin's is fully unbuilt.
- **Tautulli needs no seam of its own.** Confirmed in `enricherAdapters.ts`: `tautulliEnricher` already
  matches Tautulli history rows via `i._sourceIds.plex` — Tautulli has no identity space of its own, it
  reports entirely against Plex's rating key. Its one legitimate remaining task (`deleteWatchHistory`)
  resolves through the same `plexRatingKey` column Plex's own tasks use. This is a real fact about what
  Tautulli is (a Plex companion tool), not an artifact of bad modeling — nothing to "fix" here, but see
  the blocker below about what it implies for provider configuration.
- **The translation itself:** an actuator's tasks receive ids resolved by a query (Radarr/Sonarr
  canonical ids); the seam needs to translate those into the actuator's own addressable id via the shared
  identity graph (`media_identity`), joining on whatever logical key (`tmdbId`/`tvdbId`) both sides
  already agree on. This is per addressing-system (Plex-keyed, Jellyfin-keyed), not per-provider —
  Tautulli piggybacks on the Plex seam rather than needing its own.

## The shape of the fix: task parameters

- A task declares the shape of the argument it needs; `run` accepts it alongside `ids`. The natural place
  to *supply* the value is the automation itself — bound and validated against the live target list
  (profiles/tags/collections fetched from the instance) at create time — captured by a builder UI when
  the selected task declares a parameter. `automations` (schema) currently has `providerId` + `taskId`
  only; a parameter value needs a new column/field.
- All four known parameterized tasks (`changeQualityProfile`, `addTag`, `removeTag`, `addToCollection`)
  take exactly one parameter, each a single-select id from a live provider-fetched list — none need
  multiple parameters or free text. That's promising evidence for a narrow contract, but is **not**
  confirmed as the general pattern across providers.

## Resolved decisions

The two open questions above (final task vocabulary, parameter contract) were resolved by a research
spike against the official Plex, Jellyfin, and Tautulli API documentation (plexopedia + python-plexapi
source for Plex; the published OpenAPI spec for Jellyfin 10.10; the Tautulli API wiki for `/api/v2`).

### Final task vocabulary

One additional prune beyond the two already recorded: **`moveToTrash` (Plex) is out of scope, prune
it.** Plex exposes no per-item "move to trash" operation — "trash" in Plex is a scanner state for items
whose files went missing, not an action; the only trash-related endpoint is the per-library
`PUT /library/sections/{id}/emptyTrash`. The task as declared is unrealisable through the API.

The realisable vocabulary, with the confirmed endpoint per task:

| Provider | Task | API call |
|---|---|---|
| Plex | `deleteFromLibrary` | `DELETE /library/metadata/{ratingKey}` (deletes files; server must allow media deletion) |
| Plex | `refreshMetadata` | `PUT /library/metadata/{ratingKey}/refresh` |
| Plex | `markPlayed` | `GET /:/scrobble?identifier=com.plexapp.plugins.library&key={ratingKey}` |
| Plex | `markUnplayed` | `GET /:/unscrobble?identifier=com.plexapp.plugins.library&key={ratingKey}` |
| Jellyfin | `deleteItem` | `DELETE /Items/{itemId}` |
| Jellyfin | `refreshMetadata` | `POST /Items/{itemId}/Refresh?metadataRefreshMode=FullRefresh&imageRefreshMode=FullRefresh` |
| Jellyfin | `markPlayed` | `POST /UserPlayedItems/{itemId}?userId={userId}` |
| Jellyfin | `markUnplayed` | `DELETE /UserPlayedItems/{itemId}?userId={userId}` |
| Jellyfin | `addToCollection` | `POST /Collections/{collectionId}/Items?ids={id,…}` — parameterized (which collection) |
| Tautulli | `deleteWatchHistory` | `get_history` filtered by `rating_key` and by `grandparent_rating_key` (shows log history per episode) → collect `row_id`s → `delete_history&row_ids={comma-separated}` |
| Radarr | `changeQualityProfile` / `addTag` / `removeTag` | `PUT /api/v3/movie/editor` `{ movieIds, qualityProfileId }` / `{ movieIds, tags: [tagId], applyTags: 'add' \| 'remove' }` |
| Sonarr | `changeQualityProfile` / `addTag` / `removeTag` | `PUT /api/v3/series/editor` `{ seriesIds, … }` (same body shape as Radarr) |

### Parameter contract

All four parameterized tasks fit "exactly one parameter, a single-select provider-native id" — and the
per-API research confirmed nothing richer is needed for any of them (quality profile id, tag id,
collection id; each an id from a live provider-fetched list). Contract:

- `ActuatorTaskDescriptor` gains `parameter?: { label: string }` — declaring that the task takes one
  value. The descriptor stays a pure-data projection; discovery surfaces (builder UI) read it to know a
  value must be captured.
- `ActuatorTask.run(ids, parameterValue?)` — the value transports as a `string` (numeric for
  Radarr/Sonarr profile/tag ids, GUID for Jellyfin collection ids); each provider parses its own. A
  parameterized task invoked without its value rejects with a clear error, never a silent no-op.
- `run`'s ids widen to `Array<number | string>`: ids are always in the actuator's own addressing space
  — source-native numeric ids for Radarr/Sonarr, `plexRatingKey` strings for Plex/Tautulli,
  `jellyfinItemId` strings for Jellyfin. The executor guarantees the space by construction (see below).
- The automation stores the value in a new nullable `automations.taskParameter` column; the executor
  threads it into `run`. Capturing/validating the value against the live target list in the builder UI
  is follow-up presentation work, not part of this realisation.

### Id translation

- The executor branches on `isMediaSourceType(provider.type)`. Source actuators keep today's path
  (query evaluated against the actuator's own catalog, ids via `idOf`). Non-source actuators evaluate
  the query against the pooled catalog(s) of the content type's owning source instances
  (`MediaSourceFactory.sourcesFor`), then translate matched items to the actuator's addressing space:
  `media_item (providerId, externalId)` → `media_identity` → `plexRatingKey` / `jellyfinItemId`,
  deduplicated, nulls dropped.
- Translation is per addressing-space, not per-provider: Plex and Tautulli both address by
  `plexRatingKey`; Jellyfin by `jellyfinItemId`.
- `jellyfinItemId` gains its missing writer: `IdentityResolutionJob.runForJellyfin()` mirroring
  `runForPlex()`, matching Jellyfin items' `ProviderIds` (`Tmdb`/`Tvdb`) against the identity graph —
  confirmed available on `GET /Items?recursive=true&fields=ProviderIds&includeItemTypes=Movie,Series`.

## Blockers / friction

- **The parameter contract's cross-provider shape is an open, unresolved research question — flagged
  explicitly as an unknown, not assumed.** All four known cases fit "one parameter, single-select id,"
  but whether that generalizes (or whether some future task needs something richer) isn't known without
  looking at each provider's actual API shape. This needs research and likely a small POC before a
  contract is committed to, rather than being designed from the four known cases alone.
- **New fracture: provider configuration has no dependency model.** Tautulli's `deleteWatchHistory` (and
  its enrichment) only resolves anything if Plex is *also* configured — but nothing in the provider model
  declares, validates, or represents "this provider requires that provider." If a user configures Tautulli
  without Plex, its actuator task silently resolves zero ids every time, with no error surfaced anywhere.
  This is a generic providers-can-depend-on-providers gap, not Tautulli-specific — recorded here and, as
  its own document, `docs/intent/inter-provider-dependency.md` — its own investigation, out of scope to
  solve inside this document.
- Confirming Plex's seam actually covers every id-bearing case `runForPlex` is expected to handle (movies
  and series both use the same guid-matching loop) needs verification before relying on it as "the
  already-built half" of the translation work.
- This work can proceed against today's identity model as-is — the multi-instance `media_identity`/
  `media_item` split has already shipped (`docs/architecture/provider-roles-and-identity.md`) — the
  `MediaItem` shape change once tracked as unbuilt has also since shipped
  (`docs/architecture/media-field-provider-role.md`) and would touch how ids are read out of a
  resolved query result if revisited.
</content>
