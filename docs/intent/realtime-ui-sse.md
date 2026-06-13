# Realtime UI — Server-Sent Events

**Status:** INTENT — not yet built. Closes the Phase 3 Run-Now feedback gap (button + 202 work, but
nothing reflects the result in the UI).
**Depends on:** `domain-event-bus.md` (consumes `run:*` and `data:changed`).

## Two channels, by event type

Two SSE endpoints under the existing `/api` session middleware (so they inherit auth and close on
logout):

| Endpoint | Carries | Subscribed by |
|---|---|---|
| `GET /api/events/tasks` | `run:started`, `run:completed` | Automations screen, System screen |
| `GET /api/events/data` | `data:changed` | Media grid |

Split by event type rather than one global stream because the two families are **never shown on the
same screen** — a screen opens exactly the one stream it needs, with no client-side filtering and no
conflation. Only ever two streams, so the browser per-origin connection cap is a non-issue.

## Client model: authoritative push + one resync on connect

The events are small and fully describable, so the client **mutates local SWR state directly from the
payload** — no per-event round-trip to the server.

- **`run:started`** → patch the row to a transient "running…" state; start a **client-side duration
  ticker** from `startedAt` (no server polling for elapsed time).
- **`run:completed`** → patch `useAutomations[].lastRun` (`{ at: ranAt, status, itemCount }`) and
  prepend the run to `useAutomationRuns`. The payload carries the **persisted `runId`/`ranAt`**
  (emitted post-commit) so the locally-applied row matches a later refetch — no synthesised ids that
  would duplicate/diverge.
- **`data:changed`** on a mounted grid → **revalidate the grid** (refetch the list — now cheap, the
  enrichment maps are cached). Not a per-item local patch in v1: patching one grid item locally would
  require a richer per-item payload + client merge logic mirroring the server-side selectivity that
  was deliberately deferred (see cache doc).

### The one non-negotiable: resync on (re)connect

Authoritative push alone is a correctness bug under reconnect — a client that mounts **mid-run**, or
whose socket blips, never learns what it missed and shows stale state forever. The fix is **one** SWR
revalidation when the `EventSource` opens (and on each reconnect) to seed a correct baseline; live
events patch locally thereafter. That is one GET **per connection**, not per event — it keeps the
"no round-trip per event" goal while closing the divergence hole.

This means **no event durability / replay / `Last-Event-ID`** is needed: a reconnect resyncs from the
DB-backed GET, so missed events during a blip don't matter.

## Subscription lifecycle

Each stream is owned by a **screen-scoped hook** (`useTaskEvents` on Automations/System;
`useDataEvents` on the media grid) that opens its `EventSource` on mount and closes it on unmount.
The connect-resync lives in the hook's `open`/reconnect handler. No app-level provider — subscription
is tied to the screen that needs it, matching mount/unmount.

## Producer rule (restated from the bus)

`run:completed` is emitted **after** the run row is committed, carrying the real `runId`/`ranAt`.
Emitting before commit would let a client's locally-applied row race ahead of (and diverge from) the
persisted truth.

## Why not the alternatives

- **Revalidation-nudge** (event just triggers a refetch, payload carries nothing authoritative):
  simpler, but adds a GET per event and a latency flash; unnecessary once the payload is small and
  fully describable. Rejected — but note the *connect* resync is itself a nudge, used once.
- **Pure push, no resync:** smallest traffic, but stale-on-reconnect with no self-heal. Rejected.
- **One global stream:** would force client-side filtering and send every tab every event; the
  two-channel split is cleaner given the screens never overlap.
