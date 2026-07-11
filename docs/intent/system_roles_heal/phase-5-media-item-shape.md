# Phase 5 — MediaItem shape (identity + open provider-contingent fields)

**Status:** INTENT (relegated 2026-07-07) — **needs a design pass before TDD.** Realises
`docs/intent/media-item-shape.md`. Closes the *shape* fracture left by Phases 2–4: the canonical
`MediaItem` is a closed typed union with every enricher field baked into the core and no provenance axis.

## Why a separate phase from Phase 4

Phase 4 closes the **vocabulary** fracture — the client re-declaring the server's rule catalogue. This
closes the **shape** fracture — the item being a closed `NormalizedMovie | NormalizedShow` union rather
than identity + an open, provenance-tagged field set. Different fractures, different seams. Phase 4 reads
fields by today's keys regardless of shape, so it does not wait on this; this rides on Phase 4 only in that
the rule catalogue's `sourceProviders` is the provenance axis it formalises.

## The model (settled)

Per the intent doc: `MediaItem` = **identity** (`_sourceIds`, always present) + an **open, sparse field
set** that varies by configured providers, where no field is ranked by its supplier and **provenance is a
separate axis**. `MediaSource` and `MediaEnricher` both contribute fields; neither owns "the real item."
The system does not judge data quality — it acts on what is present.

## The open decision (design first)

The representation is unresolved — see the intent doc's "open question": extend the typed union with a
provenance map, move to an identity core + open field bag, or a typed-accessor hybrid. The tension is
keeping the rule predicates' static field typing while making the field set open and provenance-native.

**Resolve with `/plan-and-go:plan-with-docs` before writing cycles.** Do not begin RED until the
representation and the migration boundary (`docs/intent/provider-source-model.md`) are decided. This phase
file is the placeholder for that design's output.

## Seams (provisional — confirm in design)

| File | Role |
|---|---|
| `server/modules/media/mediaItem.ts`, `server/modules/media/movie.ts`, `show.ts` | `MediaItem` definition — the shape under decision. |
| `server/modules/media/enrichmentMerge.ts` (`mergeEnrichment`) | Where contributions combine — gains the provenance axis. |
| `server/modules/media/filterRegistry.ts` (`MEDIA_RULES`) | Predicates read fields — affected by how fields are accessed. |
| `docs/intent/provider-source-model.md` | The `media_item` / `media_identity` migration this lands with. |

## Done when

`MediaItem` is identity + an open provider-contingent field set with provenance as an explicit axis;
adding an enricher field no longer edits the canonical core; precedence and provider-gating read provenance
directly. Recorded in `docs/architecture/` when shipped.
