---
type: wayfinder-spec
label: wayfinder:spec
provider: tvmaze
status: draft
source_ticket: docs/in_progress/provider-e2e-spec/tickets/10-tvmaze-decision.md
source_research: docs/in_progress/provider-e2e-spec/research/tvmaze.md
---

# TVMaze — E2E spec

## Correction to research: TVMaze requires an API key

The research doc's "keyless, single fixed public URL, no config needed" conclusion reflects this
codebase's current stub (`ProviderFactory.createTvMaze()` hardcodes `apiKey: null`), **not reality**.
TVMaze genuinely requires an API key — the user had one configured previously; it was lost in a
database reset, and re-acquiring it is currently blocked by a broken social-login flow on TVMaze's
site. This flips several of the research doc's tentative conclusions:

- TVMaze gets a **real `metadata_provider` row** (`settings.apiKey`), not a hardcoded no-config
  construction.
- TVMaze gets a **`PROVIDER_REGISTRY` entry**, same full shape as other API-key providers
  (`apiSuffix`/`defaultUrl` fields), not a stripped-down keyless variant.
- `TvMazeProvider` is **folded into the standard `ProviderFactory` contract** — added to
  `AnyProvider`, `ProviderSet`, and `create()`'s switch, replacing the bespoke `createTvMaze()`
  method that currently sits outside it. Enrichment gets included via the same active-provider-row
  check (`findActiveByTypes`) every other enricher uses — not unconditionally always-on, since it is
  currently *unconfigured* (no key) and should correctly show as inactive until re-configured.
- **No placeholder/fake configuration is inserted as part of this spec or its implementation** — the
  row/registry entry exist so the provider works once a real key is available; the user configures
  it through the normal Settings UI when they have one again.
- **Process-hygiene fix, same session**: `providers.handler.ts`'s duplicate inline `TvMazeProvider`
  construction (bypassing `ProviderFactory.createTvMaze()`) is superseded by folding into the
  standard contract above — there's no longer a bespoke method to bypass.

## Headline field gap: `network`, merged with `webChannel`

`filterRegistry.ts`'s `network` rule already lists TVMaze in `sourceProviders` alongside Sonarr;
`NormalizedShow.network` already exists as a field; `TvMazeProvider.getShow()` genuinely returns
per-show network data. The only missing piece is the enricher. **Must read both `network` and
`webChannel`** — streaming-exclusive shows (Netflix/Hulu/etc. originals) populate `webChannel`
instead of `network`; a naive `network`-only read would silently show these titles as network-less.
TVMaze becomes a second producer of the existing `network` field (Sonarr already owns it);
precedence order flagged for the final ticket.

## New fields to wire — shared (TVMaze becomes an additional producer)

| Domain field | Source | Shared with |
|---|---|---|
| `network` | `network` merged with `webChannel` | Sonarr |
| `genres` | `genres` (typed, unused) | Sonarr, TMDB, Plex, Jellyfin |
| `status` | `status` (`Ended`/`Running`/`To Be Determined`), **mapped** onto the existing vocabulary (`ended`/`continuing`/`upcoming`) — same concept as `NormalizedShow.status`, just different words, unlike `type` below | Sonarr |
| `releaseDate` | `premiered` (currently used only for search-disambiguation, not persisted) | Plex's `originallyAvailableAt`, Jellyfin's `PremiereDate` |
| `runtime` | `averageRuntime` (not the more volatile per-episode `runtime`) | Radarr, Plex, Jellyfin — **first show-level producer**, closing the movies-only gap those three left open |

## New fields to wire — kept separate (not mapped/merged)

