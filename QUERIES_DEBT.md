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

### DEBT-003 — `ids` block has no source-provenance metadata

**Phase found:** 0b (Step 5–6, `aggregateRatings`)  
**Priority:** Low — cosmetic until Phase 2 UI shows disagreement state

Each ID in `ids` silently records only the resolved value, not which provider it came from. If TMDB and OMDB both supply `imdbId` and agree, the stored value is indistinguishable from a value that came from only one source. The mismatch `console.warn` fires at aggregation time but leaves no trace in the response.

**What to do in Phase 2:** When the `mediaEnrichment` table is designed, store per-provider ID contributions as separate columns (e.g. `tmdb_imdb_id`, `omdb_imdb_id`) so the resolved value can be reconstructed and audited. The `ids` block in the API response can remain the resolved view, but the raw sources should be persisted.
