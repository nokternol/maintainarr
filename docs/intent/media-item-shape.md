# MediaItem shape — identity core + open provider-contingent fields

**Status:** intent, needs design before implementation. The model below is settled; the *representation*
is the open question to resolve in a design pass before any TDD.

## The model

A `MediaItem` is **identity plus an open, sparse field set**:

- **Identity** is the fixed, canonical core: the external database identifiers (`_sourceIds` —
  `radarr`/`sonarr`/`plex`/`tmdb`/`imdb`/`tvdb`/`tvmaze`). This is what makes two contributions the same
  item; it is the one part always present.
- **Fields** are everything else. They are contributed by whichever systems are configured and have data
  to give. A field is **not** ranked by who supplied it: a value from a `MediaSource` (Radarr's
  `hasFile`) is no more "core" than a value from a `MediaEnricher` (TMDB's `tmdbStatus`). The system does
  not judge data quality or completeness — it facilitates acting on what you have.
- The field set is therefore **sparse and varies wildly** by configured providers. An obscure title with
  one provider may carry almost nothing; a popular one with every provider configured may be dense. Both
  are valid `MediaItem`s.
- **Provenance** — which provider contributed a field — is a *separate axis*, not a tier. It exists for
  precedence resolution and discovery, not to rank a field's importance.

`MediaSource` and `MediaEnricher` are roles about who can **address/act on** versus **decorate** an item —
not about which fields are the "real" item. Both contribute fields; the item is the union.

## Today's state (the fracture)

`server/providers/mediaSource.ts`: `MediaItem = NormalizedMovie | NormalizedShow`. Each
(`server/domain/movie.ts`, `show.ts`) is `_sourceIds` + ~20 hardcoded optional fields. This half-expresses
the model — identity is separated and fields are already all-optional/sparse — but:

- It is a **closed typed union.** Every enricher field (`tmdbStatus?`, `overseerrHasIssue?`, `imdbRating?`,
  `playCount?`) is baked into the canonical type, so adding an enricher field means editing the core item —
  the contradiction `MediaEnricher` ("decorate the canonical item") was meant to remove.
- It carries **no provenance.** Once `certification` is set you cannot tell whether Radarr, TMDB, or OMDB
  supplied it — yet precedence resolution and provider-gating both need that axis.

## The open question (resolve in design, do not pre-decide)

How to represent "identity + open provenance-tagged field set" without losing the static typing the rule
predicates rely on (`item.imdbRating`, `show.network`). Candidate shapes and their tension:

- **Extend the typed union** with an explicit provenance map alongside the flat fields — least churn,
  keeps predicate typing, but the field set stays closed.
- **Identity core + open field bag** (`Record<fieldKey, { value, provider }>`) — fully open and
  provenance-native, but predicates lose `item.field` typing and read through an accessor.
- A hybrid: typed accessors over an open backing store.

This is the call to make with `/plan-and-go:plan-with-docs` before TDD.

## Relationship to the rest

- **Phase 4** (`docs/in_progress/phase-4-client-query-alignment.md`) closes the *vocabulary* fracture
  (the client re-declares rules). It is independent of this *shape* fracture and reads fields by today's
  keys regardless.
- A `MediaRule.predicate` reads one field and already tolerates absence (`=== undefined → false`); its
  `sourceProviders` names who can supply that field — the provenance axis surfaced for gating.
- This lands with the `media_item` / `media_identity` migration
  (`docs/intent/provider-source-model.md`): that migration is where `MediaItemSet`'s element becomes a
  persisted `media_item` and identity gains a table. The shape decided here is that element's shape.
