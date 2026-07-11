---
title: "Phase 8: Docs lifecycle"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-07-browse-dedup-and-filter-qualification.md]
---

## Question

Close out the docs lifecycle for this design once every prior ticket is built and shipped, per
[the design](./multi-instance-identity-model.md)'s own final "Docs lifecycle" bullet (Implementation
order, step 8):

- Delete `docs/in_progress/multi-instance-identity-model.md`.
- Trim `docs/intent/provider-media-identity-model.md` down to its still-open remainder — the three items
  recorded in [this map](./multi-instance-identity-model.map.md)'s **Out of scope** section (open
  `MediaItem` field shape, derived rule gating, provider-depends-on-provider fracture).
- Write fresh `docs/architecture/` prose for the entity model, multi-instance, and grouping decisions
  this map's tickets built (the design doc's sections are now *built*, not intent).
- Update `docs/architecture/media-query-engine.md` ("Current invariant" section and the preview row),
  `provider-roles-and-identity.md` (limitation 1, identity-model section), `media-enricher-role.md`
  (hydration/key paragraphs), `VOCABULARY.md` (`MediaSource` contract, `media_item`).
- `grep -rl` every doc for `OWNER_TYPE`, `enrichmentSourceType`, `sourceType`, `forContentType` and fix
  or triage each hit, per the repo's docs convention (CLAUDE.md).
- Run `graphify update .` and `link_doc_to_code.py --apply` for every new/edited `docs/architecture/`
  doc.
- Close this map ([multi-instance-identity-model.map.md](./multi-instance-identity-model.map.md)) once
  this ticket lands — the way to the destination is clear, no tickets remain.
