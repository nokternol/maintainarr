# System-Roles & MediaQueryEngine Heal — phased TDD plan

**Status:** IN PROGRESS — active implementation plan. Heals two standing fractures end-to-end (server +
client) before further feature work resumes: the **provider/role** fracture (a configured system is one
amalgamated "provider" assumed equally capable) and the **collection-resolution** fracture (one truth —
"what does this query match" — owned by three sites that disagree). The model these phases realise is in
`docs/intent/system-roles-and-capabilities.md` and `docs/intent/media-query-engine.md`.

This plan **outranks** the Realtime & Event-Driven Cache plan, which was reverted from in-flight to
`docs/intent/enrichment_filters/` (P1–P2 shipped; P3–P6 paused). Those phases ride on the executor and
the automation create/run path that Phases 1–2 here rewrite; resuming them first would mean reworking
them. They come back once this heal lands.

## The two fractures, one program

- **Collection** is a missing *verb*, not an entity. "Which items match these filter values" lives in
  three places — the executor (complete, but private), `GET /saved-queries/:id/preview` (`{count:0}`
  stub), and the browse handler (duplicated loop, no combination). Heal: one owner, `MediaQueryEngine`,
  the others call it.
- **Provider** conflates three roles — `MediaSource`, `MediaEnricher`, `MediaActuator`. Tasks belong
  to the actuator role only, yet the client advertises ~30 across all systems while the executor runs 3,
  and `taskId` is unvalidated. Heal: declare roles; make the **`MediaActuator` role own its tasks**
  (retiring the type-keyed manifest table P2 shipped) with per-instance discovery and enablement; **then**
  the client derives instead of holding its own 281-line catalogue.

## Phases

| Phase | Spec | Observable value | Depends on | Kind |
|---|---|---|---|---|
| **1 ✅ shipped** | `docs/architecture/media-query-engine.md` | A `MediaQuery` evaluates to its matched `MediaItemSet` through one engine; `/preview` returns a **real count** (not `0`); the executor and browse handler both resolve via that engine. | — | TDD (backend) |
| **2 ✅ shipped → superseded by 3** | `docs/architecture/actuator-task-ownership.md` | Phase 2 moved actuator tasks server-side as a type-keyed manifest; **Phase 3 (Stage 1) retired that table** and gave the role ownership of its tasks. The as-built record is the role-owned doc. | P1 (executor already routes through the engine; task dispatch is the remaining executor concern) | TDD (backend) |
| **2.5** | `phase-2.5-media-enricher-role.md` | The **MediaEnricher** role is real and cohesive: genuine enrichers (Plex/Tautulli/Overseerr/TMDB) `implements` it and decorate the canonical `MediaItem`; owners do not; precedence is an explicit per-field policy; `EnrichmentContribution` retires. **Closes the server role model.** | P2 (roles named) | TDD (backend) |
| **3** | `phase-3-actuator-task-ownership.md` | The `MediaActuator` role **owns** its tasks (the type-keyed manifest table is retired); tasks are discovered per configured instance and enabled per instance (default off, enforced at create + execution); **then** the client derives and its hardcoded catalogue is gone. | P2 (executor/create paths) — Phase 3 **itself** closes the **actuator** role server-side before its client stage | TDD (server, then client hooks) + impeccable (builder visual) |
| **4** | `phase-4-client-query-alignment.md` | The filter view and saved-query preview reflect the engine's `MediaQuery`/`MediaItemSet` shape; preview count shown in the UI matches what an automation will act on. | P1 (engine + real preview) | TDD (client hooks) + impeccable (filter view visual) |

```
P1 engine ──────────────────► P4 client query alignment

P2 manifest ─┐
             ├─► P3a actuator role owns tasks (server) ─► P3b client derives
P2.5 enricher┘   (P3a replaces the type-keyed table P2 shipped)
```

P1, P2, and P2.5 are server-only. **The role model is not whole at the end of P2.5** — P2.5 closed only the
*enricher* role; the *actuator* role was left as P2's type-keyed manifest table, detached from
`MediaActuator`. Phase 3 closes that gap **server-first** (3a) and only then inverts the client (3b) onto
the corrected, instance-keyed source. P4 (client query alignment) may proceed once P1 lands.

## Implementing a phase (agent invocation)

Each phase ships with a thin `phase-N-prompt.md` (the phase-specific seams and traps) beside its
`phase-N-<name>.md` cycle doc. Shared context that applies to every phase lives once in `AGENT_BRIEF.md`.
A fresh agent is invoked with just:

```
tdd docs/in_progress/phase-N-prompt.md docs/in_progress/phase-N-<name>.md
```

The prompt doc points the agent at `AGENT_BRIEF.md` and the relevant model/intent docs, so the two-file
invocation is sufficient.

## Sequencing rationale

- **P1 first** — smallest and safest (its first moves are behaviour-preserving extractions guarded by
  existing executor tests), it deletes the `{count:0}` lie, and it creates the single seam every later
  phase and the reverted event-bus plan land into.
- **P2 next** — with resolution out of the executor, task dispatch is the executor's remaining concern;
  the manifest + `taskId` validation close the actuator over-promise.
- **P2.5** — P2 named the roles but shipped the enricher role mis-grounded (the inverse of its own
  definition). P2.5 makes the `MediaEnricher` role real. It closes the *enricher* role only — **not** the
  actuator role, which P2 left as a type-keyed manifest table detached from `MediaActuator`.
- **P3 server-first, then client** — Phase 3 must *replace* (not combine with) that actuator table: the
  `MediaActuator` role owns its tasks, discovery is per-instance, enablement is enforced server-side (3a).
  Only then can the client honestly derive (3b) — a client cannot derive a correct catalogue from an
  incorrect source. The detailed reasoning and the precedent it mirrors (`MediaEnricher.enrich()` retiring
  `EnrichmentContribution`) are in `docs/architecture/actuator-task-ownership.md` (Stage 1 as-built).
- **P4** — client query alignment, depends on P1. Carries a visual pass via `impeccable` per `CLAUDE.md`
  (Ladle story first), separated from its TDD-tested hook logic, as does P3b.

## Relationship to the model docs

- `docs/architecture/media-query-engine.md` — the implemented `MediaQuery` / `MediaQueryEngine` /
  `MediaItemSet` owner (Phase 1, shipped).
- `docs/intent/system-roles-and-capabilities.md` — the three-role model Phases 2–3 realise.
- `docs/architecture/actuator-task-ownership.md` — the as-built **MediaActuator** role-owned task model
  (Phase 3, Stage 1): the role owns its tasks, instance-keyed discovery, per-instance enablement. It
  retired the type-keyed manifest Phase 2 shipped. `docs/intent/actuator-task-parameters.md` — the deferred
  per-task parameter-injection requirement.
- When a phase ships, move its durable pattern to `docs/architecture/` and delete its spec here.

## Not in this program

- The `media_item` / `media_identity` migration (`docs/intent/provider-source-model.md`) — it lands
  **into** `MediaItemSet` after this heal gives it a stable seam; explicitly sequenced behind P1.
- Media servers as sources, manual match-correction — deferred per the source model.
</content>
