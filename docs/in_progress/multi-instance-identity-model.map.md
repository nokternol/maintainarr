---
title: "Multi-instance MediaSource — build map"
labels: [wayfinder:map]
status: open
---

## Destination

Ship the `media_identity`/`media_item` multi-instance model exactly as designed in
[Multi-instance MediaSource — the `media_identity`/`media_item` model, complete design](./multi-instance-identity-model.md).
Every design decision there is already resolved — nothing on this map is a decision ticket. Reaching the
end of this map means all 8 of the doc's own "Implementation order" phases are built, and the doc's final
phase (its own docs-lifecycle bullet) has executed: the spec deleted, the decided sections promoted to
`docs/architecture/`.

## Notes

- **Tracker:** no hosted issue tracker or local-markdown convention existed for this repo before this
  map; this map introduces one. Map and ticket files are flat markdown siblings of the spec in
  `docs/in_progress/`: `multi-instance-identity-model.map.md` (this file) and
  `multi-instance-identity-model.ticket-NN-<slug>.md`.
- **Claiming:** set `assignee:` in a ticket's frontmatter before starting work on it (the local-markdown
  stand-in for tracker-assignment claim).
- **Blocking:** this tracker has no native dependency graph, so it falls back to a body convention per
  the wayfinder skill — each ticket's frontmatter `blocked_by:` lists the ids (filenames) of tickets that
  must be `status: closed` first. The frontier is the set of open, unassigned tickets whose `blocked_by`
  list is all closed.
- **Execution-carrying map:** the design phase is done, so this map overrides wayfinder's decisions-only
  default (per the skill's "Plan, don't do" section) — every ticket here is a `wayfinder:task`, resolved
  by building and landing the code, not by deciding anything. Ticket bodies point into the spec's numbered
  sections rather than restating them; the spec is the source of truth for every implementation detail.
- **Skills to consult:** `tdd` for every schema/logic ticket; `docs-lifecycle` for the final ticket;
  Ladle-story-first for any client-visible piece (ticket 7).

## Decisions so far

<!-- index of closed tickets — what got built, since this map is execution-carrying -->

## Not yet specified

<!-- empty: the spec resolved every design question in scope of this destination -->

## Out of scope

- **`MediaItem` open field shape** (typed union + provenance map vs. a fully open field bag) — the spec
  deliberately keeps `MediaItem`'s current closed-union shape and defers this; it's the still-open
  remainder of `docs/intent/provider-media-identity-model.md`, a separate future effort.
- **Derived rule gating** (a `MediaRule`'s `sourceProviders` projected from field provenance instead of
  hand-kept) — depends on the field-shape decision above landing first; out of scope of this destination.
- **Generalized "provider silently depends on another provider" fracture** (e.g. Tautulli's data being
  entirely Plex-keyed with nothing declaring that dependency) — flagged in
  `docs/intent/provider-media-identity-model.md` as its own unresolved investigation, not part of this
  model's build.
