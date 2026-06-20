# Realtime & Event-Driven Cache — phased TDD plan

**Status:** INTENT — **reverted from in-flight.** P1 and P2 shipped; P3–P6 were paused mid-plan and
moved back here from `docs/in_progress/` because they ride on the executor and automation create/run
path that the System-Roles & MediaQueryEngine heal (`docs/in_progress/`) rewrites. They resume — phase
numbers, index, and shipped/pending state unchanged — once that heal lands. One target (the domain event
bus and everything that rides on it) broken into six phases. Each backend phase is a full TDD phase
(RED/GREEN/REFACTOR) with enumerated cycles and a single observable behaviour; the final phase is a
frontend visual pass run through the `impeccable` skill, not TDD. When resumed, move each phase's spec
back to `docs/in_progress/` as it is picked up, and move any durable implemented pattern to
`docs/architecture/` when it ships.

**Why paused:** P3 caches the enrichment merge and subscribes to `media:changed`; P4/P5 stream off the
executor's run lifecycle. The heal extracts the executor's resolution half into `MediaQueryEngine` and
changes the automation create-path validation — the exact seams these phases extend. Building them first
would mean reworking them. See `docs/in_progress/README.md`.

## The target

Two standing needs — pushing run status to the UI, and invalidating the enrichment cache when data
changes — both reduce to *"something inside the scheduler/executor happened, and something outside it
must react."* That single `job → handler` seam is the target. The phases below build it bottom-up:
make run results carry honest data, emit events off them, then hang consumers (cache, then two SSE
streams) off the bus, then make it look right.

## "Observable value" in this plan

Per the tdd skill, every TDD phase delivers a behaviour **detectable from outside the unit under
test** — not necessarily visual. An emitted event is observable (assert via a test subscriber); a
persisted run-record field is observable (assert via the service/API); an evicted cache entry is
observable (assert the next read re-fetches). Only Phase 6 is visual, and it is explicitly *not* TDD.

## Phases

| Phase | Spec | Observable value | Depends on | Kind |
|---|---|---|---|---|
| **1** | ✅ shipped | A system data run (enrichment / identity-resolution) records a **real `itemCount`** instead of hardcoded `0`. The job→runner→executor chain is typed `Promise<number>`; `runForPlex` counts rows actually changed via `rowsAffected`. | — | TDD (backend) |
| **2** | ✅ shipped | `executor.execute()` **emits** `run:started`, `run:completed` (post-commit, real ids), and the namespaced `media:changed` (gated on declared scope + `itemCount > 0`) — asserted via a test subscriber. Pattern: `docs/architecture/domain-event-bus.md`. | P1 (honest counts make the gate meaningful) | TDD (backend) |
| **3** | `phase-3-enrichment-cache.md` | After a `media:changed`, the **next** `listMovies`/`listSeries` re-fetches the enrichment maps; an unrelated run does **not** evict; a missed emit self-heals within the absolute 5-min TTL. | P2 (`media:changed`) | TDD (backend) |
| **4** | `phase-4-sse-task-stream.md` | A run (incl. Run Now) pushes frames over `GET /api/events/tasks`; `useTaskEvents` patches the row to *running* then to the committed result; a mid-run (re)connect resyncs. | P2 (`run:*`) | TDD (backend + client hooks) |
| **5** | `phase-5-sse-data-stream.md` | A data-mutating run pushes a frame over `GET /api/events/data`; a mounted grid revalidates (now cheap — P3). | P2 (`media:changed`), P3 (cheap revalidate), P4 (reuses the SSE-hook pattern) | TDD (backend + client hooks) |
| **6** | `phase-6-impeccable-automation-verbs.md` | Verb relabel (Run Now/Disable/Archive), the live "running…" visual, and the System → Tasks column treatment. | P4 + P5 (live state to design against) | **impeccable** (visual, not TDD) |

```
P1 run counts ─► P2 event bus ─┬─► P3 enrichment cache ─┐
                               │                        ├─► P5 SSE data-stream ─► P6 impeccable
                               └─► P4 SSE task-stream ───┘                          (visual)
```

P3 and P4 both depend only on P2 and may be built in either order; P3 is sequenced first because it is
backend-only, clears the standing enrichment-cache perf debt, and makes P5's grid revalidation cheap.

## Why this shape (boundaries redrawn from the original 4 docs)

- **P1 split out of the bus doc.** The bus's `itemCount > 0` gate is only honest if data jobs report a
  real count, but `automationExecutor.ts:90` hardcodes `0` for *every* system task and the job chain
  returns `Promise<void>`. Threading a real count (job → `SystemTaskRunner` → executor → run record)
  is its own observable behaviour and a prerequisite, so it is its own phase, not a buried footnote.
- **The SSE doc split into P4 + P5.** Two streams, two consumers, two screens, two distinct observable
  behaviours; P5 also depends on P3 while P4 does not. P4 establishes the shared SSE-hook + resync
  pattern that P5 reuses.
- **Frontend cleanly separated (P6).** Functional client *logic* (EventSource lifecycle, resync,
  SWR patching, the duration ticker) is TDD-tested inside P4/P5 against a mocked `EventSource`. P6 owns
  only the *visual* layer and runs through `impeccable` (Ladle story first, per `CLAUDE.md`).

## The `media:changed` gate contract (decided)

Emit the namespaced `media:changed` (no payload) **iff** the task declares a media scope **and**
`itemCount > 0`.

- `itemCount` **must be non-zero whenever cached-relevant data was written** (no false zero — that is
  the only failure mode that matters; it would leave the cache stale until the TTL backstop).
- `itemCount` **may over-count** actual mutations (e.g. user `unmonitor` of already-unmonitored items).
  Over-emission causes only safe, scope-level **over-eviction**, which the debounce absorbs.
- The cache **does not read the count's magnitude** — eviction is whole-scope. The count's only job in
  the gate is the zero/non-zero decision.
- **No within-scope discriminator.** The event carries no `sourceType`/`kind`: the cache is whole-scope,
  so a discriminator would be premature friction. It returns only if a consumer segments its cache and
  proves it needs one, in that consumer's own vocabulary — *not* the provider-source axis inherited
  from `media_identity`. See `docs/intent/domain-event-bus-hardening.md`.

## Out of this target (left in `docs/intent/`)

- `automation-archive.md` — soft delete / restore; independent of the bus, slot any time. Its Archive
  *verb visual* folds into P6 only if both are ready together.
- `filter-ui.md` — provider-gating + prop-accumulation cleanup; a separate Phase-4-combination-builder
  concern needing its own design pass.
