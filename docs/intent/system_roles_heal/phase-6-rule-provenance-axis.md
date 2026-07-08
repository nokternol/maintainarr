# Phase 6 — Rule provenance axis (future enhancement)

**Status:** future enhancement, **not fracture closure.** Depends on Phase 5 (`MediaItem` carries field
provenance). Hand-maintained `sourceProviders` is the accepted current state — this phase removes the
hand-maintenance, it does not heal a fracture. Lowest priority in the program; ships after P5.

## The current state (accepted, not broken)

A `MediaRule` declares `sourceProviders` — which providers can supply the field its predicate reads — as a
**hand-maintained list** alongside the predicate. The predicate reads a field directly (`item.imdbRating`);
the `sourceProviders` assertion is kept in sync by the author, with no machine check that it matches the
field actually read. This works and is the basis for compose-time provider-gating today. Its only weakness
is drift: change the field a predicate reads and forget to update `sourceProviders`, and gating silently
lies. That is a maintenance hazard, not a correctness fracture — gating is a compose-time affordance, and a
missing field fails its predicate regardless (see Phase 4's accepted edge case).

## The enhancement

Once `MediaItem` carries field provenance (Phase 5 — `docs/intent/media-item-shape.md`), a rule's
`sourceProviders` can be **derived from the field its predicate reads** rather than declared. The rule names
the field it depends on; provenance for that field is read from the item model; gating falls out
automatically and cannot drift from the predicate.

This requires the rule→field binding to become explicit (today it is implicit in the closure body — see
Phase 4). A rule would name its field(s); the predicate reads via that binding; `sourceProviders` becomes a
projection of the field's known providers, not a stored list.

## Why it is sequenced last

- It buys **drift-resistance**, not a new capability — gating already works.
- It is meaningless before Phase 5: there is no field provenance to derive from until `MediaItem` carries
  it.
- It touches every rule (each gains an explicit field binding), so it is cheapest once the rule model and
  the item model are both settled by Phases 4 and 5.

## Done when

A rule names the field it reads; `sourceProviders` is derived from that field's provenance, not
hand-maintained; changing the field a predicate reads cannot leave gating stale. Recorded in
`docs/architecture/` when shipped.
