# Phase 6 — impeccable visual pass: automation verbs & live state

**Status:** IN PROGRESS — **Phase 6** of the Realtime & Event-Driven Cache plan (see `README.md`).
**This is the frontend visual phase — run through the `impeccable` skill, NOT RED/GREEN TDD.** The
functional behaviour it dresses (SSE push, running state, SWR patching) was already built and tested in
Phases 4–5. Phase 6 owns *looks*, not *logic*.
**Depends on:** Phase 4 + Phase 5 (the live running state and the data flow must exist to design
against). Supersedes the "pause"/"read-only" framing in
`docs/architecture/system-vs-user-automations.md`.

## What this phase delivers (visual)

1. **Verb relabel** — honest verbs, honest icons.
2. **Live "running…" visual** — the transient state Phase 4 already drives via SSE + the duration
   ticker, given a real appearance (in-progress affordance, elapsed time, settle-to-result).
3. **System → Tasks column treatment** — the specialised columns a system task screen wants.

These are a single impeccable pass precisely so the running-state look is designed **once** against real
behaviour, rather than guessed at twice.

## The verbs

Play/Pause was the wrong metaphor: it implies **runtime control over an executing process**. Cross-system
jobs cannot honour that, so it is a well-intentioned lie. Three honest verbs, none claiming to touch an
in-flight run:

| Verb | Means | Icon language | Touches a running process? |
|---|---|---|---|
| **Run Now** | execute on demand | **refresh** (not play) | no — fires a new run |
| **Disable** | stop the schedule firing (future cron ticks only) | power / on-off (not pause) | no |
| **Archive** | retire (soft delete, restorable) | archive (not just trash) | no |

"Disable" is a *scheduling* state, not a *runtime* one. It maps to the existing
`status: 'active' | 'paused'` column — **relabelled in the UI only**, no migration in this pass (the
enum value `paused` stays; the user sees "Disabled"). Renaming the enum end-to-end is a later option.

> Archive as a *feature* (soft delete / restore, `archivedAt`, endpoints) is independent backend work
> tracked in `docs/intent/automation-archive.md`. Only the Archive *verb visual* belongs to this phase,
> and only if that feature has shipped; otherwise relabel Run Now + Disable now and fold Archive in
> when it lands.

## System Tasks vs User Automations — separate screens, shared row

Both are `kind`-tagged rows in the same `automations` table (see
`docs/architecture/system-vs-user-automations.md`), surfaced on **separate screens**:

- **Automations** — user automations. Full controls: Run Now + Disable + Archive.
- **System → Tasks** — system automations. **Run Now only** (Disable/Archive forbidden server-side for
  `kind='system'`).

`AutomationRow` is **shared** and derives control visibility from `automation.kind` (`isUserAutomation`
gates the schedule toggle and the destructive action; Run Now shows for both).

### Column specialisation is the known divergence

System rows have null `query`/`provider` and read sparse against the user-shaped subline
(`query · provider · task`). A fully-featured System → Tasks screen (cf. Radarr: interval, last run,
**run duration**, next run, refresh) wants different columns. Decision: **specialise the system row's
columns in this phase**, now that run-duration semantics exist (Phase 4's ticker / `run:completed`
timing). Do not unify columns prematurely.

## impeccable workflow (per CLAUDE.md, not TDD)

This phase follows the project UI convention rather than RED/GREEN cycles:

1. **Ladle story first.** Build/update the relevant `.stories.tsx` (e.g. `AutomationRow.stories.tsx`)
   covering each state: idle, running (ticker active), completed-success, completed-error, disabled,
   system vs user. `yarn ladle serve` + playwright-cli to iterate the verb icons, the running
   affordance, and the System column layout in isolation.
2. **Then in-place.** `yarn dev` + playwright-cli to verify the live running state end-to-end against
   real SSE (trigger Run Now, watch the row settle).

The `impeccable` skill drives the visual decisions (hierarchy, motion for the running state, icon
semantics, column treatment); it is invoked when this phase is picked up.

## Gates

- Ladle stories render every row state without error.
- `yarn typecheck:client`, `yarn lint`.
- Visual verification via playwright-cli in both Ladle and `yarn dev`, per CLAUDE.md.
- Functional regression (Phases 4–5 tests) stays green — this phase must not alter behaviour, only
  presentation.

## Done when

The three verbs read honestly with their icons, the live "running…" state has a designed appearance
driven by the existing SSE/ticker, and System → Tasks shows its specialised columns — verified in Ladle
and in-app, with no change to the Phase 4–5 behaviour or its tests.
