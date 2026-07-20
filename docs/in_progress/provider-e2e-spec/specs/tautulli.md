---
type: wayfinder-spec
label: wayfinder:spec
provider: tautulli
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/05-tautulli-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/tautulli.md
---

# Tautulli — E2E spec

Tautulli is a `MediaEnricher` + `MediaActuator`. This spec applies a standing scoping premise: **only
per-item fields and per-item tasks are in scope.** Tautulli's API surface is heavily user-scoped,
session-scoped, library-level, and aggregate/reporting-shaped — all excluded by that premise, not
individually litigated below.

## Fields already wired (unchanged baseline)

| Domain field | Derivation | Flow |
|---|---|---|
| `playCount` | count of `get_history` rows per `rating_key` | `tautulliProvider.ts` → `tautulliFieldProvider` (`mediaFieldProvider.ts`) → `tautulliEnricher` → `watched` filter (`playCount > 0`) |
| `lastWatchedAt` | max `played_at` per `rating_key` | same chain → `lastWatchedDaysAgo` filter |

Task already wired: `deleteWatchHistory` (destructive, `get_history` lookup → `delete_history`).

## New fields to wire

| Domain field | Source | Notes |
|---|---|---|
| `fileContainer` | `get_library_media_info.container` | Per-item file technical metadata. |
| `fileBitrate` | `get_library_media_info.bitrate` | |
| `videoCodec` / `audioCodec` | `get_library_media_info.{video_codec,audio_codec}` | |
| `fileResolution` | `get_library_media_info.resolution` | Source-file resolution (distinct from any future played/post-transcode resolution — Tautulli's `get_stream_data`, which is per-play not per-item, stays out of scope). Enables "resolution below 1080p" filters. |
| `fileSizeBytes` | `get_library_media_info.file_size` | |
| `tautulliRecentlyAdded` | `get_recently_added` | See naming-collision note below — this is Tautulli's own mirror of the Plex library-add event, not a new independent concept. |

`get_library_media_info` is item-scoped (confirmed genuinely per-item, unlike the rest of Tautulli's
unwired surface), so it fits the existing flow: provider read → `tautulliFieldProvider` →
`tautulliEnricher` → `filterRegistry.ts`.

**Explicitly dropped**: `get_metadata` (title/summary/ratings/cast/genres). Tautulli sits on top of
Plex, and the domain model's `MediaSource` role for movies/shows now belongs to Radarr/Sonarr, not
Plex — a Plex-lineage metadata copy (direct or via Tautulli) can't be authoritative for that role.
Not "low priority" — structurally redundant given the current source-ownership design.

## Cleanup (in scope, not new capability)

`getLibraryStats()` (`get_libraries_table`) and `getHomeStats()` (`get_home_stats`) are implemented
and called by `TautulliProvider` today but consumed nowhere downstream — dead code. Both are also
library/instance-scoped, excluded by the per-item premise regardless. Remove both methods and their
unused return types (`TautulliLibraryStat`, `TautulliHomeStat`/`TautulliHomeStatRow`).

## Tasks / automation options

Unchanged: `deleteWatchHistory`. No new tasks — every other Tautulli action surface
(`delete_all_user_history`, `terminate_session`, `delete_all_library_history`,
`notify`/`notify_recently_added`) is user-scoped, session-scoped, library-scoped, or admin-scoped, all
excluded by the per-item-tasks-only premise.

## Out of scope (per-item premise, not structural — a scope decision, not a blocker)

- **Per-user data**: `get_users`, `get_user`, `get_users_table`, `get_user_watch_time_stats`,
  `get_user_player_stats`, `get_user_ips`, `get_user_logins`, `delete_all_user_history`,
  `undelete_user` — user-scoped or (user, item)-scoped, not per-item.
- **Session/live data**: `get_activity`, `terminate_session` — transient server state, not a
  persisted per-item fact; would need its own "Now Playing" feature surface entirely, not
  `filterRegistry`.
- **Aggregate/reporting**: `get_stream_data` (per-play, not per-item), `get_plays_by_stream_type`,
  `get_plays_by_source_resolution`, `get_plays_by_stream_resolution`.
- **Library-level (not item-level) stats**: `get_libraries`, `get_library`,
  `get_library_user_stats`, `get_library_watch_time_stats`, `delete_all_library_history`,
  `delete_library`, `undelete_library`.
- **Notifications**: `get_notifiers`, `notify*`, `add_notifier_config`, `set_notifier_config`,
  `delete_notifier` — admin/outbound-config, not media data.
- **Server/config/geo/logs**: all diagnostic/operational endpoints — out of scope entirely.
- **Infrastructure helpers**: `get_children_metadata`, `search`, `get_new_rating_keys`,
  `get_old_rating_keys` — id-resolution plumbing, not domain fields.

## Naming-collision notes (for the final precedence ticket)

- **`playCount`/`lastWatchedAt` vs Plex** — already resolved in `precedence.ts` (Tautulli wins).
  Confirmed genuinely distinct measurements (Tautulli counts completed-play history rows; Plex's is
  an "opens" counter). Listed for completeness, not open.
- **`tautulliRecentlyAdded` vs `plexAddedAt` — decided, not left open.** Unlike Radarr/Sonarr's
  `added` (a genuinely different event — addedAt-to-source vs addedAt-to-library — which must never
  contest with `plexAddedAt`), Tautulli's `get_recently_added` reflects the *same* Plex-library-add
  event as `plexAddedAt`, just observed through a second, potentially staler API. These two **should**
  contest, and **Plex wins** as the direct source. The precedence ticket should encode this rather
  than re-litigate it.
- **`fileResolution`/`videoCodec`/`audioCodec`/`fileBitrate`** — new field names Tautulli introduces
  first. No current collision (Radarr/Sonarr don't wire any equivalent file-technical-metadata fields
  today), but if either provider's own file-technical metadata is ever wired, it should follow these
  same names/shape rather than inventing parallel ones.

## Filter type mapping

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `fileContainer` | `fileContainer` | `csv-strings` | New rule. Multi-select over a small discrete value set (mkv, mp4, …), same shape as `certification`. |
| `fileBitrate` | `fileBitrate` | `range` | New rule. Numeric threshold filter ("bitrate above/below X"), same shape as `sizeOnDiskGb`. |
| `videoCodec` | `videoCodec` | `csv-strings` | New rule. Multi-select over a small discrete value set (h264, hevc, …). |
| `audioCodec` | `audioCodec` | `csv-strings` | New rule. Multi-select over a small discrete value set (aac, dts, …); kept as its own key rather than merged with `videoCodec` since they're independently selectable facets. |
| `fileResolution` | `fileResolution` | `csv-strings` | New rule. Source-file resolution is a small discrete tier set (2160p/1080p/720p/SD, etc.), not a raw numeric height — modeled as multi-select like `certification` rather than `range`. |
| `fileSizeBytes` | `fileSizeBytes` | `range` | **Reconciled**: kept as its own new rule rather than joining `sizeOnDiskGb` — Plex's and Jellyfin's independently-made mappings both treat this as a distinct concept (per-file size vs. `sizeOnDiskGb`'s aggregate on-disk total, which can diverge for shows with multiple episode files). Converged here for consistency across the three specs that share this field. |
| `tautulliRecentlyAdded` | `plexAddedDaysAgo` | `range` | Joins the existing `plexAddedDaysAgo` rule as a second producer. Per the naming-collision note above, this observes the same Plex-library-add event as `plexAddedAt`, just through a second, potentially staler API — Plex wins precedence, so this doesn't get its own filter key. |

### Tasks (automation options)

No new tasks — see spec.
