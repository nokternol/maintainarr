# Warden — Enriched Filters & System Task Execution
## Plan Index

**Context:** Overseerr/TMDB filters "have no effect." Diagnosis traced two independent defects plus a
data-pipeline gap:

1. **Two filter engines.** The Media browse page filters through `server/utils/mediaFilters.ts`, a
   parallel imperative implementation whose query types never declared `overseerr*`/`tmdbStatus`/
   enrichment predicates. Zod strips those params before they reach the filter, so the controls the
   UI renders are silently dropped → **every item kept**. The canonical engine
   (`server/utils/filterRegistry.ts`, used by `AutomationExecutor`) *does* have them.
2. **System jobs throw on execution.** `IdentityResolutionJob` and `EnrichmentJob` are seeded as
   `kind='system'` automations and scheduled, but `AutomationExecutor.execute()` assumes
   provider + query sources and throws "has no provider" for them. So `media_identity` /
   `media_enrichment` are never populated and every enriched predicate has no data to read.

**Product framing:** A filter the UI offers must actually filter, through one engine, against real
enriched data; and an operator must be able to run any automation — including the data jobs — on
demand. Ordered by delivered value and dependency (data pipeline first, since enriched predicates
are meaningless without it).

---

## Phase status

| Phase | File | Status | Prerequisite |
|---|---|---|---|
| 0 — Single-active-provider-per-type invariant | `ENRICHED_FILTERS_phase_0.md` | NOT STARTED | — |
| 1 — System task execution (hybrid dispatch) | `ENRICHED_FILTERS_phase_1.md` | NOT STARTED | Phase 0 |
| 2 — Unified filter engine | `ENRICHED_FILTERS_phase_2.md` | NOT STARTED | Phase 1 (for enriched data; predicates testable on fixtures sooner) |
| 3 — Run Now + system panel | `ENRICHED_FILTERS_phase_3.md` | NOT STARTED | Phase 1 (system run-now does work only once dispatch lands) |

---

## Decisions made (resolved in design session)

| # | Decision | Why |
|---|---|---|
| D1 | **Hybrid system-task dispatch.** `execute()` branches `kind==='system'` to an isolated `SystemTaskRunner` (`SYSTEM_TASKS` registry, sibling to `RADARR_TASKS`/`SONARR_TASKS`). Run lifecycle (`automation_runs`, `lastRunStatus`) stays shared in the executor. | Honours separation of task intent without the parallel run-recording infrastructure `system-vs-user-automations.md` set out to avoid. Keeps run-history and Run-now uniform across kinds. |
| D2 | **Single filter engine.** The browse path (`media.handler`) reuses `filterRegistry`. `mediaFilters.ts` is deleted. | Eliminates the drift that caused the bug. One place a predicate is ever defined. |
| D3 | **Watched migrates to the enrichment predicate.** `tautulliWatched` maps to the registry `watched` predicate (`playCount` from enrichment), not live Tautulli title-matching. `watchedTitleMatching.ts` + `fetchWatchedTitles` are removed. | Single source of truth. Accepted trade-off: watched yields 0 results until the enrichment + identity pipeline has run. |
| D4 | **Shared enrichment merge.** The identity→enrichment merge is extracted from `AutomationExecutor` into one helper used by both the executor and `media.handler`. | Prevents a *new* drift between two merge implementations. |
| D5 | **Run Now = `POST /api/automations/:id/run`, async 202 + poll.** Kicks off `executor.execute(id)` in the background (`.catch` logged), returns 202; UI polls run-history. | Matches how cron runs jobs; never blocks the request through a multi-minute enrichment run. |
| D6 | **Run Now is kind-agnostic and ignores paused status.** Calls `executor.execute(id)` directly (not `scheduler.trigger`, which only fires currently-scheduled jobs). Covers user + system automations. | A manual "refresh enrichment now" falls out for free; a paused automation can still be run once. |
| D7 | **Minimal system panel this round.** `useAutomations` gains a `kind` filter; `src/pages/system` renders read-only system-automation rows with a Run-now button. | The page is currently a 35-line stub; the Run-now button needs a home. |
| D8 | **At most one active provider per type.** Activating/creating a provider of a type that already has an active instance is rejected. Jobs and the browse path resolve **the single active provider** of each type. | Removes multi-instance aggregation ambiguity for the jobs and the enrichment merge. Constraint until multiple instances become a real requirement — then revisit aggregation. |

---

## Architecture flags / cross-cutting risks

| Finding | Affects | Phase | Note |
|---|---|---|---|
| System jobs are `status='active'` and scheduled, but `execute()` throws "has no provider" → silent error runs every tick | Executor | 1 | Root cause of empty enrichment tables |
| Jobs (`IdentityResolutionJob`, `EnrichmentJob`) and their provider deps are not in the DI container | `container.ts` | 1 | Must register + resolve active providers by type |
| Multiple active providers of one type: jobs take a single provider dep | Provider settings | 0 | **Resolved by D8** — invariant of one active provider per type; jobs/browse resolve the single instance |
| `media.handler` returns **raw** `RadarrMovie`/`SonarrSeries` to the client; registry filters operate on `Normalized*` | `media.handler` | 2 | Filter on normalized, map matched ids back to raw (mirror executor) — the seam to pin with tests |
| `MediaCradle` has no `db` | `media.handler`, `container.ts` | 2 | Needed to build the enrichment map |
| Croner `{ protect: true }` only guards *cron* overlap; a manual run can overlap a scheduled run | Executor | 3 | Add an in-flight guard keyed by automationId |
| Browse query-param names are content-prefixed (`movieTagIds`); registry keys are not (`tagIds`) | `media.handler` schemas | 2 | Keep the URL contract; map param names → registry keys inside the handler |

---

## Conventions

- **TDD throughout** (project rule): implementation-independent tests first, one predicate/behaviour
  per cycle, design sign-off between cycles. Do **not** batch registry/filter entries in a single cycle.
- Test runner: `yarn vitest run --project server` (node) and `--project client` (happy-dom).
- After code changes: `graphify update .`
- Delete each phase doc when the phase ships; update this index's status table as phases land.
