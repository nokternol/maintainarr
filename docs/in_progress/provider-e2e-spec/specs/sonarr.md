---
type: wayfinder-spec
label: wayfinder:spec
provider: sonarr
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/04-sonarr-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/sonarr.md
---

# Sonarr — E2E spec

Sonarr is a `MediaSource` (show) + `MediaActuator`, symmetric to Radarr — see
[`specs/radarr.md`](radarr.md) for the parallel shared decisions (delete-keep-files, move task,
refresh/rescan/rename tasks, queue/history and instance-scoped commands all out of scope, and the
permanent `added`/`plexAddedAt` split). This file covers Sonarr-specific field/task decisions.

## Bug fix (in scope, not new capability)

The `hasFile` filter rule lists Sonarr as a `sourceProvider`, but `NormalizedShow` has no `hasFile`
field — the predicate always reads `undefined`, so the filter silently never matches a show. Fixed by
deriving a real per-series equivalent instead of just excluding Sonarr from the rule:

- **`hasFile` (show) = `episodeFileCount > 0`** — at least one episode file present. Mirrors Radarr's
  `hasFile` semantics (movie has its file) applied at the series level: "any content downloaded," not
  "fully downloaded." Requires `statistics.episodeFileCount` to be wired (see below).

## Fields to wire

### Identity fields (not enrichment)

Per domain framing: external system IDs are the identity-matching job, not enrichment data. These add
to `NormalizedShow._sourceIds` (`show.ts`), not `EnrichmentFields`.

| Field | Source | Notes |
|---|---|---|
| `_sourceIds.imdb` | `imdbId` | `NormalizedMovie._sourceIds` already has `imdb`; `NormalizedShow._sourceIds` doesn't — adding this closes that asymmetry. Schema-shaped (new optional field on an existing interface), not a table/column change. |
| `_sourceIds.tvmaze` | `tvMazeId` | Already typed on `SonarrSeries` (`sonarrProvider.ts:24`) but never read. New identity slot, same non-structural shape as `imdb` above. |

### Series fields (source-owned, flow: `sonarrProvider.ts` → `normalizeMedia.ts` → `NormalizedShow` → `filterRegistry.ts`)

| Domain field | Source | Notes |
|---|---|---|
| `nextAiring` | `nextAiring` | Symmetric to the already-wired `previousAiring`/`lastAiredAt` — "next episode in N days" filter. |
| `path` | `path` | Filesystem location — filter + display. |
| `images` | `images[]` | Poster/fanart — display only, not a filter/query concern. |
| `seasonCount` | `statistics.seasonCount` | |
| `episodeFileCount` | `statistics.episodeFileCount` | Also backs the `hasFile` bug fix above. |
| `episodeCount` / `totalEpisodeCount` | `statistics.{episodeCount,totalEpisodeCount}` | |

**Not wired, no action needed**: `profileId` — legacy v2 field superseded by `qualityProfileId`,
appears dead in Sonarr's own API. No wiring; flagged for completeness only.

**Ratings extracted to a dedicated intent doc**: `ratings.votes` (alongside the already-live
`communityRating` value) moved to
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md) — see that doc
for why ratings don't fit the shared-EnrichmentFields pattern the rest of this spec uses. The
already-live `communityRating` field is unaffected.

## Language-profile track (new capability, mirrors the existing quality-profile pattern)

Sonarr has no equivalent of Radarr's quality-profile completeness for language profiles today — no
fetch method, no filter, no task. Building the full parallel track:

- `getLanguageProfiles()` — new fetch method on `SonarrProvider` (mirrors `getProfiles()`).
- `languageProfileId` filter — instance-scoped, same pattern as `qualityProfileIds`.
- `changeLanguageProfile` task — `PUT series/editor` with `languageProfileId`, same shape as
  `changeQualityProfile`.

## Tasks / automation options

Already real (unchanged): `unmonitorSeries`, `triggerSearch`, `deleteSeriesWithFiles`,
`changeQualityProfile`, `addTag`, `removeTag`.

