# Domain Event Bus — deferred decisions & hardening

**Status:** INTENT (future state, not built). Companion to the implemented
`docs/architecture/domain-event-bus.md`. Captures design friction surfaced during Phase 2 that the
behaviour-level TDD cycles could not expose, plus one reversed decision. Most items **must be
resolved before or within Phase 4/5**, when the first consumers attach listeners — today the bus
emits into the void, so none of these can manifest yet.

## Reversed decision: namespaced events vs. generic `data:changed`

The original plan **decided** a single generic
`data:changed { scope, sourceType? }` event "so non-media domains can be added without a new event."
Phase 2 **overturned** this: the event name is namespaced per scope (`media:changed`, future
`library:changed`), derived from the task's `affects` declaration as `` `${affects}:changed` ``.

- **Why reversed:** the namespace declares the family on the event it triggers, giving each domain
  room to deepen its own payload independently rather than overloading one event with a discriminator
  every consumer must branch on. Natural alignment that can get deeper later.
- **Cost accepted:** adding a scope now requires lockstep edits — a `<scope>:changed` entry in the
  `DomainEvents` map **and** the scope in the `affects` union (see M3 below).

## Decision: no within-scope discriminator on `media:changed`

`media:changed` ships with an **empty payload**. An earlier iteration carried `sourceType: 'RADARR' |
'SONARR'` derived from the producing provider, for partitioned cache eviction. It was removed before
shipping because:

- The event exists **only** to drive cache invalidation, and the Phase 3 cache is **whole-scope**
  (not segmented). A discriminator with no consumer to honour it is speculative friction.
- The chosen discriminator was the wrong axis (see "provider privileging" below): the enrichment cache
  partitions on media **kind** (movie vs show), and `sourceType: 'RADARR'` only stood in for "movies"
  because Radarr happens to own movie identities. It conflated *provider* with *media kind*.

Re-introduce a discriminator **only** when a consumer actually segments its cache, expressed in that
consumer's own vocabulary (`movie`/`show`), not the provider-source axis.

## Open model question: provider privileging in the identity model

The `sourceType` discomfort pointed at a deeper tension that **predates the event bus**: the identity
model promotes Radarr/Sonarr to first-class *owners* while modelling media servers and others as
enrichment. That question now has a dedicated home — see
**`docs/intent/provider-source-model.md`** (sources as a seeding role, `(providerId, externalId)`
identity, multi-instance support, versions/editions). Phase 2 only avoided propagating the privileging
onto the event surface; the model correction lives there.

## Single-source-of-truth for task scope

Actuator-task scope now lives on the `ActuatorTaskDescriptor` the `MediaActuator` role declares (`affects`),
so an actuator task answers "what scope do I affect" from its own definition. The remaining split is the
separate `SYSTEM_TASKS` registry for internal jobs (`system:enrichment`, `system:identity-resolution`):
adding a new data-writing system job means remembering that registration or it silently never invalidates.
Intent: fold system-job scope into the same descriptor-carried model so there is one answer keyed by taskId.

## Hardening required before consumers attach

Priority reflects operational risk once Phase 4/5 SSE consumers subscribe.

### High

- **H1 — Listener isolation.** `EventEmitter.emit` is synchronous and re-throws the first listener's
  exception into the caller. Because `emitDataChange` runs inside `execute()`'s `try`, a throwing
  `media:changed` consumer would be caught and **mis-recorded as an execution failure** (a second
  `recordResult(status:'error')` → a duplicate `run:completed` for an already-successful run). A
  throwing `run:started` consumer would abort the run before the provider is even called. A consumer
  bug must never become a producer outage: the bus must isolate listeners (per-dispatch try/catch, or
  microtask/queue dispatch) and guarantee it never throws into or crashes the producer.
- **H2 — Process-crash safety.** Node's `EventEmitter` throws if `emit('error', …)` has no listener.
  The bus should document/guarantee "never crashes the process," independent of the typed map.
- **H3 — Listener-leak / teardown contract.** The bus is a `.singleton()`; Phase 4/5 SSE consumers
  live in per-request scope and will `bus.on(...)` per connection. Default `maxListeners` is 10, so
  the 11th concurrent stream warns, and any consumer that forgets `off()` on disconnect leaks
  permanently. `off()` needs the exact same function reference — fragile with inline/bound handlers.
  Intent: an explicit per-connection subscription/teardown API (e.g. a `subscribe()` returning an
  unsubscribe handle, and/or `once`), and a raised/observed `maxListeners` policy.

### Medium

- **M1 — Ordering is incidental, not contractual.** Today statements happen to fire
  `run:started → run:completed → media:changed`. Nothing pins this; making `recordResult`
  fire-and-forget would silently invert it. Phase 5 consumers must not couple to cross-event order —
  either document a guarantee or have consumers treat events as independent.
- **M2 — No replay/buffer; emit-before-attach is dropped.** The scheduler can run automations at
  startup before any consumer (or SSE client) attaches; those events vanish. Phase 3's cache consumer
  must be registered synchronously at container-build time, before the scheduler's first tick — an
  ordering currently enforced nowhere (awilix resolves lazily).
- **M3 — Typed-map / runtime divergence on widening.** `emit(`${affects}:changed`, …)` only type-checks
  because `affects` is exactly `'media'`. Widening `affects` (e.g. `'library'`) without adding the
  matching `DomainEvents` key fails to compile — or, if cast, emits an event name with no typed
  payload and no listener: a silent no-op. The runtime string and the compile-time map are only
  coincidentally aligned.
- **M4 — Dropped-event observability.** `EventEmitter.emit` returns whether any listener fired; the
  wrapper discards it. For a cache-invalidation system, "fired `media:changed`, nobody consumed it"
  is exactly the failure that should be observable. Surface it (log/metric).
- **M5 — Process-local ceiling (known).** In-process bus means clustering / multi-instance breaks SSE
  fan-out across workers. Already an accepted single-process constraint; restate explicitly in the
  Phase 5 spec so it isn't rediscovered.

### Low

- **L1 — Two time sources.** `startedAt`/`finishedAt` are stamped at event-build time, not
  operation time, and drift from the DB-sourced `ranAt`. Consumers correlating `startedAt`→`ranAt`
  see skew.
- **L2 — Asymmetric correlation key.** `run:completed` carries `runId`; `run:started` does not.
  Pairing a start/complete for one run falls back to `automationId` + timing, ambiguous for
  back-to-back runs of the same automation. Consider a per-run token on `run:started`.
- **L3 — No `once` in the typed surface.** One-shot consumers must hand-roll self-removal, raising
  leak risk (ties to H3).
