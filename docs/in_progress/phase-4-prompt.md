# Phase 4 prompt — Client derives the rule vocabulary

Invocation: `tdd docs/in_progress/phase-4-prompt.md docs/in_progress/phase-4-client-query-alignment.md`

Read `AGENT_BRIEF.md` first, then the cycle doc, `docs/architecture/media-query-engine.md` (the
`MediaQuery`/`MediaItemSet` owner), and the precedent it mirrors: `docs/architecture/actuator-task-ownership.md`
(Phase 3 — role owns its tasks, descriptor projection, client derives). Depends on Phase 1 (engine + honest
`/preview`).

## The one thing not to get wrong

This is **Phase 3 applied to rules.** The client's `FILTER_FIELDS` is a second vocabulary for the server's
rule catalogue. Make the catalogue the single authority and have the client **derive** its controls from a
projected, provider-gated `MediaRuleDescriptor`. Do **not** write a `FilterState → MediaQuery source`
translation between two key sets — that translator is the fracture, the analogue of the type-keyed
`taskManifest` Phase 3 deleted. If a step makes you map one vocabulary onto another, stop and re-read.

## Server-first, in two stages

- **Stage 1 (server):** rename `FilterDefinition → MediaRule`, `apply → predicate` (`Predicate` type),
  `FILTER_REGISTRY → MEDIA_RULES`, `getFilterDef → getRule`; add `MediaRuleDescriptor` (rule minus
  predicate) and a provider-gated descriptors endpoint mirroring `GET /api/providers/tasks`. The rename is
  behaviour-preserving (guarded by existing engine tests); the projection + gated endpoint are genuine RED.
- **Stage 2 (client):** `useMediaRules` fetches the descriptors; `MediaFilterBar`/`QueryRow` render
  data-driven from them (collapsing the ~33 setters to one `onRuleChange`, gating by configured provider);
  delete `FILTER_FIELDS`; keep the preview-count hook and include/exclude role parity; `impeccable` visual
  pass last. Do **not** start Stage 2 until Stage 1's descriptor is the whole truth.

## Folds in

`docs/intent/filter-ui.md`'s two problems (provider-gating, `MediaFilterBar` prop accumulation) are solved
for free by deriving from descriptors — retire that doc into this phase.

## Out of scope

MediaItem shape (`docs/intent/media-item-shape.md`, Phase 5); draft-query live count; `/search/metadata`.

## Done when

Per the plan's "Done when": the rule catalogue is the single authority, descriptors are projected and
provider-gated, the client derives and holds no catalogue, `FILTER_FIELDS` and the mapping are gone, and
the UI shows the engine-backed preview count. Stop any dev/test/Ladle process you start.
