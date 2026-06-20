# Phase 4 — Realtime UI: SSE task stream

**Status:** INTENT (reverted from in-flight) — **Phase 4** of the Realtime & Event-Driven Cache plan (see `README.md`).
TDD (backend + functional client hooks). **Depends on:** Phase 2 (`run:*`). Closes the Run-Now feedback
gap (the button + 202 work today, but nothing reflects the result in the UI).

Scope is **functional only** — transport, hook logic, and SWR patching. The *visual* treatment of the
running state (icon, animation, columns, verb relabel) is **Phase 6 (impeccable)**. The line is logic
vs. looks.

## Observable value

A run (including Run Now) pushes frames over `GET /api/events/tasks`, and `useTaskEvents` turns them
into local SWR state:
- on `run:started` → the row enters a transient **"running…"** state and a client-side duration ticker
  starts from `startedAt` (no server polling for elapsed time);
- on `run:completed` → `useAutomations[].lastRun` is patched to `{ at: ranAt, status, itemCount }` and
  the run is prepended to `useAutomationRuns`, using the **persisted `runId`/`ranAt`** so the local row
  matches a later refetch;
- on (re)connect → exactly **one** SWR revalidation seeds a correct baseline (the resync).

Assert the server behaviour with an HTTP client reading the event-stream; assert the hook behaviour
with a **mocked `EventSource`** and React Testing Library — no real network.

## This phase establishes the shared SSE pattern

`GET /api/events/tasks` lives under the existing `/api` session middleware (inherits auth, closes on
logout). The client side is a **screen-scoped hook** (`useTaskEvents`, mounted on Automations + System)
that owns its `EventSource`: opens on mount, closes on unmount, resyncs on open/reconnect. Phase 5
reuses this exact pattern for the data stream, so build it cleanly here.

## Client model: authoritative push + one resync on connect

The events are small and fully describable, so the client **mutates local SWR state directly from the
payload** — no per-event round-trip.

### The one non-negotiable: resync on (re)connect

Authoritative push alone is a correctness bug under reconnect — a client that mounts **mid-run**, or
whose socket blips, never learns what it missed and shows stale state forever. Fix: **one** SWR
revalidation when the `EventSource` opens (and on each reconnect) to seed a correct baseline; live
events patch locally thereafter. One GET **per connection**, not per event.

This means **no event durability / replay / `Last-Event-ID`** is needed: a reconnect resyncs from the
DB-backed GET, so missed events during a blip don't matter.

## Producer rule (from Phase 2, restated)

`run:completed` is emitted **after** the run row is committed, carrying the real `runId`/`ranAt`.
Emitting before commit would let a client's locally-applied row race ahead of (and diverge from) the
persisted truth. Phase 2 already guarantees this; Phase 4 relies on it.

## TDD cycles

1. **Endpoint streams run events.** RED: an authed HTTP client on `GET /api/events/tasks` receives a
   `run:started` frame when a run begins and a `run:completed` frame after it commits; an unauthed
   request is rejected. GREEN: SSE endpoint subscribing to the bus's task family under session
   middleware. REFACTOR: extract a reusable SSE-writer helper (consumed again in P5).
2. **Endpoint isolates the task family.** RED: a `media:changed` does **not** appear on
   `/api/events/tasks`. GREEN: subscribe to `run:*` only. REFACTOR.
3. **`useTaskEvents` patches running state.** RED (mocked `EventSource`): dispatching `run:started`
   moves the row to "running…" and starts the ticker from `startedAt`. GREEN: hook opens the source,
   patches SWR. REFACTOR.
4. **`useTaskEvents` applies the committed result.** RED: dispatching `run:completed` patches
   `lastRun` and prepends to `useAutomationRuns` using the payload's `runId`/`ranAt`; a subsequent
   refetch does not duplicate the row. GREEN. REFACTOR.
5. **Resync on (re)connect.** RED: on `open` (and on a simulated reconnect) the hook triggers exactly
   one SWR revalidation; mounting mid-run yields correct state without any live event. GREEN: resync in
   the open/reconnect handler. REFACTOR.
6. **Lifecycle.** RED: unmount closes the `EventSource` (no leak). GREEN. REFACTOR.

## Why not the alternatives

- **Revalidation-nudge** (event carries nothing; just refetch): adds a GET per event and a latency
  flash; unnecessary once the payload is fully describable. (The *connect* resync is itself one nudge,
  used once.)
- **Pure push, no resync:** stale-on-reconnect with no self-heal. Rejected.
- **One global stream:** would force client-side filtering and send every tab every event; the
  task/data split (P4/P5) is cleaner since the screens never overlap.

## Gates

- `yarn test` (vitest) — endpoint integration + hook tests against a mocked `EventSource`.
- `yarn typecheck:server && yarn typecheck:client`, `yarn lint`.

## Done when

`/api/events/tasks` streams `run:*` under auth, `useTaskEvents` applies running→completed locally with
persisted ids, a (re)connect resyncs exactly once, and the source is cleaned up on unmount — with no
visual styling work (that is Phase 6).
