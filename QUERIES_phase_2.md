# Phase 2 — Tier 2 Enrichment Pipeline

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 1 shipped
**Blocks:** Phase 3
**Status:** READY FOR IMPLEMENTATION

---

## What this phase is and why

Tier 1 predicates (Phase 1) filter on data that lives directly in Radarr/Sonarr responses.
Tier 2 predicates require joining data from a second provider — e.g. "is this Radarr movie
also watched in Plex?" or "does this Sonarr series have an open Overseerr request?".

That join requires:
1. A **media identity table** mapping each Radarr/Sonarr item to its cross-provider IDs
2. An **enrichment table** storing fetched Tier 2 data per identity row
3. **System jobs** that keep both tables fresh on a schedule
4. Filter branches that join the enrichment table at query evaluation time

**Read `INVENTORY.md` before starting.** The identity graph design, `media_identity` schema,
enrichment column list, and join chain analysis are there. Do not re-derive them.

---

## Architecture decisions made in this phase

### System vs user automations (`kind` column)
Identity resolution and enrichment are **system automations** — infrastructure that makes
user automations possible, not user-defined rules. Both flavours use the same `automations`
table, `AutomationScheduler`, `AutomationExecutor`, and `automation_runs`. Separated by a
`kind TEXT NOT NULL DEFAULT 'user'` column: `'system'` | `'user'`.

- System automations: non-editable, non-deletable via API, visible in a system panel (not
  the main dashboard). Scheduled with hardcoded defaults. Created by the startup health check.
- User automations: fully configurable. The main dashboard. The reason the app exists.

See `docs/architecture/system-vs-user-automations.md`.

### Startup health check
A named discrete step in the startup sequence — `server/health/systemHealthCheck.ts` —
that asserts system invariants and self-heals recoverable conditions before the scheduler
and route tree are mounted. Docker-first design: containers restart, the system recovers
without intervention.

Sequence: `initDatabase() → systemHealthCheck() → AutomationScheduler.seed() → listen()`

Critical failures (DB init failure, missing required config) boot a **failed-state UI** —
the Express app mounts a no-auth error page with the reason and remediation steps instead
of the normal route tree. The server always binds. What it serves depends on health state.

See `docs/architecture/system-health-check.md`.

### Enrichment staleness
Single `enrichedAt` timestamp per `media_enrichment` row. Global staleness window: **24 hours**.
The enrichment job re-fetches all providers for an item when `enrichedAt` is older than 24h.
Per-provider staleness tightening is deferred until data volatility patterns are understood.

### Missing enrichment row handling
When a `media_identity` row exists but no `media_enrichment` row has been populated yet,
Tier 2 predicates return `false` (conservative — do not include an item in a deletion
automation when its enrichment state is unknown).

### Filter pre-join strategy
`applyMovieFilters()` / `applySeriesFilters()` remain synchronous. Before calling them,
load a `Map<mediaIdentityId, EnrichmentRow>` from the DB once per request and pass it in
as a parameter. Avoids N+1 queries. The enrichment map is empty-safe — items with no row
are treated as non-matching for all Tier 2 predicates.

### Tier 2 predicates — phase 2 scope
Ship predicates for providers with the highest automation value. Defer the rest.

**Ship in phase 2:**
| Predicate | Source | Column |
|---|---|---|
| `tautulliPlayCount` | Tautulli | `tautulliPlayCount` |
| `tautulliLastPlayedDaysAgo` | Tautulli | `tautulliLastPlayed` (Unix ts) |
| `plexViewCount` | Plex | `plexViewCount` |
| `plexLastViewedDaysAgo` | Plex | `plexLastViewedAt` (Unix ts) |
| `overseerrHasIssue` | Overseerr | `overseerrHasIssue` |
| `overseerrRequestStatus` | Overseerr | `overseerrRequestStatus` |
| `tmdbStatus` | TMDB | `tmdbStatus` (`Ended`/`Canceled`/`In Production`) |

**Deferred (phase 3+):**
- Streaming flags (`onNetflix`, `onPrime`, etc.)
- Jellyfin watch data
- OMDB `rated`
- TVMaze `status`, `type`, `webChannel`

---

## Context window strategy — 4 sessions

**Session A — System foundation (kind column + health check):** Steps 2.0–2.0b
**Session B — Identity schema + job:** Steps 2.1–2.3
**Session C — Enrichment job + Tier 2 filter branches:** Steps 2.4–2.6
**Session D — Executor join + UI controls:** Steps 2.7–2.8

Each session ends with a commit and passing tests.
Test runner: `yarn vitest run --project server`

---

## Files involved

