# Queries — Design Debt

Items found during implementation that require attention in future phases.
Add new entries as they are discovered; resolve them by striking through and noting the commit.

---

## Identity graph

### DEBT-001 — `ids` resolution assumes TMDB as the canonical imdbId source

**Phase found:** 0b (Step 7–8, `aggregateRatings`)  
**Priority:** Medium — correct behaviour today, wrong assumption long-term

`ids.imdbId` is resolved as `tmdbImdbId ?? omdbImdbId`, and the mismatch warn fires only when both are present with disagreeing values. This works correctly when neither provider is configured (result is `undefined`) and when only one is present (no contest). However, the *tie-breaking policy* (TMDB wins) is undocumented and will be surprising if TMDB is disabled and OMDB is the sole source.

**Constraint:** All metadata providers (TMDB, OMDB, TVMaze) are optional. The only hard requirement is Plex **or** Jellyfin. The identity graph must degrade gracefully to whatever IDs the configured providers supply — it must never fail or produce misleading output because a specific optional provider is absent.

**What to do in Phase 2:** When designing `mediaEnrichment` and the full identity graph, document the resolution priority as an explicit policy (e.g. TMDB > OMDB > TVMaze for imdbId), make it configurable or at least clearly visible in code, and ensure that a graph built from only TVMaze + Jellyfin (no TMDB, no OMDB) is still useful and not treated as degraded.

---

### DEBT-002 — `TvMazeRating` discards `tvMazeId`/`tvdbId` on the no-rating path

**Phase found:** 0b (Step 4, `tvmazeProvider.getRatings`)  
**Priority:** Low — edge case only affects shows that TVMaze knows about but has no community rating

When `bestMatch.rating.average` is null, `getRatings()` returns `{ source: 'tvmaze', found: false }` without `tvMazeId` or `tvdbId`. The show was found and matched — the IDs are available — but they are discarded alongside the missing rating.

This means the identity graph will have a gap for any show that TVMaze has indexed but hasn't yet accumulated ratings for (e.g. recently premiered or niche shows).

**What to do:** Return the IDs even on the `found: false` path. The `found` flag should indicate "rating data is available", not "the show exists". This is a one-line change in `getRatings()` but is held here because it requires a RED cycle and the Phase 0b test suite is already committed.

---

### DEBT-004 — `saved_query` has no `mediaType` discriminator; filter/provider mismatch is silent

**Phase found:** 2 Session A (design review)
**Priority:** High — silent wrong results, not a crash

`automation.providerId` serves as both a **type discriminator** (RADARR → movie branch, SONARR →
series branch) and an **instance selector** (which API endpoint to call). The executor branches on
`provider.type` to decide which media list to fetch and which filter function to apply.

But `saved_query.filters` carries no `mediaType` annotation. A query built with
`seriesStatus: 'Ended'` predicates can be attached to a Radarr automation without error. The
executor silently takes the movie branch, `applyMovieFilters` ignores the series-specific keys, and
the automation runs to completion with results that don't reflect the intended filter. No error is
raised.

**Extent:** Every `saved_query` is typeless. The only thing that determines whether a query runs as
movies or series is which automation it is attached to and which provider that automation points at.
The query UI presumably prevents attaching a series query to a Radarr automation today (by filtering
available queries by provider type), but that enforcement is entirely client-side and invisible in
the data layer.

**Phase 3 implication:** The combination model (INTERSECT, UNION, DIFFERENCE) allows composing
queries that may span Radarr and Sonarr. A single `automation.providerId` cannot represent
cross-type execution. The QUERIES.md phase flag ("automation.queryId FK — migration must backfill
before column drop") anticipates restructuring this relationship. Before Phase 3, `saved_query`
needs a `mediaType: 'movie' | 'series'` column so queries are self-describing, and the automation
execution model needs to reflect multi-source combinations.

**Phase 2 impact:** None. All Phase 2 Tier 2 predicates (Tautulli, Plex, Overseerr, TMDB status)
apply against enrichment cache entries that are keyed to `media_identity` rows, which are already
partitioned by `sourceType: 'RADARR' | 'SONARR'`. The executor reads the enrichment map for the
items that survive Tier 1 filtering — so the single-provider execution model is correct for Phase 2.

**What to do before Phase 3:** Add `mediaType TEXT NOT NULL` to `saved_queries`. Migrate existing
rows by joining to their automations' `provider.type`. Add enforcement in `create()` /
`AutomationDraft` that `providerId.type` is compatible with the query's `mediaType`. Update the
combination model design to handle cross-type compositions explicitly.

---

### DEBT-003 — `ids` block has no source-provenance metadata

**Phase found:** 0b (Step 5–6, `aggregateRatings`)  
**Priority:** Low — cosmetic until Phase 2 UI shows disagreement state

Each ID in `ids` silently records only the resolved value, not which provider it came from. If TMDB and OMDB both supply `imdbId` and agree, the stored value is indistinguishable from a value that came from only one source. The mismatch `console.warn` fires at aggregation time but leaves no trace in the response.

**What to do in Phase 2:** When the `mediaEnrichment` table is designed, store per-provider ID contributions as separate columns (e.g. `tmdb_imdb_id`, `omdb_imdb_id`) so the resolved value can be reconstructed and audited. The `ids` block in the API response can remain the resolved view, but the raw sources should be persisted.
