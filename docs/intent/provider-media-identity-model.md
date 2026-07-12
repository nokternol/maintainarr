# Media identity model: open `MediaItem` field shape and derived rule gating

**Status:** INTENT (future state, not built). The three-role model (`MediaSource`/`MediaEnricher`/
`MediaActuator`), the group/instance identity split (`media_identity`/`media_item`), multi-instance
`MediaSource` support, and per-instance filter qualification are all shipped — see
`docs/architecture/provider-roles-and-identity.md`, `docs/architecture/media-enricher-role.md`,
`docs/architecture/actuator-task-ownership.md`, `docs/architecture/media-query-engine.md`. This document
covers the two pieces that build left open on top of that shipped model, plus a separate, unrelated
fracture noticed along the way. It's a distinct theme from `docs/intent/media-actuator-realisation.md`
(making non-source actuators actually run) — that work consumes whatever identity model exists, but
these open items don't depend on it.

## Open item 1: `MediaItem`'s field shape stays a closed union

`NormalizedMovie | NormalizedShow` bakes every enricher field into the core type. Adding one more
TMDB/OMDB/Overseerr field means editing the canonical item — exactly the coupling the `MediaEnricher`
role was introduced to remove. Provenance (which provider supplied a field) isn't tracked at all, so
precedence resolution and provider-gating have no axis to read.

The shape of the fix: `MediaItem` becomes identity plus an open, provenance-tagged field set, rather than
a closed union. No field would be ranked by who supplied it — a `MediaSource` value and a
`MediaEnricher` value are equally "real"; provenance would exist for precedence and gating, not to grade
data quality. The open question is *how* to represent this without losing the static field typing rule
predicates rely on (`item.imdbRating`) — candidates range from a typed union plus a provenance map, to a
fully open field bag behind typed accessors. This needs a design pass, not a default; resolving it wrong
means rework across `enrichmentMerge`, `filterRegistry`, and every predicate that reads `item.<field>`.

This same open question is also where the shipped identity model's one deliberate deferral lives: group
resolution (`resolveGroup`) is find-or-create only — it never auto-merges two existing `media_identity`
groups, so a fallback-chain miss (no primary id, title/year collision) can leave two groups that should
be one. A manual-correction layer for mis-resolved groups is out of scope until duplicate/failed groups
actually accumulate enough to need one; building it early is speculative, and the surrogate-id/match-key
separation the shipped model already has exists precisely so that layer can be added later without a
rewrite — but its design depends on how `MediaItem`'s field shape lands.

## Open item 2: rule gating stays declared, not derived

A `MediaRule`'s `sourceProviders` is a hand-maintained list next to the predicate it gates. Change which
field the predicate reads and forget to update the list, and gating lies — quietly, with no compiler or
test to catch it.

The shape of the fix: once field provenance exists (open item 1), a rule could name the field its
predicate reads, and `sourceProviders` would be projected from that field's known providers instead of
hand-kept. This only becomes possible after the field-provenance work lands — it has no meaning before
it, so it is strictly lower-priority than item 1: it buys drift-resistance, not new capability.

## Open item 3: generalized "provider silently depends on another provider" fracture

Discovered while examining actuator translation (see `docs/intent/media-actuator-realisation.md`):
Tautulli's data is entirely Plex-keyed (it has no identity space of its own), yet nothing in provider
configuration declares, validates, or even represents "this provider requires that provider to be
configured." This is the same *class* of fracture as the original MediaSource-privileging discovery (a
provider silently needing something it wasn't modeled as depending on) — it needs its own investigation,
unrelated to items 1–2 above, and may turn out to be a third axis the identity model has to account for,
not just an actuator-side concern.
