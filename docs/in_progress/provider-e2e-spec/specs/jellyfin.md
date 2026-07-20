---
type: wayfinder-spec
label: wayfinder:spec
provider: jellyfin
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/02-jellyfin-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/jellyfin.md
---

# Jellyfin — E2E spec

Jellyfin is wired today only as a `MediaActuator` (5 tasks) and an identity bridge
(`mediaIdentity.jellyfinItemId`, stamped but never joined to anything). This spec turns it into a real
`MediaEnricher` too. Same two standing principles as [`specs/plex.md`](plex.md): per-item
fields/tasks only, and genuine cross-provider redundancy (Jellyfin is an independently-configured
alternate media server, not a proxy of anything already wired) is valuable, not wasteful.

## Prerequisite: identity join key

**Nothing below can work without this first.** `mediaIdentity.jellyfinItemId` exists as a column, but
the runtime `_sourceIds` type (`movie.ts`, `show.ts`, `normalizeMedia.ts`) has no `jellyfin` key, so no
`MediaFieldProvider` can key a Jellyfin-sourced field map by it today. Adding `_sourceIds.jellyfin` is
schema-shaped (new optional field on an existing interface, same non-structural class as adding
`_sourceIds.tvmaze` for Sonarr last session) — not a new table/column, but every field below is
blocked on it.

## Fields already wired (unchanged baseline)

`ProviderIds` (Tmdb/Tvdb/Imdb) → identity resolution only. Tasks: `deleteItem`, `refreshMetadata`,
`markPlayed`, `markUnplayed`, `addToCollection`.

## New fields to wire

### Shared fields (Jellyfin becomes an additional producer, precedence order flagged for the final ticket)

| Domain field | Source | Shared with |
|---|---|---|
| `genres` | `Genres`/`GenreItems` | Radarr (movie), Sonarr + TMDB (show), Plex |
| `certification` | `OfficialRating` | Radarr, Sonarr, TMDB, OMDB, Plex |
| `studio` | `Studios` | Radarr, Plex |
| `runtime` | `RunTimeTicks` (ticks → minutes) | Radarr, Plex. Movies only, same scope limit as Plex's `duration`. |
| `fileContainer` / `videoCodec` / `audioCodec` / `fileResolution` / `fileSizeBytes` | `MediaSources`/`MediaStreams` | Tautulli, Plex |
| `playCount` / `lastWatchedAt` | `PlayCount`, `LastPlayedDate` (`Played` boolean synthesizes to 0/1 if `PlayCount` absent) | Tautulli (wins today), Plex |
| `releaseDate` | `PremiereDate` | Plex's `originallyAvailableAt` (new field, see `specs/plex.md`) |

### New fields, provider-prefixed (not shared)

| Domain field | Source | Notes |
|---|---|---|
| `jellyfinAddedAt` | `DateCreated` | **Not** unified with `plexAddedAt` — both are "added to this media server's library" events, but a user typically runs one server or the other, and renaming the already-shipped `plexAddedAt`/`plexAddedDaysAgo` (migration 0017) is a bigger, separately-scoped change. Kept prefixed for this pass. |
| `jellyfinLabels` | `Tags` (string array) | Shared string-tag field with Plex's `Label` (see `specs/plex.md`) — free-text, kept separate from the numeric `tagIds` rule. |

### New fields, no existing analog anywhere

| Domain field | Source | Notes |
|---|---|---|
| `isFavorite` | `IsFavorite` | Scoped to the single configured Jellyfin user per instance (today's model — one `userId` per configured instance, not full multi-user). New "favorited" filter, no collision risk. |

### On-demand metadata (not enrichment — amended after the TMDB/OMDB session)

`Overview` and `Name` (the latter redundant with `title` regardless) move here rather than
`EnrichmentFields`. Same refined principle as `specs/plex.md`'s amendment: data nobody would filter
on is on-demand item-detail metadata (JSDoc-noted for a future "full item detail" capability), not a
batch-computed enrichment field.

**Ratings extracted to a dedicated intent doc**: `CommunityRating`/`CriticRating` moved to
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md) as
`jellyfinCommunityRating`/`jellyfinCriticRating` — same reasoning as Plex's ratings (kept
provider-prefixed, agent-dependent provenance/scale).

## Tasks / automation options

| New task | Endpoint | Notes |
|---|---|---|
| `removeFromCollection` | `DELETE /Collections/{id}/Items` | Natural counterpart to the already-wired `addToCollection` — same external-collection-id parameter shape, no new `ActuatorTaskParameter` type needed. |

**Dropped from this pass**: `createCollection` — needs a new "create new vs. select existing"
task-parameter shape that the current `ActuatorTaskParameter` model (single-select/free-text) doesn't
support. Bigger lift than the other additions; not decided here.

## Out of scope (structural or not per-item, flagged not designed)

- **Sessions API** (`GET /Sessions`, playback control) — live/ephemeral state, session-addressed not
  item-addressed.
- **Users API** (`GET /Users`, multi-user listing) — the app hardcodes one Jellyfin user per instance
  today; real multi-user filtering (watched-by-user-X) needs a per-user table.
