---
type: wayfinder-spec
label: wayfinder:spec
provider: tmdb
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/07-tmdb-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/tmdb.md
---

# TMDB — E2E spec

TMDB is a `MediaEnricher` today wired for exactly one field (`tmdbStatus`), despite `filterRegistry.ts`
already hand-listing it as a `sourceProviders` entry on three other rules (`genres`, `certification`,
`year`) that nothing populates — a stale-entry bug this spec resolves by wiring for real rather than
correcting the listing. Applies the same standing principles as every provider this map: per-item
fields only, and genuine redundancy across independently-configured sources is valuable (TMDB's own
direct API calls are treated as a *more* authoritative path than the same TMDB data reached indirectly
through Radarr's bundled ratings pull — see "same-source dedup" below, not a new-redundancy case).

## Prerequisite: system-wide region setting (structural — new table)

**No system-wide settings mechanism exists anywhere in this codebase today** — only per-provider
`metadataProviders.settings` JSON blobs. A single `region` setting (ISO 3166-1 alpha-2 country code)
is needed to drive two TMDB capabilities below (streaming-service flags, region-selected
certification) and is deliberately modeled as a **new system-wide settings table**, not folded into
TMDB's own provider settings — the region concept isn't TMDB-specific even though TMDB is its first
consumer. This is the one genuinely structural item in this spec; flagged as a blocker to raise, not
designed further here (table shape is an implementation decision, not a spec-ticket one).

## Fields already wired (unchanged baseline)

`tmdbStatus` (movie/tv release/airing status string).

## Same-source dedup (not new redundancy — TMDB direct call outranks the Radarr-bundled copy)

Radarr's `collection.{name,tmdbId}` (wired last session as `collectionName`/`collectionTmdbId`) is
the *same underlying TMDB data*, reached indirectly through Radarr's own API bundle rather than
TMDB's API directly. Unlike Plex/Jellyfin/TMDB's genuinely independent metadata (different configured
sources, real redundancy value), this is one source reached two ways — same treatment as
Tautulli-on-Plex. TMDB's own direct call becomes the additional/primary producer of the *same*
field, not a new field:

| Domain field | Source |
|---|---|
| `collectionName` / `collectionTmdbId` | `getMovieDetailsEnriched` — TMDB direct call outranks Radarr's bundled copy |

**Ratings extracted to a dedicated intent doc**: `getRatings()`'s `movieRating`/`tvRating`/vote counts
(the same same-source-dedup reasoning applies — TMDB's direct call outranks Radarr's bundled
`ratings.tmdb` copy) moved to
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md) as
`tmdbRating`/`tmdbRatingVotes`, alongside the full per-provider ratings inventory and the reasoning
for why ratings don't fit this spec's shared-EnrichmentFields pattern.

## New fields to wire — shared (TMDB becomes an additional producer, precedence flagged for the final ticket)

