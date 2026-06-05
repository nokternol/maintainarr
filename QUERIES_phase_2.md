# Phase 2 — Tier 2 Enrichment Pipeline

**Repo:** `/home/nokternol/repos/sandbox`  
**Prerequisite:** Phase 0b complete (ID graph validated empirically via RatingsPanel); Phase 1 shipped  
**Blocks:** Phase 3  
**Status:** BLOCKED on Phase 1

---

## What this phase is and why

Tier 1 predicates (Phase 1) filter on data that lives in Radarr/Sonarr responses directly.
Tier 2 predicates require joining data from a second provider — e.g. "is this Radarr movie
also watched in Plex?" or "does this Sonarr series have an open Overseerr issue?".

That join requires:
1. A **media identity table** mapping each Radarr/Sonarr item to its cross-provider IDs
2. An **enrichment table** storing fetched data from Plex, Tautulli, Jellyfin, Overseerr, TMDB, OMDB, TVMaze
3. An **enrichment job** that keeps those tables fresh
4. Filter branches that join the enrichment table at evaluation time

**Read `INVENTORY.md` before starting.** The identity graph design, `media_identity` schema,
enrichment column list, and join chain analysis are all there. Do not re-derive them.

---

## Context window strategy

This is the largest phase. Split into at minimum 3 sessions:

**Session A — Identity resolution (schema + job):** Steps 2.1–2.3  
**Session B — Data enrichment (job + Tier 2 filter branches):** Steps 2.4–2.6  
**Session C — AutomationExecutor join + UI controls:** Steps 2.7–2.8

Each session ends with a commit. The schema migration is the hardest recovery point — if context
is lost mid-migration, the DB may be in a partial state. Always run `yarn vitest run` before
committing a migration to confirm the DB initialises cleanly in tests.

**Use haiku subagents for:**
- Reading the existing migration files to understand naming conventions (`ls server/database/migrations/`)
- Reading existing schema columns to avoid duplicating names
- Writing boilerplate enrichment job scaffolding once the interface is designed

Test runner: `yarn vitest run --project server`

---

## Files involved

### New files
| File | Purpose |
|---|---|
| `server/database/migrations/0004_media_identity.sql` | `media_identity` table |
| `server/database/migrations/0005_media_enrichment.sql` | `media_enrichment` table |
| `server/jobs/identityResolutionJob.ts` | Populates `media_identity` from Radarr/Sonarr |
| `server/jobs/enrichmentJob.ts` | Populates `media_enrichment` from secondary providers |

### Modified files
| File | Action |
|---|---|
| `server/database/schema.ts` | Add `mediaIdentity` and `mediaEnrichment` Drizzle table definitions |
| `server/providers/radarrProvider.ts` | Ensure `tmdbId`, `imdbId` are in `RadarrMovie` (Phase 1 adds these) |
| `server/providers/sonarrProvider.ts` | Ensure `tvdbId`, `tmdbId`, `imdbId`, `tvMazeId` in `SonarrSeries` |
| `server/providers/plexProvider.ts` | Add `guids` array to `PlexMediaItem` type |
| `server/providers/jellyfinProvider.ts` | Add `ProviderIds` object to `JellyfinItem` type |
| `server/providers/overseerrProvider.ts` | Type `mediaInfo` properly (currently `unknown`) |
| `server/utils/mediaFilters.ts` | Add Tier 2 filter branches with enrichment join |
| `server/services/automationExecutor.ts` | Add enrichment join step after Tier 1 filters |

---

## Step 2.1 — `media_identity` schema and migration

Create `server/database/migrations/0004_media_identity.sql`:

```sql
CREATE TABLE media_identity (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceType    TEXT NOT NULL,
  sourceId      INTEGER NOT NULL,
  tmdbId        INTEGER,
  imdbId        TEXT,
  tvdbId        INTEGER,
  tvMazeId      INTEGER,
  plexRatingKey TEXT,
  jellyfinItemId TEXT,
  resolvedAt    INTEGER,
  UNIQUE(sourceType, sourceId)
);
CREATE INDEX idx_media_identity_tmdb ON media_identity(tmdbId);
CREATE INDEX idx_media_identity_tvdb ON media_identity(tvdbId);
CREATE INDEX idx_media_identity_imdb ON media_identity(imdbId);
```

Add the Drizzle table definition to `server/database/schema.ts`. Run `yarn vitest run` to
confirm the migration applies cleanly.

---

## Step 2.2 — `media_enrichment` schema and migration

Create `server/database/migrations/0005_media_enrichment.sql`. Columns come directly from
the "Proposed `media_enrichment` table" section in `INVENTORY.md`. Key columns:

