---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [01-plex-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Plex — decision

## Question

Using the Plex research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Plex's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/plex.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/plex.md](../specs/plex.md) — full e2e spec.

## Resolution

- **Corrected framing established this session**: overlap across genuinely independent sources
  (Plex's own metadata agent vs. Radarr/Sonarr/TMDB) is valuable redundancy, not waste — unlike
  Tautulli's `get_metadata`, dropped last session because Tautulli merely re-reads Plex's own
  database with zero independent value. This distinction now governs field scope across the whole
  map, not just Plex.
- **Shared-field strategy**: `genres`, `certification`, `studio`, `runtime` (unit-converted from
  Plex's ms), and file-technical-metadata (container/codec/resolution/bitrate/size, shared with
  Tautulli's already-wired fields) all add Plex as another producer of existing multi-producer
  fields. `playCount`/`lastWatchedAt` gain Plex... already wired, but now also gain Jellyfin as a
  third producer (see `02-jellyfin-decision`).
- **Ratings kept separate by design, not merged**: `plexRating`/`plexAudienceRating` stay
  provider-prefixed — provenance is agent-dependent and scale-incompatible with `imdbRating`. Noted
  as a candidate future input to a `MediaRatingsProvider` blending role (explicitly not designed
  this session, too early).
- **New `releaseDate` field**, distinct from `year` and from Radarr's milestone-specific dates,
  shared with Jellyfin's `PremiereDate`.
- **`plexLabels`** (string tags) shares one field with Jellyfin's `Tags`, kept apart from the
  numeric `tagIds` rule (incompatible types).
- **No new tasks** — every remaining Plex capability (scan-all, empty trash, optimize DB, session
  control) is library/server/session-scoped, excluded by the per-item-only premise.
- **Structural gaps raised and deferred, not designed**: collections, playlists, multi-user (Plex
  Home) watch data, sessions/now-playing, webhooks, plex.tv Universal Watchlist.
- **Verification flagged, not decided**: whether `guids` is actually consumed downstream or just
  declared-and-unused.

## Addendum (from the TMDB/OMDB session)

`summary`/`tagline` moved from `EnrichmentFields` to on-demand item-detail metadata (JSDoc-noted,
not batch-computed) — a refined principle established while spec'ing TMDB/OMDB: data nobody would
filter on doesn't belong in enrichment. See `specs/plex.md`'s amendment note.

## Addendum (full ratings pass, from the TVMaze session)

`plexRating`/`plexAudienceRating` moved out of `specs/plex.md`'s field table to
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md) — kept
provider-prefixed there too, same reasoning as before (opaque provenance/scale), just consolidated
with every other provider's ratings instead of scattered per-spec.