| Domain field | Source | Why not merged |
|---|---|---|
| `tvmazeType` | `type` (Scripted/Animation/Reality/Talk Show/...) | Genuinely different concept from `seriesType` (standard/daily/anime) — TVMaze's `type` is a content-format/genre-adjacent classification, `seriesType` describes release cadence. Not the same axis, so not mapped even lossily. |
| `tvmazeEndedAt` | `ended` (date string, finale air date) | Different shape from `NormalizedShow.ended` (boolean, Sonarr-sourced) — same underlying concept, incompatible types, kept separate rather than force-converted. |
| `weight` | `weight` (TVMaze's internal popularity score) | No existing analog anywhere — new filterable "popularity" concept. |
| `language` | `language` (single string, typed but unused) | Distinct shape from TMDB's `spokenLanguages` (array) — kept as its own field, not merged. |

## Identity crosswalk (not enrichment)

- `externals.tvrage` — same treatment as the already-wired `externals.thetvdb`/`externals.imdb`.
- `/lookup/shows?imdb=`/`?tvrage=` — wire these lookup modes alongside the already-wired `thetvdb=`,
  same class of gap as OMDB's previously-unused `i=` mode (now fixed in `specs/omdb.md`).

## Ratings — extracted to a dedicated intent doc

`rating.average` stays exactly as it is today: consumed only by `ratingsAggregation.ts`'s blended
average alongside TMDB/OMDB, **not** added to `filterRegistry`/`EnrichmentFields`. Full reasoning,
the per-provider ratings inventory (now consolidated across every provider's spec, not just
TVMaze's), and the proposed `MediaRatingsProvider` role live in
[`docs/intent/media-ratings-provider.md`](../../../intent/media-ratings-provider.md) — written as a
follow-up to this ticket, since TVMaze is the provider whose research surfaced the need for a
dedicated architectural pass, not because TVMaze is uniquely responsible for the gap.

**Implementation requirement, not optional**: `TvMazeProvider`'s rating read site must carry a JSDoc
comment pointing at that intent doc. `docs/in_progress/` gets deleted once this phase ships (per this
repo's docs convention) — a comment only in a spec file is not durable; the code itself must carry
the note so the intent survives the doc's deletion. Same requirement applies to TMDB's/OMDB's rating
read sites.

## Out of scope (structural, flagged not designed)

- **Episodes** (`/shows/:id/episodes`, `/episodebynumber`) — no episode-level table/EAV concept
  exists anywhere in this codebase for any provider.
- **Cast/crew** (`/shows/:id/cast`, `/crew`) — no person/credit concept exists in
  `NormalizedShow`/`NormalizedMovie`, same structural class as TMDB's deferred `credits`.
- **Akas/alternate titles** (`/shows/:id/akas`) — no alternate-title concept exists anywhere.
- **Schedule** (`{ time, days[] }`) — no broadcast-schedule concept exists.
- **Seasons endpoint** (`/shows/:id/seasons`) — season-level `network`/`webChannel` can differ from
  the show-level ones (a show can change networks between seasons); a second-order precedence
  question beyond the show-level `network` field, not designed here.
- **Images/artwork** (`/shows/:id/images`, `image.medium`/`image.original`) — no poster/image field
  exists on `NormalizedShow`/`NormalizedMovie` for any provider today.

## On-demand item-detail metadata (not enrichment)

Same principle as `specs/tmdb.md`/`specs/omdb.md`: `url`, `officialSite`, `dvdCountry`, `updated`,
`summary` (HTML synopsis), `image` — none of these would ever be filtered on. JSDoc-noted on
`tvmazeProvider.ts` as candidates for a future "full item detail" capability, not wired as
`EnrichmentFields`.

## Tasks / automation options

None. Confirmed empty-by-design in research: `TvMazeProvider` implements no `tasks()`, and none is
plausible — a read-only public metadata API with no request/download/library-management concept.

## Naming-collision notes (for the final precedence ticket)

- **`network`** — TVMaze and Sonarr both feed this field; string-casing/naming differences between
  the two sources (e.g. TVMaze's `network.name` vs. Sonarr's own network string) could silently
  overwrite depending on enrichment ordering. Precedence order not decided here.
- **`genres`** — TVMaze becomes a third producer alongside Sonarr/TMDB; precedence among all three
  not decided here (already an open question even before TVMaze).
- **`status`** — mapped onto the existing vocabulary rather than kept separate; the mapping itself
  (`Ended`→`ended`, `Running`→`continuing`, `To Be Determined`→`upcoming`) should be documented at
  the implementation site, not just asserted here.
- **`runtime`** — TVMaze's `averageRuntime` (shows) joins Radarr's `runtime` (movies) and
  Plex/Jellyfin's (both content types) — first genuine show-level producer, worth the precedence
  ticket confirming the shared field's semantics hold across content types cleanly.

## Filter type mapping

| Domain field | Filter key | dataType | Notes |
|---|---|---|---|
| `network` | `network` | `csv-strings` | Joins the existing show-only `network` rule in `filterRegistry.ts` — TVMaze already listed alongside Sonarr in `sourceProviders`; no new rule needed. |
| `genres` | `genres` | `csv-strings` | Joins the existing show-only `genres` rule — TVMaze becomes a third producer alongside Sonarr/TMDB; no new rule needed. |
| `status` | `seriesStatus` | `string` | Mapped onto the existing vocabulary (`Ended`→`ended`, `Running`→`continuing`, `To Be Determined`→`upcoming`) and joins the existing `seriesStatus` rule — TVMaze becomes an additional producer; no new rule needed. |
| `releaseDate` | `releaseDaysAgo` | `range` | **Reconciled**: joins the same `releaseDaysAgo` rule Plex/Jellyfin independently minted for their own `releaseDate` fields (see `specs/plex.md`/`specs/jellyfin.md`) — release date is a general concept, not content-type-specific, so this is a third producer rather than a separate show-only rule. `premiered` is a past date, fits the "days ago" convention. |
| `runtime` | `runtimeMinutes` | `range` | **Reconciled key name** — Radarr's/Plex's/Jellyfin's/OMDB's independently-made mappings converged on `runtimeMinutes`. **Flagged for the precedence ticket** (same flag as `specs/plex.md`): whether this should be the *same* rule as the movie-side `runtimeMinutes` (`contentTypes: ['movie','show']`, like `year`/`title`) now that TVMaze is the first show-level producer, rather than two separately-scoped rules — not resolved here. |
| `tvmazeType` | `tvmazeType` | `string` | Free-form provider classification (Scripted/Animation/Reality/Talk Show/...), no closed enum enforced client-side. Kept separate per spec — not the same axis as `seriesType`, so it needs its own rule rather than joining it. |
| `tvmazeEndedAt` | `tvmazeEndedDaysAgo` | `range` | Finale air date is a past date, so "days ago" fits the same convention as `releaseDate` above. Kept separate from the boolean `ended` rule per spec (incompatible shapes) — new rule. |
| `weight` | new — `weight` | `range` | Numeric popularity score, no existing analog to join — new rule. |
| `language` | new — `language` | `string` | Single string value, filtered by exact/equality match like `seriesType`/`seriesStatus`. Distinct shape from TMDB's array-valued `spokenLanguages`, so not a `csv-strings` join — new rule. |

Not mapped:
- `rating.average` — deferred to `docs/intent/media-ratings-provider.md`, correctly excluded here.
- `externals.tvrage`, `/lookup/shows?imdb=`/`?tvrage=` — identity crosswalk, never independently filtered on.
- `url`, `officialSite`, `dvdCountry`, `updated`, `summary`, `image` — on-demand item-detail metadata, never filtered on.

Tasks / automation options: N/A — no tasks, confirmed empty-by-design.