### New files
| File | Purpose |
|---|---|
| `server/health/systemHealthCheck.ts` | Named startup health check entry point |
| `server/health/ensureSystemJobs.ts` | Upserts system automations on startup |
| `server/health/failedStateMiddleware.ts` | No-auth error page for critical failures |
| `server/database/migrations/0004_kind_column.sql` | Add `kind` to automations + automation_runs |
| `server/database/migrations/0005_media_identity.sql` | `media_identity` table |
| `server/database/migrations/0006_media_enrichment.sql` | `media_enrichment` table |
| `server/jobs/identityResolutionJob.ts` | Populates `media_identity` from Radarr/Sonarr |
| `server/jobs/enrichmentJob.ts` | Populates `media_enrichment` from secondary providers |

### Modified files
| File | Action |
|---|---|
| `server/index.ts` | Call `systemHealthCheck()` before scheduler seed |
| `server/database/schema.ts` | Add `kind` to automations/runs; add `mediaIdentity`, `mediaEnrichment` |
| `server/modules/automations/automations.handler.ts` | Reject DELETE/PATCH on `kind = 'system'` |
| `server/utils/mediaFilters.ts` | Add enrichment map parameter + Tier 2 filter branches |
| `server/services/automationExecutor.ts` | Load enrichment map before filter evaluation |
| `server/providers/radarrProvider.ts` | Ensure `tmdbId`, `imdbId` exposed on `RadarrMovie` |
| `server/providers/sonarrProvider.ts` | Ensure `tvdbId`, `tmdbId`, `imdbId`, `tvMazeId` on `SonarrSeries` |
| `server/providers/plexProvider.ts` | Add `guids` array to `PlexMediaItem` |
| `server/providers/overseerrProvider.ts` | Type `mediaInfo` properly (currently `unknown`) |

---

## Step 2.0 — `kind` column migration

Add to `automations` and `automation_runs`:

```sql
-- 0004_kind_column.sql
ALTER TABLE automations ADD COLUMN kind TEXT NOT NULL DEFAULT 'user';
ALTER TABLE automation_runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'user';
```

Update Drizzle schema definitions accordingly.

API enforcement (in `automations.handler.ts`):
- `DELETE /api/automations/:id` — 403 if `kind = 'system'`
- `PATCH /api/automations/:id/status` — 403 if `kind = 'system'`
- `GET /api/automations` — accept optional `?kind=user|system` filter

---

## Step 2.0b — Health check infrastructure

`server/health/systemHealthCheck.ts`:
```ts
export async function systemHealthCheck(db: DrizzleDb): Promise<void> {
  await ensureSystemJobs(db);
  // future checks added here
}
```

`server/health/ensureSystemJobs.ts` — upserts system automations by name. If a system job
row is absent, insert with default schedule. If present, leave untouched (user may have
adjusted schedule via settings in future).

System jobs to seed:
| Name | Schedule | Task |
|---|---|---|
| `system:identity-resolution` | `0 * * * *` (hourly) | identity resolution |
| `system:enrichment` | `0 */6 * * *` (every 6h) | enrichment |

Note: enrichment runs every 6h but staleness window is 24h — most items are skipped on
most runs. The frequent schedule ensures new items are enriched promptly.

`server/health/failedStateMiddleware.ts` — Express middleware mounted when
`systemHealthCheck()` throws a critical (unrecoverable) error. Intercepts all routes.
Returns a server-rendered HTML page with the error reason and remediation steps. No auth,
no session required.

---

## Step 2.1 — `media_identity` schema and migration

```sql
-- 0005_media_identity.sql
CREATE TABLE media_identity (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceType      TEXT NOT NULL,   -- 'RADARR' | 'SONARR'
  sourceId        INTEGER NOT NULL,
  tmdbId          INTEGER,
  imdbId          TEXT,
  tvdbId          INTEGER,
  tvMazeId        INTEGER,
  plexRatingKey   TEXT,
  jellyfinItemId  TEXT,
  resolvedAt      INTEGER,
  UNIQUE(sourceType, sourceId)
);
CREATE INDEX idx_media_identity_tmdb ON media_identity(tmdbId);
CREATE INDEX idx_media_identity_tvdb ON media_identity(tvdbId);
CREATE INDEX idx_media_identity_imdb ON media_identity(imdbId);
```

Add Drizzle table definition to `server/database/schema.ts`.

---

## Step 2.2 — `media_enrichment` schema and migration

