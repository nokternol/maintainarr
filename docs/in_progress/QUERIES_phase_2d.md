# Phase 2d — Enrichment Pipeline Completion

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 2 shipped (all prior enrichment infrastructure in place)
**Blocks:** Phase 3 UI (but not Phase 3 backend combination model)
**Status:** READY FOR IMPLEMENTATION

---

## What this phase is and why

Phase 2 shipped the enrichment schema, filter predicates, and executor merge logic. However,
the enrichment **job** only populates one column (`tautulliPlayCount`). Every other enrichment
column is schema-only — the data is never fetched, so every predicate beyond `watched` and
`lastWatchedDaysAgo` (Tautulli-sourced) will silently return `false` for every item.

This phase closes those gaps:

1. **`mergeShowEnrichment`** — executor only merges enrichment for movies; show Tier 2 filters are no-ops
2. **Enrichment job completeness** — Tautulli `lastPlayed`, Plex view data, TMDB status, Overseerr request/issue data all need provider calls and DB writes
3. **Overseerr issues endpoint** — provider has `getRequests()` but no method to fetch issues per media item; `overseerrHasIssue` column is always NULL
4. **Step 2.8** — Tier 2 predicate controls in `MediaFilterBar` (provider-gated display)

Phase 3 (combination model backend) does NOT require this phase to be complete — it is
purely a schema + evaluator change. Step 2.8 UI controls are required before Phase 4.

---

## Gap inventory

### Gap 1 — `mergeShowEnrichment` missing

`AutomationExecutor.execute()` calls `mergeMovieEnrichment()` in the `contentType === 'movie'`
branch. The `contentType === 'show'` branch has no equivalent call.

**Effect:** All Tier 2 filter predicates on shows (`watched`, `lastWatchedDaysAgoGte/Lte`,
`overseerrHasIssue`, `overseerrRequestStatus`, `tmdbStatus`) silently return `false` even
when enrichment data is present.

**What to implement:**

Add `mergeShowEnrichment(normalized: NormalizedShow[], sonarrIds: number[]): Promise<void>`
to `AutomationExecutor`. The algorithm is identical to `mergeMovieEnrichment` but queries
`mediaIdentity` with `sourceType = 'SONARR'` and maps via `_sourceIds.sonarr`.

TDD note: the movie test pattern (seed identity + enrichment, assert only matched item
is acted on) applies directly. One cycle per field is unnecessary — a single cycle covering
the parallel structure is appropriate since the logic is a direct copy-with-substitution.

---

### Gap 2 — Enrichment job only writes `tautulliPlayCount`

`EnrichmentJob.run()` is Tautulli-only and only writes `tautulliPlayCount`. All other
enrichment columns are never written. The following need provider calls wired in:

| Column | Provider | Provider method needed | Notes |
|---|---|---|---|
| `tautulliLastPlayed` | Tautulli | `getHistory()` (already called) | Extract `played_at` from history item alongside play count |
| `plexViewCount` | Plex | `getWatchHistory()` or library items with `viewCount` | Plex `/library/sections/{id}/all?viewCount=1` |
| `plexLastViewedAt` | Plex | same as above | `lastViewedAt` field on Plex library item |
| `overseerrRequestStatus` | Overseerr | `getRequests()` (already exists) | Match by `media.tmdbId`; write `request.status` |
| `overseerrHasIssue` | Overseerr | new `getIssues()` method needed | `GET /api/v1/issue?take=100&skip=0` |
| `tmdbStatus` | TMDB | new `getMovieDetails(tmdbId)` / `getSeriesDetails(tmdbId)` | `GET /3/movie/{id}` or `/3/tv/{id}` → `status` field |

**Tautulli `lastPlayed`:** The `TautulliHistoryItem` type needs a `played_at: number` field (Unix
timestamp). The enrichment job already iterates history — add the timestamp extraction alongside
the existing play count aggregation. Pick the most-recent `played_at` per rating key.

**Overseerr `getRequests`:** The existing method returns `OverseerrRequest[]` with `status: number`
and `media.tmdbId`. The enrichment job can match by `tmdbId` from `media_identity`. No new
provider method needed — wire it in.