| Domain field | Source | Shared with |
|---|---|---|
| `genres` | `getMovieDetailsEnriched`/`getTvDetailsEnriched` | Radarr (movie), Sonarr (show), Plex, Jellyfin |
| `certification` | same calls, region-selected via the `region` setting (replaces today's hardcoded US-preferred fallback) | Radarr, Sonarr, OMDB, Plex, Jellyfin |
| `year` | same calls (needs a year-extraction step from `release_date`/`first_air_date`, not currently in `tmdbProvider.ts`) | Radarr, Sonarr, Plex |
| `originCountry` | same calls | OMDB's `Country` (see `specs/omdb.md`) |

## New fields to wire — no current collision

| Domain field | Source | Notes |
|---|---|---|
| `keywords` | same calls, `append_to_response: 'keywords'` (already fetched) | String array — "contains keyword X" filter. |
| `spokenLanguages` | same calls | String array — language filter. |
| `hasTrailer` | `movie/{id}/videos`, `tv/{id}/videos` | Boolean derived from presence of a trailer-type video — filterable. The actual video links/metadata are on-demand, not enrichment (see below). |
| Streaming-service flags (`netflix`/`prime`/`disney`/`hulu`/`apple`/`hbo`/`paramount`/`peacock`) | `getMovieWatchProviders`/`getTvWatchProviders`, region-scoped via the new `region` setting | Booleans per service, filterable ("available on Netflix"). |

## Identity crosswalk (not enrichment — parallels Sonarr's imdbId/tvMazeId treatment)

`external_ids` (`imdb_id`, `tvdb_id`, `wikidata_id`, `facebook_id`, `instagram_id`, `twitter_id`) is
an id-matching capability, not display/filter data. `tvdb_id` specifically cross-verifies Sonarr's own
id space. Wired as `_sourceIds` cross-checks, not `EnrichmentFields`.

## On-demand item-detail metadata (not enrichment)

**Refined principle from this session, applied retroactively to `specs/plex.md`/`specs/jellyfin.md`
too**: data nobody would filter on is on-demand item-detail metadata — fetched when a user views one
specific item, not pre-computed for every item in a batch `EnrichmentJob`. Capture as a JSDoc note on
the relevant `tmdbProvider.ts` methods flagging them as candidates for a future "full item detail"
provider method/role, not built this pass:

- `credits` (cast/crew) — also the first "people" data type in this codebase; no relational shape
  exists for it anywhere, same class as Jellyfin's deferred `People`.
- `reviews` — user-generated text, no display surface exists today.
- `translations` / `alternative_titles` — i18n, no current i18n concept in this app.
- `recommendations` / `similar` — per-item but produce a *list of other items*, a different
  query-engine shape than every existing filter field; TMDB treats these as two distinct,
  non-interchangeable algorithms, don't conflate if this is ever built as a real feature.
- `images` (backdrops/posters/logos) — display only, moved here after being briefly scoped as
  enrichment and immediately reclassified per the "never filtered on" test.

## Out of scope (not per-item)

- **Trending/popular/top-rated/discover endpoints** (`trending/movie/{time_window}`, `movie/popular`,
  `movie/top_rated`, `discover/movie`) — bulk discovery, not scoped to one item. `TmdbService` already
  uses `trending/movie/day` for its own homepage-backdrops feature (unrelated to this spec). A
  possible future "suggest new acquisitions" automation, not an enrichment field — flagged, not
  designed.

## Tasks / automation options

None. TMDB is read-only metadata; no `MediaActuator` role is plausible.

## Naming-collision notes (for the final precedence ticket)

- **`genres`/`certification`/`year`** — TMDB joins existing multi-producer rules; makes the current
  stale `filterRegistry.ts` listing accurate. Precedence order not decided here.
- **`hasTrailer`/streaming flags** vs any future non-TMDB streaming-availability or video source —
  no current collision, flagged for whoever builds a second source later.
- **`images`** vs `TmdbService`'s existing trending-backdrops feature and any future Plex/Jellyfin
  artwork concept — three different "image" ideas that could collide under a generic name if ever
  built without care. Currently none of the three is a real filterable field, lowering urgency.

## Filter type mapping

Tasks: N/A — no tasks (spec's own "Tasks / automation options" section: "None. TMDB is read-only
metadata; no `MediaActuator` role is plausible.").

`tmdbStatus` is already wired in `filterRegistry.ts` — not revisited here.

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `genres` | `genres` | `csv-strings` | Joins the existing shared `genres` rule (movie and show variants both already `csv-strings`) as an additional producer — TMDB was already hand-listed in `sourceProviders` with nothing populating it; this wiring makes that listing accurate, per the spec's own framing. No new key. |
| `certification` | `certification` | `csv-strings` | Joins the existing shared `certification` rule (`csv-strings`, already lists TMDB in `sourceProviders`). No new key. |
| `year` | `year` | `range` | Joins the existing shared `year` rule (`range` over the numeric year, already lists TMDB in `sourceProviders`). No new key — not a date; consistent with the "dates are `range`, never a raw picker" convention already covering this field. |
| `originCountry` | `originCountry` | `csv-strings` | New key. String array on the item (ISO country codes from TMDB `origin_country`); matches the existing `csv-strings` convention for multi-select-by-string-value filters (same shape as `genres`, `network`). Spec notes a future collision with OMDB's `Country` (`specs/omdb.md`) — not resolved here, precedence is a final-ticket concern. |
| `keywords` | `keywords` | `csv-strings` | New key. String array (TMDB keyword tags), same shape as `genres` — multi-select "contains keyword X" is exactly the `csv-strings` use case. |
| `spokenLanguages` | `spokenLanguages` | `csv-strings` | New key. String array (language codes/names) — same reasoning as `keywords`/`originCountry`. |
| `hasTrailer` | `hasTrailer` | `boolean` | New key. Derived boolean (presence of a trailer-type video), same shape as `hasFile`/`watched` — a single true/false predicate, not a range or string set. |
| Streaming-service flags (`netflix`, `prime`, `disney`, `hulu`, `apple`, `hbo`, `paramount`, `peacock`) | `streamingNetflix`, `streamingPrime`, `streamingDisney`, `streamingHulu`, `streamingApple`, `streamingHbo`, `streamingParamount`, `streamingPeacock` | `boolean` (×8) | New keys — 8 separate boolean rules, not 1 `csv-strings` "available on any of" rule. The domain data is 8 independent per-service booleans (spec: "Booleans per service, filterable"), not a string array on the item; collapsing them into one `csv-strings` rule would require synthesizing an `availableOn: string[]` field TMDB doesn't naturally produce, and would only support OR-style "available on any of X, Y" queries — it can't express "available on Netflix AND Disney," which independent boolean rules can (combine multiple rules). Matches the existing convention for independent boolean facts (`watched`, `monitored`, `ended`, `hasFile`) rather than inventing a new aggregate shape. |
| `external_ids` (`imdb_id`, `tvdb_id`, `wikidata_id`, `facebook_id`, `instagram_id`, `twitter_id`) | — none — | — | Identity crosswalk, not filter data — per the spec's own framing, these are id-matching/cross-verification keys (`_sourceIds`), never independently filtered on. No filter mapping. |
| `collectionName` / `collectionTmdbId` | — none (out of this table) — | — | Same-source dedup, not a new field — TMDB becomes an additional producer of the already-handled `collectionName`/`collectionTmdbId` fields from a prior session. Out of scope here per the task's instruction to skip "Same-source dedup" section fields. |
| `tmdbRating` / `tmdbRatingVotes` and other ratings | — none (out of this table) — | — | Extracted to `docs/intent/media-ratings-provider.md` in a prior session; out of scope here per the task's instruction to skip the "Ratings extracted" section. |
| `credits`, `reviews`, `translations`/`alternative_titles`, `recommendations`/`similar`, `images` | — none — | — | On-demand item-detail metadata per the spec's own "not enrichment" classification — never batch-enriched, never filtered on. No filter mapping. |
| Trending/popular/top-rated/discover endpoints | — none — | — | Bulk discovery, not per-item data — spec's own "Out of scope (not per-item)" section. No filter mapping. |
