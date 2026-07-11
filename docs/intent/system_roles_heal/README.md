# System-Roles & MediaQueryEngine Heal — remaining phases

**Status:** INTENT (future state, not built). Phases 1–4 of this program shipped and are recorded in
`docs/architecture/` (`media-query-engine.md`, `actuator-task-ownership.md`, and the fracture ledger's
"Filter/rule vocabulary" entry) — this doc now covers only the two phases that remain, Phase 5 and
Phase 6, both still unbuilt.

## Remaining fracture

`MediaItem` is a closed typed union (`NormalizedMovie | NormalizedShow`) rather than identity plus an
open, provenance-tagged field set — adding an enricher field means editing the canonical core instead of
attaching a new field with its own provenance. Phase 5 closes that shape fracture; Phase 6 is a follow-on
enhancement, not a fracture closure in its own right.

## Phases

| Phase | Spec | Observable value | Depends on | Kind |
|---|---|---|---|---|
| **5** | `phase-5-media-item-shape.md` | `MediaItem` is identity + an open, provenance-tagged field set (not a closed `NormalizedMovie \| NormalizedShow` union); adding an enricher field no longer edits the canonical core. **Needs a design pass before TDD.** | Phase 4's `sourceProviders` provenance axis (shipped) | design (`plan-with-docs`) → TDD (backend) |
| **6** | `phase-6-rule-provenance-axis.md` | A rule names the field it reads; `sourceProviders` is **derived** from that field's provenance instead of hand-maintained, so gating cannot drift from the predicate. **Future enhancement, not fracture closure.** | Phase 5 (field provenance exists to derive from) | TDD (backend) |

```
P5 MediaItem shape ─► P6 derive provenance
  (open field set)      (sourceProviders not hand-kept)
```

## Sequencing rationale

- **P5 — `MediaItem` shape** depends on the `sourceProviders` provenance axis Phase 4 already shipped.
  Closes the *shape* fracture (the item is a closed typed union with enricher fields baked into the
  core). Needs a design pass (`plan-with-docs`) before TDD and lands with the `media_item` migration.
- **P6 — rule provenance axis** depends on P5. A future enhancement, not fracture closure: once fields
  carry provenance, a rule's `sourceProviders` is derived from the field it reads instead of hand-kept.
  Hand-maintained is the accepted state until then; lowest priority, ships last.

## Implementing a phase (agent invocation)

Each phase ships with a thin `phase-N-prompt.md` (the phase-specific seams and traps) beside its
`phase-N-<name>.md` cycle doc. Shared context that applies to every phase lives once in `AGENT_BRIEF.md`.
A fresh agent is invoked with just:

```
tdd docs/in_progress/phase-N-prompt.md docs/in_progress/phase-N-<name>.md
```

The prompt doc points the agent at `AGENT_BRIEF.md` and the relevant model/intent docs, so the two-file
invocation is sufficient.

## Relationship to the model docs

- `docs/architecture/media-query-engine.md` — the implemented `MediaQuery` / `MediaQueryEngine` /
  `MediaItemSet` owner (Phase 1, shipped).
- `docs/architecture/actuator-task-ownership.md` — the as-built **MediaActuator** role-owned task model
  (Phase 3). `docs/intent/actuator-task-parameters.md` — the deferred per-task parameter-injection
  requirement.
- `docs/intent/system-roles-and-capabilities.md` — the three-role model Phases 2–3 realised; this doc's
  remaining phases build on top of that shipped model, not toward it.
- When a phase ships, move its durable pattern to `docs/architecture/` and delete its spec here.

## Not in this program

- The `media_item` / `media_identity` migration (`docs/intent/provider-source-model.md`) — it lands
  **into** `MediaItemSet`, and is where **Phase 5** (`docs/intent/media-item-shape.md`) lands.
- Media servers as sources, manual match-correction — deferred per the source model.
