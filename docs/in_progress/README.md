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
- **Provider** conflates three roles — `MediaSource`, `MetadataEnricher`, `MediaActuator`. Tasks belong
  to the actuator role only, yet the client advertises ~30 across all systems while the executor runs 3,
  and `taskId` is unvalidated. Heal: declare roles; make the **server** the source of truth for the task
  manifest; the **client derives** instead of holding its own 281-line catalogue.

## Phases

| Phase | Spec | Observable value | Depends on | Kind |
|---|---|---|---|---|
| **1 ✅ shipped** | `docs/architecture/media-query-engine.md` | A `MediaQuery` evaluates to its matched `MediaItemSet` through one engine; `/preview` returns a **real count** (not `0`); the executor and browse handler both resolve via that engine. | — | TDD (backend) |
| **2** | `phase-2-actuator-role-and-task-manifest.md` | A server **task manifest** declares each system's actuator tasks; creating an automation with an **unrunnable `taskId` is rejected**; `GET` exposes the manifest. | P1 (executor already routes through the engine; task dispatch is the remaining executor concern) | TDD (backend) |
| **3** | `phase-3-client-task-source-of-truth.md` | The client builds automations from the **server manifest**; the hardcoded client task catalogue is gone; the builder cannot offer a task the server can't run. | P2 (manifest endpoint) | TDD (client hooks) + impeccable (builder visual) |
| **4** | `phase-4-client-query-alignment.md` | The filter view and saved-query preview reflect the engine's `MediaQuery`/`MediaItemSet` shape; preview count shown in the UI matches what an automation will act on. | P1 (engine + real preview) | TDD (client hooks) + impeccable (filter view visual) |

```
P1 engine ─┬─► P4 client query alignment
           │
P2 manifest┴─► P3 client task source-of-truth
```

P1 and P2 are server-only and restore cohesion (divergence gone at the end of P2). P3 and P4 make the
client honest and may proceed in parallel once their server dependency lands.

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
- **P3 / P4** — client inversion. They depend on the server truth existing (P2 / P1 respectively). Each
  carries a visual pass via `impeccable` per `CLAUDE.md` (Ladle story first), separated from its
  TDD-tested hook logic.

## Relationship to the model docs

- `docs/architecture/media-query-engine.md` — the implemented `MediaQuery` / `MediaQueryEngine` /
  `MediaItemSet` owner (Phase 1, shipped).
- `docs/intent/system-roles-and-capabilities.md` — the three-role model Phases 2–3 realise.
- `docs/architecture/task-execution-and-actuator-gap.md` — the as-built actuator divergence Phase 2 closes.
- When a phase ships, move its durable pattern to `docs/architecture/` and delete its spec here.

## Not in this program

- The `media_item` / `media_identity` migration (`docs/intent/provider-source-model.md`) — it lands
  **into** `MediaItemSet` after this heal gives it a stable seam; explicitly sequenced behind P1.
- Media servers as sources, manual match-correction — deferred per the source model.
</content>
