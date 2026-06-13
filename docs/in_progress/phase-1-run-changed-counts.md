# Phase 1 — Honest changed-counts for runs

**Status:** IN PROGRESS — **Phase 1** of the Realtime & Event-Driven Cache plan (see `README.md`).
TDD (backend). No dependencies.

## Observable value

A system data run records a **real `itemCount`** in `automation_runs` instead of the hardcoded `0` it
writes today. After an enrichment run that wrote N rows, the persisted run row (and the API/run
history that exposes it) shows `itemCount === N > 0`, not `0`.

This is the prerequisite that makes Phase 2's `data:changed` gate honest: the gate is
`itemCount > 0`, and today every system task is permanently `0` (`automationExecutor.ts:90`), so the
gate would suppress events for the very producers — `system:enrichment`, `system:identity-resolution`
— that most need to invalidate the cache.

## The contract on the count (decided)

`itemCount` must satisfy the gate contract from the README:
- **Never falsely zero** when cached-relevant data was written. This is the binding requirement.
- **May over-count** actual mutations. Magnitude is never read by the cache; only zero/non-zero
  matters downstream. So a count of "rows examined and written" is acceptable; a perfectly faithful
  "rows whose state actually flipped" delta is **not required** (and explicitly not pursued).

## Current state (verified)

- `EnrichmentJobLike.run(): Promise<void>` and `IdentityJobLike.runForMovies/Series/Plex(): Promise<void>`
  (`server/services/systemTaskRunner.ts`).
- `SystemTaskRunner.run(taskId): Promise<void>` — dispatches to those jobs, returns nothing.
- `AutomationExecutor.execute()` for `kind==='system'` calls `recordResult(id, { itemCount: 0, ... })`
  (`automationExecutor.ts:85-92`).
- User tasks already return a real `finalIds.length` (`automationExecutor.ts:150,169`) — acceptable
  under the over-count contract; left as-is.

## Target shape

Thread a count up the chain, narrowest signature that carries it. The count source for each writer
(verified against the code):

- `EnrichmentJobLike.run(): Promise<number>` — **return `toEnrich.length`** (`enrichmentJob.ts:51`).
  It is already computed and in scope; the early `if (toEnrich.length === 0) return` path returns `0`.
  Over-counts only the staleness-refresh case (a stale row re-written with identical values, bumping
  `enrichedAt`) — safe over-eviction under the contract.
- `IdentityJobLike.runForMovies/Series/Plex(): Promise<number>` —
  - `runForMovies` (`:96`) and `runForSeries` (`:51`): one `insert…onConflictDoUpdate` **per item**, and
    an upsert always touches a row → return `movies.length` / `series.length` (guarded `0` when the
    provider is absent).
  - `runForPlex` (`:30`): writes are **conditional** — an `update … where tmdbId = X` fires only on a
    matching guid and may affect **0 rows** if no identity has that id yet. `items.length` would be
    wrong here. Count the rows **actually changed** (prefer the better-sqlite3 `.changes` rows-affected
    per statement; fall back to counting matched-guid updates issued). This is the only writer where
    "statements issued" ≠ "rows changed".
  - `SystemTaskRunner` **sums the three** for `system:identity-resolution`.
- `SystemTaskRunner.run(taskId): Promise<number>` — the per-task changed-row count.
- `AutomationExecutor.execute()` — replace the hardcoded `0` with the runner's returned count for the
  system branch; user branch unchanged.

## TDD cycles

1. **`EnrichmentJob.run` returns rows-enriched.** RED: a test asserting `run()` resolves to the count
   of rows it wrote (0 when `toEnrich` is empty, N otherwise). GREEN: change return type, return the
   length. REFACTOR: name the count at its source.
2. **`IdentityJob.runForMovies/Series` return rows-resolved.** RED: each resolves to `items.length`
   (every upsert touches a row); `0` when the provider is absent. GREEN: return counts. REFACTOR.
3. **`IdentityJob.runForPlex` counts rows *actually changed*.** RED: items whose guids match **0**
   identity rows contribute `0` to the count; a guid that updates a real row contributes `1` (never
   `items.length`). GREEN: count via rows-affected (`.changes`) or matched-guid updates. REFACTOR.
4. **`SystemTaskRunner.run` returns the task's count.** RED: `run('system:enrichment')` → the job's
   count; `run('system:identity-resolution')` → the sum of the three; unknown id behaviour preserved.
   GREEN: change signature, propagate/sum. REFACTOR.
5. **Executor records the real system count.** RED: an integration test — execute a system automation
   whose job wrote N rows; assert the recorded `automation_runs.itemCount === N` (not 0). GREEN: pass
   the runner's return into `recordResult`. REFACTOR: collapse the system/user branches' `recordResult`
   calls if they converge.

## Gates

- `yarn test` (vitest) — the unit + integration tests above.
- `yarn typecheck:server` — the `void → number` signature change must ripple cleanly through all
  callers (this is the compiler proving the thread is complete).
- `yarn lint`.

## Done when

A system enrichment/identity run persists a real `itemCount`, the whole job→runner→executor chain is
typed `Promise<number>`, and no caller still passes a hardcoded `0` for a system run. No events yet —
that is Phase 2.