**Overseerr issues:** `GET /api/v1/issue` returns `{ results: OverseerrIssue[] }` where each
issue has `media.tmdbId` and a status. `overseerrHasIssue` should be `1` if any open issue
exists for that tmdbId. Add `getIssues(): Promise<OverseerrIssue[]>` to `OverseerrProvider`.
`OverseerrIssue` shape: `{ id: number; status: number; media: { tmdbId: number } }`.

**`overseerrHasIssue` INTEGER vs boolean:** Handled transparently by the `bit()` custom Drizzle
type (`server/database/columns/bit.ts`). The inferred type is `boolean | null`; the ORM converts
to/from `0|1` at the driver boundary. Application code (executor, enrichment job, filter registry)
works with `boolean` throughout — no manual conversion needed.

**TMDB status:** `OverseerrSearchResult.mediaInfo` is typed as `unknown` — Phase 2 design doc
flagged this. For TMDB status enrichment, add a dedicated TMDB provider call rather than
parsing `mediaInfo`. `TmdbService` already exists at `server/services/tmdbService.ts` —
check what methods it exposes before adding new ones.

---

### Gap 3 — Step 2.8: Tier 2 predicate controls in `MediaFilterBar`

Filter predicates for `watched`, `lastWatchedDaysAgoGte/Lte`, `overseerrHasIssue`,
`overseerrRequestStatus`, `tmdbStatus` exist in the registry but no UI controls expose them.

**Design (from Phase 2 spec):** Each Tier 2 control is shown only when the relevant provider
is active (`configuredTypes` is already in scope in `MediaFilterBar`). Controls should be
gated as follows:

| Predicate | Required provider |
|---|---|
| `watched`, `lastWatchedDaysAgoGte/Lte` | TAUTULLI or PLEX |
| `overseerrHasIssue`, `overseerrRequestStatus` | OVERSEERR |
| `tmdbStatus` | TMDB |

This does NOT block Phase 3 backend work but IS required before Phase 4 (full UI for
combination queries). Implement after Gap 1 + Gap 2 are closed.

---

## TDD session plan

**Session A — mergeShowEnrichment (Gap 1):**
1. Cycle: `mergeShowEnrichment` — executor applies Tier 2 filters on shows using enrichment DB

**Session B — Enrich job completeness (Gap 2, Tautulli + Overseerr):**
2. Cycle: `TautulliHistoryItem` gains `played_at`; enrichment job writes `tautulliLastPlayed`
3. Cycle: enrichment job writes `overseerrRequestStatus` from `getRequests()` matched by tmdbId
4. Cycle: `OverseerrProvider.getIssues()` fetches open issues
5. Cycle: enrichment job writes `overseerrHasIssue` from issues list

**Session C — Enrich job completeness (Gap 2, Plex + TMDB):**
6. Cycle: Plex provider exposes `viewCount` + `lastViewedAt` per item
7. Cycle: enrichment job writes `plexViewCount` + `plexLastViewedAt`
8. Cycle: enrichment job writes `tmdbStatus` via `TmdbService`

**Session D — UI controls (Gap 3, Step 2.8):**
9. Cycle: `MediaFilterBar` shows `watched` / `lastWatchedDaysAgo` controls when TAUTULLI or PLEX configured
10. Cycle: `MediaFilterBar` shows `overseerrHasIssue` / `overseerrRequestStatus` when OVERSEERR configured
11. Cycle: `MediaFilterBar` shows `tmdbStatus` when TMDB configured

---

## Acceptance criteria

- `mergeShowEnrichment` mirrors `mergeMovieEnrichment`; Tier 2 show filters pass when enrichment data present
- `tautulliLastPlayed` is written by enrichment job; `lastWatchedDaysAgoGte/Lte` filters work end-to-end for movies
- `overseerrRequestStatus` is written by enrichment job for items matched by tmdbId
- `overseerrHasIssue` is written as `1` when open issues exist for a media item's tmdbId, `0` when none
- `plexViewCount` and `plexLastViewedAt` are written by enrichment job
- `tmdbStatus` is written by enrichment job from TMDB API
- `MediaFilterBar` Tier 2 controls are gated by configured provider type
- All existing tests continue to pass
