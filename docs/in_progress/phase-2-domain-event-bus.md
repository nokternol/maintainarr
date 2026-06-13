# Phase 2 — Domain Event Bus

**Status:** IN PROGRESS — **Phase 2** of the Realtime & Event-Driven Cache plan (see `README.md`).
TDD (backend). **Depends on:** Phase 1 (honest counts make the `data:changed` gate meaningful).

## Observable value

`AutomationExecutor.execute()` **emits domain events** that a subscriber can observe:
- `run:started` when the run body begins,
- `run:completed` **after** the run row is committed, carrying the persisted `runId`/`ranAt`,
- `data:changed` **iff** the task declares a media scope **and** `itemCount > 0`.

Emission is the boundary: each cycle asserts "this action emits this event with this payload" via a
test subscriber on the bus. No transport, no UI, no cache yet — those are Phases 3–5.

## What it is

A single in-process, typed `EventEmitter` singleton registered in the awilix container cradle
(`server/container.ts`). Producers publish; consumers subscribe. **Single process only** — no Redis /
cross-node fan-out (matches the self-hosted, single-operator deployment). If Warden ever scales
horizontally, this is the boundary to revisit.

## Event catalogue

Two deliberately orthogonal families — never conflated on one screen, later exposed as two SSE
channels (Phases 4 & 5).

### Run lifecycle ("task" family)

Fires for **every** run — user or system, including non-data tasks. Feeds run-status UI only.

| Event | Payload | Emitted |
|---|---|---|
| `run:started` | `{ automationId, kind, taskId, startedAt }` | when `execute()` begins the run body |
| `run:completed` | `{ automationId, kind, taskId, status, itemCount, error, finishedAt, runId, ranAt }` | **after** the run row is committed, with the persisted `runId`/`ranAt` |

`run:completed` is emitted **post-commit with the real persisted identifiers** so a client can apply it
authoritatively without diverging from a later refetch.

### Data change ("data" family)

| Event | Payload | Emitted |
|---|---|---|
| `data:changed` | `{ scope:'media', sourceType?:'RADARR'\|'SONARR' }` | after a successful run **iff** the task declares a data scope **and** `itemCount > 0` |

Generic `scope` so non-media domains can be added without a new event. `sourceType` absent ⇒ both
movies and series affected.

### The gate contract (decided)

Emit `data:changed` **iff** `task.affects === 'media'` **and** `itemCount > 0`. The count must never be
falsely zero (Phase 1 guarantees this for system jobs) but may over-count; the cache reads only
scope/sourceType and treats any emit as whole-scope eviction. See the README for the full contract.

## How a task declares it changed data — declarative + gated

The dispatch entries carry the scope alongside the handler. Today `RADARR_TASKS`/`SONARR_TASKS`
(`automationExecutor.ts:202-210`) map `taskId → fn`; grow the entry to `{ run, affects? }`:

- `unmonitorMovie` / `unmonitorSeries` → `affects: 'media'`.
- `triggerSearch` → declares **nothing**: it kicks off an async *arr search; `hasFile` flips
  out-of-band minutes later, so it does not synchronously change the displayed library.
- `system:enrichment`, `system:identity-resolution` → `affects: 'media'` (Phase 1 made their counts
  real, so the gate is meaningful).
- Future `backup` / `update-check` / `health` → declare nothing → silent.

The knowledge of "did this change data" lives with the task definition, not scattered across handlers.

### Per-producer `sourceType` (verified against the writers)

`sourceType` is **not** a single property of the task — it depends on what the producer touches:

- **User tasks carry a specific source.** `unmonitorMovie` writes Radarr → `sourceType:'RADARR'`;
  `unmonitorSeries` writes Sonarr → `sourceType:'SONARR'`. Derivable from the query's `contentType`
  (`movie`→RADARR, `show`→SONARR) at the emit site.
- **System data jobs span everything → `sourceType` absent (evict both).** `system:enrichment`
  enriches *all* identities regardless of source (`enrichmentJob.ts`); `system:identity-resolution`
  runs movies + series + plex in one task (`identityResolutionJob.ts`). Neither can name one source, so
  both emit with `sourceType` undefined ⇒ both movie and series lists evict.

So the gate's `sourceType` is computed per producer, not read off a static field: specific for user
unmonitor tasks, absent for the system jobs.

## Producers & consumers

- **Producer:** `AutomationExecutor.execute()` — `run:started`, `run:completed`, and gated
  `data:changed`. Any **future** writer of media-relevant data (a Tautulli/Plex webhook, a manual
  re-enrich, a backfill) emits `data:changed` directly — decoupled from run lifecycle so non-run
  writers invalidate the cache too.
- **Consumers (later phases):** SSE task stream (P4), SSE data stream (P5), media handler cache (P3).

## TDD cycles

1. **Typed bus singleton in the cradle.** RED: resolve the bus from the container; assert a subscriber
   receives a published typed event. GREEN: register the `EventEmitter` wrapper with the event-type
   map. REFACTOR: lock the payload types.
2. **`run:started` on execute.** RED: execute an automation; a subscriber receives `run:started` with
   `{ automationId, kind, taskId, startedAt }` before the body completes. GREEN: emit at the top of the
   run body. REFACTOR.
3. **`run:completed` post-commit with persisted ids.** RED: subscriber receives `run:completed` whose
   `runId`/`ranAt` equal the row just written — and the emit happens **after** the commit (assert
   ordering, e.g. the row is queryable when the event fires). GREEN: emit after `recordResult`,
   threading the persisted ids out of the run service. REFACTOR.
4. **`run:completed` on failure.** RED: a throwing run still emits `run:completed` with
   `status:'error'` and the message. GREEN: emit from the catch path post-commit. REFACTOR: single emit
   site for both outcomes.
5. **Task scope declaration.** RED: the dispatch entry for `unmonitorMovie` exposes `affects:'media'`;
   `triggerSearch` exposes none. GREEN: reshape entries to `{ run, affects? }`; update call sites
   (`:147`,`:166`). REFACTOR.
6. **`data:changed` gated.** RED: a scoped task with `itemCount>0` emits `data:changed`; the same task
   with `itemCount===0` emits nothing; a no-scope task (`triggerSearch`, backup) emits nothing
   regardless of count. GREEN: implement the gate at the emit site. REFACTOR.
7. **`sourceType` per producer.** RED: `unmonitorMovie` emits `sourceType:'RADARR'`, `unmonitorSeries`
   `'SONARR'` (from `contentType`); `system:enrichment` and `system:identity-resolution` emit with
   `sourceType` **absent** (they span both). GREEN: compute `sourceType` per producer at the emit site.
   REFACTOR: one helper mapping producer→sourceType.

## Why not the alternatives

- **Two separate mechanisms** (bespoke run channel + direct job→handler cache hook): duplicates
  "emit + react" twice and leaves the boundary unsolved for the next consumer.
- **`run:completed` as the cache trigger** (no `data:changed`): conflates "a run finished" with "data
  changed" — a backup completing would needlessly invalidate, and the `itemCount>0` gate could not be
  expressed cleanly.

## Gates

- `yarn test` (vitest) — emission/payload/ordering/gate assertions via a test subscriber.
- `yarn typecheck:server` — the typed event map must reject malformed payloads.
- `yarn lint`.

## Done when

The executor emits all three events at the specified moments with typed payloads, `run:completed` is
provably post-commit with real ids, and the gate emits `data:changed` exactly per contract — all
asserted through a subscriber, with no consumer wired yet.
