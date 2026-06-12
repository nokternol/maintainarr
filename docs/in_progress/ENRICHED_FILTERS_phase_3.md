# Phase 3 — Run Now + System Panel

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 1 (so Run-now on a system automation actually does work; user Run-now is
independent)
**Blocks:** nothing
**Status:** NOT STARTED

---

## What this phase is and why

There is no way to run an automation on demand — execution only happens on the cron cadence. This
phase adds `POST /api/automations/:id/run` and the UI to invoke it, for **both** user and system
automations (decisions **D5–D7**).

`scheduler.trigger(id)` is the wrong tool: it only fires automations currently in the scheduler's
`jobs` map, so a **paused** automation can't be run. The endpoint calls `executor.execute(id)`
directly, which works regardless of status and already records a run. Because that bypasses croner's
`{ protect: true }`, the executor also gains an in-flight guard so a manual run can't overlap a
scheduled run of the same automation.

---

## Files involved

### Modified files — backend
| File | Action |
|---|---|
| `server/services/automationExecutor.ts` | In-flight guard: a `Set<number>` of running ids; `execute()` no-ops (or records a skipped run) if the id is already running; clears in `finally` |
| `server/modules/automations/automations.routes.ts` | `router.post('/:id/run', ...run)` |
| `server/modules/automations/automations.handler.ts` | Add `automationExecutor` to the cradle; `run` handler validates the id exists, kicks off `void executor.execute(id).catch(log)`, returns **202** |
| `server/modules/automations/automations.schemas.ts` | `run` schema (params `:id`) |

### Modified files — client
| File | Action |
|---|---|
| `src/hooks/useAutomations.ts` | Accept a `{ kind }` arg → `GET /api/automations?kind=system` (route already supports `kind`) |
| `src/components/AutomationRow/` | Run-now button → `POST /:id/run`; on 202, revalidate `useAutomationRuns` |
| `src/pages/system/index.tsx` | Replace the stub: render read-only system-automation rows (name, schedule, last/next run, `StatusDot`) with a Run-now button |

### Read first
| File | Why |
|---|---|
| `server/modules/automations/automations.handler.ts` | Existing handler/cradle + `defineRoute` pattern; `updateStatus` shows scheduler interaction |
| `server/cron/automationScheduler.ts` | Confirms `trigger` is schedule-bound (why we use the executor instead) |
| `src/hooks/useAutomations.ts`, `src/hooks/useAutomationRuns.ts` | SWR hooks + how rows revalidate |
| `src/components/AutomationRow`, `src/components/StatusDot` | Existing row/status UI to match |

---

## Steps (TDD)

### 3.1 — In-flight guard in the executor
RED: calling `execute(id)` while a prior `execute(id)` is in flight does not start a second run.
GREEN: `Set<number>` add/`finally`-delete around the run body.

### 3.2 — `POST /:id/run` returns 202 and starts a run
RED (API/integration): POST to a valid id returns **202** and a run is recorded for that automation;
POST to an unknown id returns 404. The response does not block on completion.
GREEN: handler kicks off `void executor.execute(id).catch(log)`; add `automationExecutor` to cradle.

### 3.3 — Run-now is kind-agnostic and works on paused
RED: POST against a `kind='system'` automation runs the system task (records a system run); POST
against a `status='paused'` automation still runs once.
GREEN: no kind/status gate in the handler.

### 3.4 — `useAutomations({ kind })`
RED (client): `useAutomations({ kind: 'system' })` requests `?kind=system`. GREEN: thread the param.

### 3.5 — System panel renders system rows + Run-now
RED (client): the system page lists the two seeded system automations read-only with a Run-now
control; clicking it POSTs `/:id/run`. GREEN: build the panel from `useAutomations({ kind:'system' })`.

### 3.6 — User dashboard Run-now
RED (client): `AutomationRow` shows a Run-now button that POSTs and revalidates run-history.
GREEN: wire the button.

---

## Verification gates (acceptance criteria)

- [ ] `POST /api/automations/:id/run` returns **202** immediately and records a run; unknown id → 404.
- [ ] A second `POST` while a run is in flight does not start an overlapping run (in-flight guard).
- [ ] Run-now works on a **paused** automation and on a **system** automation (records the appropriate run).
- [ ] The system page lists the two system automations read-only, each with a working Run-now button; the stub is gone.
- [ ] The user dashboard Run-now button triggers a run and the row's last-run status updates via `useAutomationRuns` polling.
- [ ] `yarn vitest run --project server` and `--project client` green.
- [ ] Manual smoke: Run-now on the system "enrichment" job, observe a success run in history and (post-Phase 1) populated enrichment; then confirm a Phase-2 Overseerr filter narrows the Media grid. Stop any dev/ladle process afterward.

---

## Risks

- **Fire-and-forget error handling.** The background `execute` must `.catch` so a rejection can't crash
  the process; `recordResult` already captures failures into `automation_runs`.
- **UI feedback latency.** 202 + polling means the button can't show an immediate result; show a
  transient "running…" state and rely on run-history revalidation.
- **Concurrency semantics choice.** Decide whether an overlap is a silent no-op or a recorded
  "skipped" run — pick one and assert it in 3.1.
