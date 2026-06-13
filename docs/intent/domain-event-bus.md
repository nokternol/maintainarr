# Domain Event Bus

**Status:** INTENT — not yet built. This is the spine for realtime UI and cache invalidation.

## What it is

A single in-process, typed `EventEmitter` singleton registered in the container cradle. Producers
(the executor and data jobs) publish domain events; consumers (the SSE endpoints, the media
handler's cache) subscribe. It exists because two independent needs — pushing run status to the UI
and invalidating the enrichment cache when data changes — both reduce to *"something inside the
scheduler/executor context happened, and something outside it must react."* That is the
`job → handler` boundary that has been missing (see the enrichment-cache debt). Build the seam once.

**Single process only.** No Redis / cross-node fan-out. Matches the self-hosted, single-operator
deployment. If Warden ever scales horizontally, this is the boundary to revisit.

## Event catalogue

Two families, deliberately orthogonal — they are never conflated on the same screen, so they are
also exposed as two separate SSE channels (see `realtime-ui-sse.md`).

### Run lifecycle (the "task" family)

Fires for **every** automation run — user or system, including non-data tasks (backup, update-check,
health). Feeds run-status UI only; says nothing about whether data changed.

| Event | Payload | Emitted |
|---|---|---|
| `run:started` | `{ automationId, kind, taskId, startedAt }` | when `executor.execute()` begins the run body |
| `run:completed` | `{ automationId, kind, taskId, status, itemCount, error, finishedAt, runId, ranAt }` | **after** the run row is committed, carrying the persisted `runId`/`ranAt` |

`run:completed` is emitted **post-commit with the real persisted identifiers** so a client can apply
it authoritatively without the row diverging from a later refetch (see SSE doc).

### Data change (the "data" family)

Fires **only when an operation actually mutated cached-relevant data.** This is a correctness-vs-
thrash distinction: emission is the trigger for cache invalidation, so it must be precise — a backup
run must be silent; a user task that unmonitors/deletes library items must fire.

| Event | Payload | Emitted |
|---|---|---|
| `data:changed` | `{ scope: 'media', sourceType?: 'RADARR' \| 'SONARR' }` | after a successful run **iff** the task declares a data scope **and** `itemCount > 0` |

Generic `scope` field so non-media domains can be added without a new event. `sourceType` absent ⇒
both movies and series affected.

#### How a task declares it changed data — declarative + gated

Task definitions carry an optional data scope (e.g. `affects: 'media'`) alongside the existing
dispatch entries (`RADARR_TASKS` / `SONARR_TASKS` / `SYSTEM_TASKS`). The executor emits
`data:changed` after a successful run **only when** the task declares a scope **and** the run touched
something (`itemCount > 0`). Consequences:

- `unmonitor*`, `delete*` → declare `media`.
- `triggerSearch` → declares **nothing**: it kicks off an async search in Radarr/Sonarr; `hasFile`
  flips out-of-band minutes later, so it does not synchronously change the displayed library.
- `system:enrichment`, `system:identity-resolution` → declare `media`. This requires those jobs to
  return a **real changed-row count** (not a placeholder `0`), so the `itemCount > 0` gate is
  meaningful.
- Future `backup`, `update-check`, `health` → declare nothing → silent.

The knowledge of "did this change data" lives with the task definition, not scattered across handlers.

## Producers

- `AutomationExecutor.execute()` — `run:started`, `run:completed`, and (gated) `data:changed`.
- The enrichment / identity jobs feed the changed-count the gate reads.
- Any **future** writer of media-relevant data (a Tautulli/Plex webhook, a manual re-enrich, a
  backfill) emits `data:changed` directly — it is decoupled from run lifecycle precisely so non-run
  writers invalidate the cache too.

## Consumers

- **SSE task stream** (`/api/events/tasks`) — `run:started` / `run:completed`.
- **SSE data stream** (`/api/events/data`) — `data:changed`.
- **Media handler cache** — `data:changed` → scope-selective, debounced invalidation
  (see `enrichment-cache-invalidation.md`).

## Why not the alternatives

- **Two separate mechanisms** (a bespoke run channel + a direct job→handler cache hook): duplicates
  "emit + react" twice and leaves the boundary unsolved for the next consumer.
- **`run:completed` as the cache trigger** (no `data:changed`): conflates "a run finished" with "data
  changed" — a backup completing would needlessly invalidate, and the gate (`itemCount > 0`) could
  not be expressed cleanly. Rejected in favour of the precise, generic `data:changed`.

## Post-Phase-3 build order

1. **This bus** — spine; no user-visible value alone.
2. **Enrichment cache + `data:changed`** (`enrichment-cache-invalidation.md`) — backend-only, unit-
   testable; proves the bus contract and clears the standing perf debt before any transport rides on it.
3. **Realtime UI / SSE** (`realtime-ui-sse.md`) — closes the Phase 3 run-feedback gap.
4. **Archive / Restore** (`automation-archive.md`) — independent of the bus; slot anytime.
5. **impeccable relabel pass** (`automation-verbs-and-separation.md`) — after SSE, so the live
   "running…" visual and the verb relabel are designed together.
