# Phase 3 prompt — Actuator task ownership, then client derivation

Invocation: `tdd docs/in_progress/phase-3-prompt.md docs/in_progress/phase-3-actuator-task-ownership.md`

Read `AGENT_BRIEF.md` first, then the plan doc and its target model
`docs/architecture/actuator-task-ownership.md` (Stage 1 as-built; plus `docs/intent/actuator-task-parameters.md` for the deferred
parameter work). The umbrella role model is `docs/intent/system-roles-and-capabilities.md`; the enricher
precedent it mirrors is `docs/architecture/media-enricher-role.md`.

## The one thing not to get wrong

This is a **replacement, not a merge.** The type-keyed `taskManifest` table is *retired* and the
`MediaActuator` role becomes the single authority — exactly as `MediaEnricher.enrich()` retired
`EnrichmentContribution`. Do not keep the table beside the role, do not add a second shape that does the
same job, do not have non-actuators contribute tasks. If a step makes you add a parallel structure, the
design is wrong — stop and re-read the intent doc.

## Server-first, in two stages

- **Stage 1 (server):** role owns its tasks; instance-keyed discovery; per-instance enablement enforced at
  create + execution; full vocabulary modelled (parameterless, disabled by default). The bulk of the work.
- **Stage 2 (client):** invert the client onto the instance-keyed API; delete the hardcoded client
  catalogue; `impeccable` visual pass last. Do **not** start Stage 2 until Stage 1's server truth is whole
  — the client cannot derive a correct catalogue from an incorrect source.

## Refactor-under-guard

Retiring the type-keyed table and re-expressing the three real Radarr/Sonarr tasks through the role is a
behaviour-preserving move guarded by the existing executor + automation-create tests staying green. The new
behaviour (instance-keyed discovery, enablement enforcement, modelled tasks) is genuine RED.

## Done when

Per the plan's "Done when": only configured `MediaActuator` instances declare tasks; discovery is
per-instance; enablement is per-instance, default off, enforced at create and run; the type-keyed table is
gone; the client holds no catalogue. Stop any dev/test watch process you start.