| New/completed task | Endpoint | Notes |
|---|---|---|
| `deleteSeriesKeepFiles` | DELETE `series/{id}` with `deleteFiles=false` | Completes the existing `modelledRun` stub — same fix as Radarr's `deleteMovieKeepFiles`, second DELETE call shape rather than unblocking the stub as-is. |
| `moveSeries` | equivalent PUT-based move (root folder change) | Parameterized by target root folder (`getRootFolders()` already fetched, previously unused). |
| `refreshSeries` | `RefreshSeries` command | Refreshes metadata from the indexer (TheTVDB) without touching disk. |
| `rescanSeries` | `RescanSeries` command | Rescans disk for existing files without searching for new ones; distinct from `refreshSeries`. |
| `renameSeries` | `RenameSeries` command | Applies the configured naming format to series folder/files. |
| `changeLanguageProfile` | `PUT series/editor` | See language-profile track above. |

**Out of scope this pass, structural**: `EpisodeSearch`, `SeasonSearch`, `RenameFiles` — need
episode/season/file-level targeting; `ActuatorTargetId` only addresses at the series level today, no
nested addressing space exists. `MissingEpisodeSearch`, `RssSync`, `Backup`,
`DownloadedEpisodesScan` — instance-scoped, same as Radarr's instance-scoped exclusions.

## Out of scope (structural, flagged not designed)

- **Per-season data** (`seasons[]`: `seasonNumber`, `monitored`) — the current model normalizes a
  series to one flat row; per-season monitor state or filtering needs a child table.
- **Queue and history endpoints** — same shape/scope note as Radarr's spec; not per-series scalar
  facts, doesn't fit `media_enrichment`.

## Naming-collision notes (for the final precedence ticket)

- **`network`** — Sonarr's `network` and TVMaze's `network` both feed the same `network` filter rule
  (`sourceProviders: [SONARR, TVMAZE]`). Sonarr's is current-network-per-TheTVDB-record; TVMaze's can
  differ and additionally has a separate `webChannel` field. Not resolved here — TVMaze's own
  decision ticket owns the full resolution.
- **`certification`** — see Radarr's spec; same value-format risk, shared verbatim key across four
  providers.
- **`tags`** — Sonarr and Radarr both produce `tags: number[]` with identical shape but separate id
  spaces per instance; already correctly handled via `instanceScoped: true`. Same treatment should
  extend to the new `languageProfileId` filter.
- **`added`** — see Radarr's spec; Sonarr's `added` (addedAt-to-source) stays permanently distinct
  from Plex's `plexAddedAt` (addedAt-to-library), already separate filter rules today.

## Filter type mapping

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `languageProfileId` | `languageProfileIds` | `csv-ids` | New rule; instanceScoped, same pattern as the existing `qualityProfileIds` show rule. |
| `nextAiring` | `nextAiringDaysAgo` | `range` | New rule; "days ago" framing doesn't fit a future date — see below. |
| `path` | `path` | `string` | New rule; substring match, same shape as `title`. |
| `images` | — | — | No filter, display/on-demand only (poster/fanart, per spec's own note). |
| `seasonCount` | `seasonCount` | `number` | New rule; exact/threshold match on a small integer count. |
| `episodeFileCount` | — | — | No filter mapping of its own — backs the `hasFile` rule's predicate fix (already an existing rule) rather than exposing a separate filter. |
| `episodeCount` / `totalEpisodeCount` | `episodeCount` | `range` | New rule; joins the numeric-range convention already used for `episodePercentage`/`seasonCount`-adjacent counts. Covers both fields as a min/max span (`totalEpisodeCount` is the practical upper bound users filter against; `episodeCount` alone is redundant with `episodePercentage`, already wired). |

Note on `nextAiring`: the file's own dates-as-range convention is "days ago" for *past* events
(`addedDaysAgo`, `plexAddedDaysAgo`, `lastAiredDaysAgo`). `nextAiring` is forward-looking (next
episode in N days), so `nextAiringDaysAgo` is a naming mismatch — flagged here, not resolved: the
range mechanics (`inRange` over a day-count) are identical either direction, only the sign/label
differs. Leaving the exact key name (`nextAiringDaysAgo` vs. `nextAiringInDays`) to whoever wires
the rule.

### Tasks (automation options)

- `deleteSeriesKeepFiles` — none (acts on the already-targeted series, no extra parameter).
- `moveSeries` — single-select (target root folder, from `getRootFolders()`).
- `refreshSeries` — none.
- `rescanSeries` — none.
- `renameSeries` — none.
- `changeLanguageProfile` — single-select (target language profile id, instance-scoped, same shape as `changeQualityProfile`).
