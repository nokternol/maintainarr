---
type: wayfinder-spec
label: wayfinder:spec
provider: radarr
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/03-radarr-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/radarr.md
---

# Radarr — E2E spec

Radarr is a `MediaSource` (movie) + `MediaActuator` — its own fields normalize directly onto
`NormalizedMovie` (`normalizeMedia.ts`) with no enrichment step, and its tasks are real API calls
(`radarrProvider.ts`). This spec extends that existing shape; it doesn't change Radarr's role.

## Bug fixes (in scope, not new capability)

| Bug | Fix |
|---|---|
| `monitored` filter rule is show-only (`contentTypes: ['show']`), so it never matches movies even though `NormalizedMovie.monitored` is already populated from Radarr. | Extend the rule's `contentTypes`/`sourceProviders` to include movies. |
| `addedDaysAgo`'s `sourceProviders` lists `PLEX` alongside `RADARR`/`SONARR`, but nothing populates `NormalizedMovie.addedDate` from Plex — stale listing. | Remove `PLEX` from `addedDaysAgo`'s `sourceProviders`. Radarr's `added` (addedAt-to-source) and Plex's `plexAddedAt` (addedAt-to-library/import) are permanently distinct concepts, not one field with competing producers — they must never be merged under one precedence rule, in this ticket or the final precedence ticket. |

## Fields to wire

All new fields follow the existing unprefixed pattern for source-owned movie fields (Radarr fields
normalize straight onto `NormalizedMovie`, no `radarr`-prefix needed except where flagged for
collision below). Flow: `radarrProvider.ts` (`RadarrMovie`) → `normalizeMedia.ts`
(`normalizeRadarrMovie`) → `NormalizedMovie` → `filterRegistry.ts`.

| Domain field | Source | Notes |
|---|---|---|
| `folderName` / `path` | `folderName`, `path` | Filesystem location — UI filter + display. |
| `movieFileCount` | `statistics.movieFileCount` | |
| `releaseGroups` | `statistics.releaseGroups` | |
| `overview` | `overview` | Display (plot synopsis), not a filter target. |
| `inCinemasDate` / `physicalReleaseDate` / `digitalReleaseDate` | `inCinemas`, `physicalRelease`, `digitalRelease` | Distinct milestones from `added`/`year` — enables filters like "digital release within 30 days". |
| `originalTitle` / `originalLanguage` / `alternateTitles` / `secondaryYear` / `sortTitle` / `cleanTitle` / `titleSlug` | title-variant fields | Mostly sort/display helpers, limited standalone filter value — wire for completeness/display. |
| `studio` | `studio` | Production company. |
| `collectionName` / `collectionTmdbId` | `collection.{name,tmdbId}` | Flattened scalar pair (not a relational join) — fits the existing `media_enrichment` EAV shape with no schema change. Supports "filter by collection name," not an efficient "list all movies in collection X" query. |
| `runtime` | `runtime` | Minutes — "runtime under 90 min" filter. |
| `isAvailable` | `isAvailable` | Computed availability flag. |
| `radarrStatus` | `status` (`tba`/`announced`/`inCinemas`/`released`/`deleted`) | **Radarr-prefixed to avoid collision** with `NormalizedShow.status` (series continuing/ended — different enum, different meaning). Flag for precedence ticket. |
| `minimumAvailability` / `rootFolderPath` | `minimumAvailability`, `rootFolderPath` | Config-surface — expose as read-only detail, not a filter widget. |
| `website` / `youTubeTrailerId` | `website`, `youTubeTrailerId` | External links, display only. |

**Not wired, no action needed**: `profileId` — legacy/duplicate of `qualityProfileId`, appears dead in
Radarr's own API. No wiring; flagged for completeness only.

**Ratings extracted to a dedicated intent doc, not wired as `EnrichmentFields` here**:
`ratings.imdb.votes`, `ratings.tmdb.{value,votes}`, `ratings.metacritic.{value,votes}`,
`ratings.rottenTomatoes.{value,votes}`, `ratings.trakt.{value,votes}` — all moved to
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md), which now owns
the full per-provider ratings inventory and the reasoning for why ratings don't fit the
shared-EnrichmentFields/precedence pattern the rest of this spec uses. The already-live `imdbRating`
field (movie, wired today) is unaffected — this only concerns net-new rating fields this spec had
proposed.

## Tasks / automation options

Already real (unchanged): `unmonitorMovie`, `triggerSearch`, `deleteMovieWithFiles`,
`changeQualityProfile`, `addTag`, `removeTag`.

| New/completed task | Endpoint | Notes |
|---|---|---|
| `deleteMovieKeepFiles` | DELETE `movie/{id}` with `deleteFiles=false` | Completes the existing `modelledRun` stub — same shape as `deleteMovieWithFiles`, different flag. |
| `moveMovie` | `MoveMovieCommand` / `BulkMoveMovieCommand` | Parameterized by target root folder (list already fetched via `getRootFolders()`, previously unused). |
| `refreshMovie` | `RefreshMovie` command | Re-pull metadata from Radarr's own metadata source; distinct from `triggerSearch`. |
| `rescanMovie` | `RescanMovie` command | Rescan the movie's folder on disk for unindexed files; distinct from `refreshMovie` and `triggerSearch`. |
| `renameMovies` | `RenameMovies` command | Apply the configured naming scheme to already-imported files. |
| `refreshCollection` | `RefreshCollectionsCommand` | Refresh collection metadata — only meaningful now that `collectionName`/`collectionTmdbId` are wired. |

