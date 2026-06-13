# Phase 5 — Realtime UI: SSE data stream

**Status:** IN PROGRESS — **Phase 5** of the Realtime & Event-Driven Cache plan (see `README.md`).
TDD (backend + functional client hooks). **Depends on:** Phase 2 (`data:changed`), Phase 3 (makes the
grid revalidation cheap), Phase 4 (reuses the SSE endpoint + hook + resync pattern).

Functional only; no visual work (that is Phase 6).

## Observable value

A data-mutating run pushes a frame over `GET /api/events/data`, and a **mounted** media grid revalidates
its list. Assert: with the grid mounted, a `data:changed` causes exactly one list refetch (now cheap —
Phase 3 cached the enrichment maps); with the grid unmounted, no work happens.

## Why a second stream rather than one

Split by event type because the two families are **never shown on the same screen** — the media grid
opens exactly the data stream, the Automations/System screens open exactly the task stream, with no
client-side filtering and no conflation. Only ever two streams, so the per-origin connection cap is a
non-issue. This phase **reuses** the SSE-writer helper and the `EventSource`-in-hook + resync pattern
established in Phase 4; it should add almost no new infrastructure.

## Client model: revalidate, not per-item patch (v1)

On `data:changed` on a mounted grid → **revalidate the grid** (refetch the list). Not a per-item local
patch in v1: patching one grid item locally would require a richer per-item payload + client merge logic
mirroring the server-side selectivity that was deliberately deferred (see Phase 3). Revalidation is
correct and now cheap. Per-item patching is the same deferred evolution path as keyed cache eviction —
not pursued here.

The same **resync-on-(re)connect** rule from Phase 4 applies: one revalidation when the `EventSource`
opens, then live events thereafter. For the data grid the connect-resync and the event-reaction are
both "revalidate the list," so the hook is thin.

## TDD cycles

1. **Endpoint streams data events.** RED: an authed client on `GET /api/events/data` receives a
   `data:changed` frame (with `sourceType`) when a scoped run commits; unauthed is rejected; `run:*`
   does **not** appear here. GREEN: SSE endpoint subscribing to the data family, reusing the P4 writer
   helper. REFACTOR.
2. **`useDataEvents` revalidates a mounted grid.** RED (mocked `EventSource`): dispatching
   `data:changed` triggers exactly one SWR revalidation of the media list. GREEN: hook subscribes and
   calls `mutate`. REFACTOR: share the open/lifecycle/resync logic with `useTaskEvents` (extract the
   common `EventSource` hook if the duplication is real).
3. **Resync on connect.** RED: on `open`/reconnect the grid revalidates once to seed a baseline. GREEN.
   REFACTOR.
4. **Scope is respected end-to-end (optional refinement).** RED: a `sourceType:'RADARR'` event need not
   revalidate a series-only grid. GREEN: gate the revalidation on the mounted grid's content type if
   cheap; otherwise document revalidate-both as acceptable (over-fetch is safe, same philosophy as the
   cache). REFACTOR.
5. **Lifecycle.** RED: unmount closes the source. GREEN. REFACTOR.

## Gates

- `yarn test` (vitest) — endpoint integration + hook tests against a mocked `EventSource`.
- `yarn typecheck:server && yarn typecheck:client`, `yarn lint`.

## Done when

`/api/events/data` streams `data:changed` under auth, `useDataEvents` revalidates a mounted grid once
per event and once on connect, the SSE-hook pattern is shared with Phase 4 rather than duplicated, and
the source is cleaned up on unmount. With Phases 4–5 done, the realtime data flow is complete and
correct; Phase 6 makes it look right.