- **Library-wide refresh** (`POST /Library/Refresh`) and **ScheduledTasks API** — server-scoped, not
  item-scoped, no target id.
- **People (cast/crew)** — one-item-to-many-people relationship, needs a relational shape, not a
  scalar column.
- **PlaybackPositionTicks** (in-progress/partially-watched) — genuinely new concept, but not scoped
  into this pass.
- **SeriesId/SeasonId episode-context fields** — this app operates at movie/show level; per-episode
  granularity isn't modeled for any provider today.

## Naming-collision notes (for the final precedence ticket)

- **`genres`/`certification`/`studio`/`runtime`/file-tech fields** — Jellyfin joins the same
  multi-producer rules as Plex/Radarr/Sonarr/TMDB/Tautulli (see `specs/plex.md` for the parallel
  notes). Precedence order not decided here.
- **`playCount`/`lastWatchedAt`** — now three producers (Tautulli, Plex, Jellyfin). Jellyfin's rank
  among them is undecided.
- **`jellyfinAddedAt`** vs `plexAddedAt` vs Radarr/Sonarr's `added` — three "added" concepts now exist
  across two different dimensions (library-added-to-server vs. added-to-source); `jellyfinAddedAt` and
  `plexAddedAt` are conceptually the same *kind* of event from mutually-exclusive server choices, kept
  separate by design (see field notes above).
- **`jellyfinLabels`** vs `tagIds` — string vs numeric, incompatible types, not a literal-name
  collision but flagged per the ticket's "flag every same-concept field" requirement.

## Filter type mapping

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `genres` | `genres` | `csv-strings` | Joins existing `genres` rule (movie and show variants) — Jellyfin becomes an additional producer, no new rule. |
| `certification` | `certification` | `csv-strings` | Joins existing `certification` rule — Jellyfin becomes an additional producer, no new rule. |
| `studio` | `studio` | `csv-strings` | No existing rule covers studio/network-of-origin for movies; new rule, string multi-select like `genres`/`network`. |
| `runtime` | `runtimeMinutes` | `range` | No existing rule; new range rule (minutes), movie-only per spec's stated scope limit (parallels Plex's `duration`). |
| `fileContainer` | `fileContainer` | `csv-strings` | **Correction**: the spec explicitly lists this as a shared field with Tautulli/Plex, joining the same multi-producer filter those specs mint — not display-only. Categorical small value set (mkv, mp4, …), same shape as `certification`. |
| `videoCodec` | `videoCodec` | `csv-strings` | Same correction and reasoning as `fileContainer` — shared with Tautulli/Plex. |
| `audioCodec` | `audioCodec` | `csv-strings` | Same correction and reasoning as `fileContainer` — shared with Tautulli/Plex. |
| `fileResolution` | `fileResolution` | `csv-strings` | Same correction and reasoning as `fileContainer` — shared with Tautulli/Plex. Discrete tier set (2160p/1080p/720p/SD), not a raw numeric height. |
| `fileSizeBytes` | `fileSizeBytes` | `range` | **Correction**: shared with Tautulli/Plex per the spec, not display-only. Kept as its own rule, distinct from `sizeOnDiskGb` (on-disk total vs. per-file size) — not merged into that rule. |
| `playCount` | `watched` | `boolean` | Joins existing `watched` rule — Jellyfin becomes an additional producer alongside Tautulli/Plex, no new rule. |
| `lastWatchedAt` | `lastWatchedDaysAgo` | `range` | Joins existing `lastWatchedDaysAgo` rule — Jellyfin becomes an additional producer, no new rule. |
| `releaseDate` | `releaseDaysAgo` | `range` | **Correction**: the spec explicitly shares this field with Plex's `originallyAvailableAt` (see `specs/plex.md`) as a real filterable field, not identity/crosswalk data. Joins the same `releaseDaysAgo` rule Plex mints — "days ago" convention, not a raw date picker. |
| `jellyfinAddedAt` | `jellyfinAddedDaysAgo` | `range` | New rule — deliberately kept prefixed and separate from `plexAddedDaysAgo` per the spec's naming-collision notes (mutually-exclusive server choices). Follows the "days ago" range convention, not a raw date type. |
| `jellyfinLabels` | `labels` | `csv-strings` | **Reconciled**: joins the same `labels` rule Plex's `plexLabels` mints (see `specs/plex.md`) — the spec explicitly frames this as one shared string-tag field, not two prefixed ones. Free-text tags, kept separate from the numeric `tagIds` rule. |
| `isFavorite` | `jellyfinIsFavorite` | `boolean` | New rule — scoped to the single configured Jellyfin user per instance. Key prefixed since the value is meaningful only relative to that instance's configured user, not a cross-provider concept. |

`Overview` and `Name` are on-demand item-detail metadata per the spec, not enrichment fields — no filter mapping. `CommunityRating`/`CriticRating` are deferred to `docs/intent/media-ratings-provider.md` — no filter mapping here.

### Tasks (automation options)

- `removeFromCollection` — single-select (external collection id, same shape as the existing `addToCollection` task).
