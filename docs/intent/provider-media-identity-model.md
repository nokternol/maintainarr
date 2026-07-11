# Media identity model: instance vs. type, and open field shape

**Status:** INTENT (future state, not built). The three-role model (`MediaSource`/`MediaEnricher`/
`MediaActuator`) is shipped and as-built — see `docs/architecture/provider-roles-and-identity.md`,
`docs/architecture/media-enricher-role.md`, `docs/architecture/actuator-task-ownership.md`,
`docs/architecture/media-query-engine.md`. This document covers how identity and the `MediaItem` shape
should evolve on top of that shipped model. It's a distinct theme from
`docs/intent/media-actuator-realisation.md` (making non-source actuators actually run) — that work
consumes whatever identity model exists, but the identity model's hard calls don't depend on it.

## The problem

The shipped model works because its first real users all run Radarr/Sonarr. That let two axes collapse
into one without anyone noticing: "source" quietly means "a `sourceType`," not "a configured instance,"
and a `MediaItem`'s field set is a hardcoded union instead of an open, provenance-tagged set. Neither
breaks for a single-instance-per-type setup. Both break the moment a user runs two instances of the same
provider type, or wants a field decided by more than one enricher without editing the canonical item.

## Why it needs solving

- **Multi-instance is already real, and today it silently corrupts data, not just "can't be
  represented."** A user runs two Radarr instances. Verified in code: `mediaIdentity` upserts on
  `(sourceType, sourceId)` (`IdentityResolutionJob.runForMovies`/`runForSeries`), and `sourceId` is the
  provider's own per-instance movie/series id — not globally unique across instances. Two Radarr
  instances will very plausibly produce colliding `(RADARR, 1)` keys, so one instance's identity row
  silently overwrites the other's on every resolution pass. Separately and just as concretely: today's
  `IdentityJobFactory` → `ProviderFactory.createMany` collapses *all* active providers of a type into a
  single `ProviderSet.radarr` slot — last one registered wins. With two active Radarr instances
  configured, **one of them is silently invisible to identity resolution entirely**: its movies never get
  a `media_identity` row, never get enriched, and never surface to anything that joins through identity.
  This is not a future risk; it is reproducible today by any user who configures a second instance.
- **The canonical `MediaItem` resists growth.** `NormalizedMovie | NormalizedShow` bakes every enricher
  field into the core type. Adding one more TMDB/OMDB/Overseerr field means editing the canonical item —
  exactly the coupling the `MediaEnricher` role was introduced to remove. Provenance (which provider
  supplied a field) isn't tracked at all, so precedence resolution and provider-gating have no axis to
  read.
- **Gating can silently drift.** A `MediaRule`'s `sourceProviders` is a hand-maintained list next to the
  predicate it gates. Change which field the predicate reads and forget to update the list, and gating
  lies — quietly, with no compiler or test to catch it.

## The shape of the fix

- **Source becomes an instance, not a type.** Identity keys on `(providerId, externalId)`, with kind
  (movie-owning vs show-owning) carried alongside rather than fused into the identity. A logical grouping
  key (tmdb/tvdb/imdb) is separate again, for display dedup only — never for task targeting. This also
  fixes the collapsing bug above: `ProviderSet` and the identity job need to carry *every* active instance
  of a type, not one slot per type.
- **Data keeps one record per concrete copy; presentation collapses to one row per title.** Two Radarr
  instances, or Plex editions, are additional per-source records under the same logical group — not a
  version table, not a fan-out at the task layer. Automations stay instance-bound (one provider, one
  query, one task); running the same query against two instances is two automations, not one with
  fan-out. This trade is deliberate: it keeps targeting explicit at the cost of some duplication.
- **`MediaItem` becomes identity plus an open, provenance-tagged field set**, rather than a closed union.
  No field is ranked by who supplied it — a `MediaSource` value and a `MediaEnricher` value are equally
  "real"; provenance exists for precedence and gating, not to grade data quality. The open question is
  *how* to represent this without losing the static field typing rule predicates rely on
  (`item.imdbRating`) — candidates range from a typed union plus a provenance map, to a fully open field
  bag behind typed accessors. This needs a design pass, not a default.
- **Rule gating becomes derived, not declared**, once field provenance exists: a rule names the field its
  predicate reads, and `sourceProviders` is projected from that field's known providers instead of
  hand-kept. This only becomes possible after the field-provenance work above lands — it has no meaning
  before it.

## Blockers / friction

- The field-shape decision (typed union + provenance map vs. open field bag vs. hybrid) is a design
  question, not an implementation one — resolving it wrong means rework across `enrichmentMerge`,
  `filterRegistry`, and every predicate that reads `item.<field>`.
- The identity/instance separation is a real migration: `(sourceType, sourceId)` drops off
  `media_identity`, a new `media_item` table carries `(providerId, externalId)` + a group FK, and
  `IdentityResolutionJob` has to upsert into the new shape without breaking existing enrichment joins.
  This is schema-level, not additive — it has to be sequenced deliberately, not slotted in beside
  unrelated work. The multi-instance collapsing bug above should be fixed as part of this migration, not
  patched separately, since the root cause (`ProviderSet` has one slot per type) is the same thing the
  migration is correcting.
- Grouping is currently designed as auto-resolve-only (find-or-create by primary id, never auto-merge two
  existing groups). A manual-correction layer for mis-resolved groups is explicitly out of scope until
  duplicate/failed groups actually accumulate enough to need one — building it early is speculative.
- Rule-provenance derivation depends entirely on the field-shape work landing first; it buys
  drift-resistance, not new capability, so it's the lowest-priority piece of this cluster.
- **Generalized "provider silently depends on another provider" fracture (new, unresolved).** Discovered
  while examining actuator translation (see `docs/intent/media-actuator-realisation.md`): Tautulli's data
  is entirely Plex-keyed (it has no identity space of its own), yet nothing in provider configuration
  declares, validates, or even represents "this provider requires that provider to be configured." This
  is the same *class* of fracture as the original MediaSource privileging discovery (a provider silently
  needing something it wasn't modeled as depending on) — it needs its own investigation, and may turn out
  to be a third axis this identity model has to account for, not just an actuator-side concern.
</content>
