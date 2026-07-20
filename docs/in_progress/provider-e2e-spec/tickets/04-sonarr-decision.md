---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [04-sonarr-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Sonarr — decision

## Question

Using the Sonarr research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Sonarr's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/sonarr.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/sonarr.md](../specs/sonarr.md) — full e2e spec. Most cross-cutting decisions (delete-keep-
  files, move task, refresh/rescan/rename tasks, queue/history/instance-scoped-commands out of scope,
  the `added`/`plexAddedAt` split) were decided jointly with `03-radarr-decision` since the two
  providers share the same task/gap shapes — see that ticket's Resolution for the shared reasoning.

## Resolution

- **`hasFile` bug fixed for real**, not just excluded: derives a per-series equivalent
  (`episodeFileCount > 0`, "at least one episode file present") rather than leaving the rule silently
  broken for Sonarr.
- **`imdbId`/`tvMazeId` wired as identity fields** (`_sourceIds.imdb`/`_sourceIds.tvmaze`), not
  enrichment — per the user's explicit framing: external system IDs are the identity-matching job, not
  enrichment data. Both are schema-shaped additions (new optional fields on an existing interface),
  not structural.
- **Language-profile track built in full**: new `getLanguageProfiles()` fetch method,
  `languageProfileId` filter, `changeLanguageProfile` task — closes the asymmetry with the existing
  quality-profile pattern rather than leaving it partial.
- **Statistics and misc fields accepted**: `nextAiring`, `path`, `images[]`, and all
  four `statistics.*` fields.
- **`profileId` stays unwired** — legacy v2 field, dead in Sonarr's own API, same treatment as
  Radarr's identical dead `profileId`.
- **Structural items deferred, not decided here**: per-season data (`seasons[]`), episode/season/file-
  level task targeting (`EpisodeSearch`/`SeasonSearch`/`RenameFiles`), queue/history endpoints.
- **Naming collisions flagged for the precedence ticket**: `network` (Sonarr vs TVMaze, TVMaze's own
  decision ticket owns full resolution), `certification` value-format risk, `tags` instance-scoping
  pattern precedent for the new `languageProfileId` filter.

## Addendum (full ratings pass)

`ratings.votes` (alongside the already-live `communityRating`) moved out of `specs/sonarr.md`'s field
table to [`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md).