```sql
-- 0006_media_enrichment.sql
CREATE TABLE media_enrichment (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  mediaIdentityId       INTEGER NOT NULL REFERENCES media_identity(id) ON DELETE CASCADE,
  -- Tautulli
  tautulliPlayCount     INTEGER,
  tautulliLastPlayed    INTEGER,
  -- Plex
  plexViewCount         INTEGER,
  plexLastViewedAt      INTEGER,
  -- Overseerr
  overseerrRequestStatus INTEGER,
  overseerrHasIssue     INTEGER,
  -- TMDB
  tmdbStatus            TEXT,
  enrichedAt            INTEGER
);
CREATE UNIQUE INDEX idx_media_enrichment_identity ON media_enrichment(mediaIdentityId);
```

Deferred columns (streaming flags, Jellyfin, OMDB, TVMaze) are added in later phases.
Do not add them now — schema should reflect what is actually enriched.

---

## Step 2.3 — Identity resolution job

`server/jobs/identityResolutionJob.ts` — runs on the `system:identity-resolution` schedule.

Algorithm (from `INVENTORY.md`):

**Phase A — Movies (Radarr):**
1. Fetch all Radarr movies
2. Upsert `media_identity(sourceType='RADARR', sourceId=movie.id, tmdbId, imdbId)`

**Phase B — Series (Sonarr):**
1. Fetch all Sonarr series
2. Upsert `media_identity(sourceType='SONARR', sourceId=series.id, tvdbId, tmdbId, imdbId, tvMazeId)`
3. For series where `tmdbId` is null: `GET api.themoviedb.org/3/find/{tvdbId}?external_source=tvdb_id`
4. For series where `tvMazeId` is null: `GET api.tvmaze.com/lookup/shows?thetvdb={tvdbId}`

**Phase C — Plex bridge (if Plex configured):**
1. Fetch Plex library items with `guids` field
2. Match `tmdb://X` or `thetvdb://X` → set `plexRatingKey` on matching `media_identity` row

**Phase D — Jellyfin bridge (if Jellyfin configured):**
1. Fetch Jellyfin items with `ProviderIds`
2. Match `ProviderIds.Tmdb` / `ProviderIds.Tvdb` → set `jellyfinItemId`

---

## Step 2.4 — Enrichment job

`server/jobs/enrichmentJob.ts` — runs on the `system:enrichment` schedule.

Staleness: skip rows where `enrichedAt > NOW() - 24h`. Re-enrich the rest in full.

Rate limit constraints:
- TVMaze: 500ms delay between series requests (2 req/sec limit)
- All others (Tautulli, Plex, Overseerr, TMDB): self-hosted or generous limits — no delay needed

Enriches only the predicates in phase 2 scope (Tautulli, Plex, Overseerr, TMDB status).
Deferred provider columns remain NULL until later phases add them.

---

## Steps 2.5–2.6 — Tier 2 filter branches

Modify `applyMovieFilters()` and `applySeriesFilters()` signatures to accept an
`enrichmentMap: Map<number, EnrichmentRow>` parameter.

Callers (media handler, automation executor) load this map once before calling filter
functions:
```ts
const enrichmentMap = await enrichmentService.getMapForIds(identityIds);
```

Filter branches for phase 2 predicates:

```ts
// Conservative default: missing row = false for all Tier 2 predicates
const enr = enrichmentMap.get(item.mediaIdentityId) ?? null;

if (filters.tautulliPlayCount !== undefined) {
  if (!enr || enr.tautulliPlayCount === null) return false;
  // apply comparison
}
// etc.
```

---

## Steps 2.7–2.8 — Executor join + UI controls

**Executor (2.7):** After Tier 1 in-memory filters, load enrichment map for surviving items
and apply Tier 2 filters. No interface change to `AutomationExecutor.execute()` — enrichment
loading is an internal step.

**UI (2.8):** Add Tier 2 predicate controls to `MediaFilterBar`. Each control is shown only
when the relevant provider is active (`configuredTypes` is already available in scope).
System automations appear in a read-only system panel (settings or dedicated system page),
not on the main dashboard.

---

## Acceptance criteria

- `kind` column exists on `automations` and `automation_runs`; API rejects mutation of system records
- `systemHealthCheck()` runs at startup; system jobs are upserted if absent
- Critical health failures boot the failed-state UI — server always binds
- `media_identity` is populated by the identity resolution job for all Radarr/Sonarr items
- `media_enrichment` is populated by the enrichment job; stale rows (>24h) are refreshed
- Tier 2 predicates (Tautulli, Plex, Overseerr, TMDB status) correctly filter the media list
- Items with missing enrichment rows are excluded from Tier 2 predicate matches (conservative)
- All existing Tier 1 tests continue to pass
- TVMaze calls in identity resolution respect the 500ms rate limit