**Out of scope this pass**: `MissingMoviesSearch` and `DownloadedMoviesScan` (instance-scoped, don't
fit the per-item `ActuatorTask.run(ids)` shape) — flagged as future work needing a new task kind.

## Out of scope (structural, flagged not designed)

- **Queue** (`GET /queue`) and **history** (`GET /history`) endpoints — 1:N per movie (many queue
  entries/history events over time), doesn't fit the `media_enrichment` EAV shape (one fact per
  identity+field). Needs its own table if ever built. Different UI shape too (event-log/progress
  view, not a filter predicate).
- Instance-scoped commands (`MissingMoviesSearch`, `DownloadedMoviesScan`) — every existing task is
  `run(ids)`, scoped to specific movies; these operate on the whole instance with no item scope.

## Naming-collision notes (for the final precedence ticket)

- **`added`** — Radarr's `added` (addedAt-to-source) must stay permanently distinct from Plex's
  `plexAddedAt` (addedAt-to-library/import). Already separate filter rules (`addedDaysAgo` vs
  `plexAddedDaysAgo`) — this spec's bug fix (removing the stale Plex listing from `addedDaysAgo`)
  reinforces that separation; the precedence ticket should treat this as settled, not open.
- **`radarrStatus`** vs `NormalizedShow.status` — different enums (movie release lifecycle vs series
  continuing/ended), disambiguated by the `radarr`-prefix.
- **`certification`** — shared verbatim across Radarr/Sonarr/TMDB/OMDB; different providers may format
  strings differently (`"PG-13"` vs country-prefixed). Value-format risk, not a name collision — flag
  for precedence ticket since the filter predicate does exact case-insensitive string match.

## Filter type mapping

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `folderName` / `path` | `folderPath` | `string` | New rule. Spec explicitly calls this "UI filter + display"; substring match on filesystem path, same shape as the existing `title` rule. |
| `movieFileCount` | `movieFileCount` | `number` | New rule. Exact-count match (or could later become `range`, but spec gives no "between" framing — following the narrower existing `number` dataType used by `overseerrRequestStatus`). |
| `releaseGroups` | `releaseGroups` | `csv-strings` | New rule. Multi-select-by-string-value, same shape as `genres`/`certification`. |
| `overview` | — | — | No filter, display/on-demand only (plot synopsis). |
| `inCinemasDate` | `inCinemasDaysAgo` | `range` | New rule. Date-shaped field modeled as "days ago" range, per the `addedDaysAgo`/`plexAddedDaysAgo` convention. |
| `physicalReleaseDate` | `physicalReleaseDaysAgo` | `range` | New rule. Same days-ago convention. |
| `digitalReleaseDate` | `digitalReleaseDaysAgo` | `range` | New rule. Same days-ago convention; spec's own example ("digital release within 30 days") is exactly this shape. |
| `originalTitle` / `originalLanguage` / `alternateTitles` / `secondaryYear` / `sortTitle` / `cleanTitle` / `titleSlug` | — | — | No filter, display/sort-helper only — spec flags these as "limited standalone filter value," wired for completeness/display, not as filter predicates. |
| `studio` | `studio` | `csv-strings` | New rule. Multi-select-by-string-value, same shape as `network` (show-side). |
| `collectionName` / `collectionTmdbId` | — | — | Joins existing pattern, not a standalone new rule: spec frames these as a flattened scalar pair fitting the `media_enrichment`/`EnrichmentFields` shape already used by fields like `tmdbStatus`. Recommend one `csv-strings` rule keyed `collectionName` (string multi-select) plus a `collectionTmdbId` `csv-ids` rule if "list movies in a specific collection by id" is needed — but spec says it only needs to support "filter by collection name," so `collectionTmdbId` may not need its own rule at all; scope to `collectionName` only unless id-based lookup is confirmed needed. |
| `runtime` | `sizeOnDiskGb`-style new `range` rule (`runtimeMinutes`) | `range` | New rule — spec's own example ("runtime under 90 min") is a range/bound query, same shape as `sizeOnDiskGb`. No existing runtime rule exists to join. |
| `isAvailable` | `isAvailable` | `boolean` | New rule. Same shape as `hasFile`/`monitored`. |
| `radarrStatus` | `radarrStatus` | `string` | New rule, deliberately not joining `seriesStatus` — different enum (movie release lifecycle vs series continuing/ended), same reasoning the spec already gives for the field's name prefix. |
| `minimumAvailability` / `rootFolderPath` | — | — | No filter, read-only config-surface detail per spec. |
| `website` / `youTubeTrailerId` | — | — | No filter, display-only external links. |

Ratings fields (`ratings.imdb.votes`, `ratings.tmdb.*`, `ratings.metacritic.*`, `ratings.rottenTomatoes.*`,
`ratings.trakt.*`) are out of scope here — tracked in
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md).

### Tasks (automation options)

| Task | Parameter shape |
|---|---|
| `deleteMovieKeepFiles` | none |
| `moveMovie` | single-select (target root folder) |
| `refreshMovie` | none |
| `rescanMovie` | none |
| `renameMovies` | none |
| `refreshCollection` | none |