```sql
CREATE TABLE media_enrichment (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  mediaIdentityId       INTEGER NOT NULL REFERENCES media_identity(id) ON DELETE CASCADE,
  -- Tautulli
  tautulliPlayCount     INTEGER,
  tautulliLastPlayed    INTEGER,   -- Unix ts
  -- Plex
  plexViewCount         INTEGER,
  plexLastViewedAt      INTEGER,   -- Unix ts
  plexContentRating     TEXT,
  -- Jellyfin
  jellyfinPlayed        INTEGER,   -- boolean
  jellyfinPlayCount     INTEGER,
  jellyfinLastPlayedDate TEXT,     -- ISO date
  jellyfinIsFavorite    INTEGER,   -- boolean
  -- Overseerr
  overseerrMediaStatus  INTEGER,   -- 1–6 enum
  overseerrRequestStatus INTEGER,  -- 1–3 enum
  overseerrHasIssue     INTEGER,   -- boolean
  -- OMDB
  omdbRated             TEXT,
  -- TMDB
  tmdbVoteAverage       REAL,
  tmdbPopularity        REAL,
  tmdbStatus            TEXT,
  tmdbOriginalLanguage  TEXT,
  tmdbInProduction      INTEGER,   -- boolean
  -- Streaming flags (TMDB watch/providers)
  onNetflix             INTEGER,   -- boolean
  onPrime               INTEGER,
  onDisney              INTEGER,
  onHulu                INTEGER,
  onApple               INTEGER,
  onHbo                 INTEGER,
  onParamount           INTEGER,
  onPeacock             INTEGER,
  -- TVMaze
  tvmazeStatus          TEXT,
  tvmazeType            TEXT,
  tvmazeWebChannel      TEXT,
  enrichedAt            INTEGER    -- Unix ts
);
CREATE UNIQUE INDEX idx_media_enrichment_identity ON media_enrichment(mediaIdentityId);
```

---

## Step 2.3 — Identity resolution job

`server/jobs/identityResolutionJob.ts` — runs after every Radarr/Sonarr sync.

**Algorithm (from `INVENTORY.md`):**

Phase A — Movies (Radarr):
1. Fetch all Radarr movies (already cached — reuse from media handler)
2. For each movie: upsert `media_identity(sourceType='RADARR', sourceId=movie.id, tmdbId=movie.tmdbId, imdbId=movie.imdbId)`
3. No external API calls needed

Phase B — Series (Sonarr):
1. Fetch all Sonarr series
2. Upsert `media_identity(sourceType='SONARR', sourceId=series.id, tvdbId=series.tvdbId, tmdbId=series.tmdbId, imdbId=series.imdbId, tvMazeId=series.tvMazeId)`
3. For any series where `tmdbId` is null: call `GET api.themoviedb.org/3/find/{tvdbId}?external_source=tvdb_id` — free, counts against TMDB quota
4. For any series where `tvMazeId` is null: call `GET api.tvmaze.com/lookup/shows?thetvdb={tvdbId}` — free, no key

Phase C — Plex bridge (when Plex is configured):
1. For each Plex library item: fetch including `guids` field
2. Parse `tmdb://X` → look up `media_identity` by `tmdbId` → set `plexRatingKey`
3. Parse `thetvdb://X` → look up `media_identity` by `tvdbId` → set `plexRatingKey`

Phase D — Jellyfin bridge (when Jellyfin is configured):
1. For each Jellyfin library item: fetch with `ProviderIds`
2. `ProviderIds.Tmdb` → look up by `tmdbId` → set `jellyfinItemId`
3. `ProviderIds.Tvdb` → look up by `tvdbId` → set `jellyfinItemId`

---

## Step 2.4 — Enrichment job

`server/jobs/enrichmentJob.ts` — runs on a configurable schedule (default: every 6 hours).
Iterates all rows in `media_identity` and fetches Tier 2 data for each, upserting into
`media_enrichment`.

**Rate limit awareness:**
- OMDB: 1,000 req/day free. Use `?i=<imdbId>` (exact), never `?t=<title>`. Cache — enrich
  once and only re-enrich if `enrichedAt` is older than 7 days for OMDB fields.
- TMDB: no daily cap, ~40 req/sec. Safe to run per-item.
- TVMaze: 2 req/sec sustained. Add a 500ms delay between series requests.
- Tautulli, Plex, Jellyfin, Overseerr: self-hosted, no rate limits.

**Priority ordering:** Radarr/Sonarr items with a saved query that references Tier 2 predicates
should be enriched first. Items not targeted by any automation can be enriched on a lower-
priority pass.

---

## Steps 2.5–2.8 — Filter branches, executor join, UI controls

Design decisions that must be resolved before implementation (document the decision in the
code when made):

**2.5 — Missing enrichment row handling:** When a `media_identity` row exists but no
`media_enrichment` row has been populated yet, Tier 2 predicates should return `false`
(conservative — don't include an item in a deletion automation if its enrichment state is
unknown). Document this in the filter branch.

**2.6 — Filter branch join:** `applyMovieFilters` / `applySeriesFilters` are currently pure
in-memory functions. Tier 2 predicates require a DB lookup. Two options:
- (a) Pre-join: load enrichment map before calling filter functions, pass as parameter
- (b) Async filter: make filter functions async, query per-item

Recommendation: option (a). Load `Map<number, EnrichmentRow>` keyed on `mediaIdentityId`
once per request, pass into filter functions. Avoids N+1 queries.

**2.7 — AutomationExecutor:** After applying Tier 1 in-memory filters, load enrichment rows
for the surviving items and apply Tier 2 filters. The executor currently receives only
`automationId` — no interface change needed, but it must now query the enrichment table.

**2.8 — UI:** Add Tier 2 predicate controls to the filter bar. Each predicate requires
knowing which providers are configured (e.g. show Plex controls only if a Plex provider is
active). The `configuredTypes` set is already available in `MediaContent` props.

---

## Acceptance criteria

- `media_identity` is populated on startup for all Radarr and Sonarr items
- `media_enrichment` is populated by the enrichment job and stays fresh
- Tier 2 predicates (`tautulliPlayCount`, `jellyfinWatched`, `overseerrRequestStatus`, etc.) correctly filter the media list
- Items with missing enrichment rows are treated as not matching Tier 2 predicates (conservative)
- All existing Tier 1 tests continue to pass
- OMDB enrichment uses `?i=<imdbId>` not title search
- Enrichment job respects TVMaze rate limit (500ms between series requests)
