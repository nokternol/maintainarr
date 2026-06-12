# Phase 1 — System Task Execution (hybrid dispatch)

**Repo:** `/home/nokternol/repos/sandbox`
**Prerequisite:** Phase 0 (single active provider per type — so each job resolves exactly one provider per type)
**Blocks:** enriched predicates in Phase 2 having any data; system Run-now in Phase 3
**Status:** IN PROGRESS (provider resolution complete) — hybrid dispatch (1.1–1.5) + full provider
resolution (C1–C10) landed. The enrichment merge was refactored to a generic contribution model
(`mergeContributions` + pure `mapTautulli/mapPlex/mapOverseerr` functions); the job stores the *true*
combination of source data (no fabricated baselines — `null` = unknown), and the filter layer holds
null-semantics via a parameter (`booleanWithNull`, applied to `overseerrHasIssue`). Identity now
resolves Plex (`plexRatingKey`) + tvMaze backfill; enrichment resolves Tautulli/Overseerr/Plex and
stores the *true* combination of source data (`null` = unknown), materialized via `toEnrichmentValues`
(`Partial<EnrichmentValues>` → canonical `T | null`).

**TMDB dropped from enrichment:** the per-identity `getStatus` lookup was O(n) HTTP (3192 calls/run)
to re-derive a near-static `status` that Radarr/Sonarr already expose. Enrichment is now strictly
*supplementary* data the primary source can't give (play/views/requests/issues). Sourcing a status
filter from arr metadata (`movie.status` / `show.status`) belongs to **Phase 2** (filtering on
normalized arr data) — `tmdbStatus` column is left orphaned-but-harmless until then.

**E2E smoke run against the live LAN DB:** identity-resolution populated 3192 `media_identity` rows
(40s, success); enrichment wrote real rows (verified). Full server suite green (595).

---

## What this phase is and why

The two data-pipeline jobs are already seeded as `kind='system'` automations
(`server/health/ensureSystemJobs.ts`: `system:identity-resolution` @ `0 * * * *`,
`system:enrichment` @ `0 */6 * * *`) and scheduled at startup. But `AutomationExecutor.execute()`
does `if (!automation.provider) throw` and dispatches only via `RADARR_TASKS`/`SONARR_TASKS`, so
every system tick throws and records an error run. `media_identity` and `media_enrichment` stay
empty.

This phase teaches the executor to dispatch `system:*` tasks to the job classes (decision **D1**:
hybrid — isolated runner, shared run lifecycle), and wires the jobs + their provider deps into DI.

**End state:** a system automation tick (or a manual run) executes the corresponding job, populates
the identity/enrichment tables, and records a **success** run in `automation_runs`.

---

## Files involved

### New files
| File | Purpose |
|---|---|
| `server/services/systemTaskRunner.ts` | `SYSTEM_TASKS` registry mapping `system:*` taskId → job invocation; resolves active providers by type and runs the job |
| `server/__tests__/services/systemTaskRunner.test.ts` | Dispatch + provider-resolution + no-op-on-absent-provider behaviour |

### Modified files
| File | Action |
|---|---|
| `server/services/automationExecutor.ts` | Branch at the top of `execute()`: `kind==='system'` → `systemTaskRunner.run(taskId)`; keep `recordResult` shared |
| `server/container.ts` | Register `identityResolutionJob`, `enrichmentJob`, `systemTaskRunner`; inject `db` + `providerSettingsService` + `providerFactory` |
| `server/services/automationService.ts` | `getById` must expose `kind` (confirm it is selected) |

### Read first (establish the pattern)
| File | Why |
|---|---|
| `server/services/automationExecutor.ts` | Existing `execute()` / `recordResult` / `RADARR_TASKS` pattern to mirror |
| `server/jobs/identityResolutionJob.ts`, `server/jobs/enrichmentJob.ts` | Job `Deps` shapes; each branch no-ops when its provider dep is absent |
| `server/modules/media/media.handler.ts` | `providerSettingsService.findActiveByTypes` + `providerFactory.create` is the provider-resolution pattern to reuse |
| `server/container.ts` | Awilix `asClass(...).singleton()` registration style |

---

## Decisions binding this phase

- **D1** — hybrid dispatch; the executor stays the single entry; `automation_runs` recording is shared.
- Provider resolution: per **D8 / Phase 0** there is at most one active provider per type, so the
  runner resolves **the single active provider** of each required type (no per-instance iteration,
  no aggregation). `system:identity-resolution` → `runForMovies`/`runForSeries`/`runForPlex` with the
  active Radarr/Sonarr/Plex (+ tvMaze lookup). `system:enrichment` → `EnrichmentJob.run()` with the
  active Tautulli/Overseerr/Plex/TMDB providers.
- Jobs already guard absent deps (`if (!this.deps.plexProvider) return`), so a missing provider type
  is a no-op, not an error.

---

## Steps (TDD — one behaviour per cycle)

### 1.1 — `SystemTaskRunner` dispatches a known task to its job
RED: given a `system:identity-resolution` taskId, the runner invokes the identity job.
GREEN: `SYSTEM_TASKS` registry + `run(taskId)` lookup; unknown taskId throws
`Task "<id>" is not yet implemented` (mirror executor's existing message).

### 1.2 — Runner resolves active providers by type and constructs job deps
RED: the active Radarr provider is resolved and `runForMovies` invoked; with no active Plex,
`runForPlex` is not called and nothing throws.
GREEN: resolve the single active provider per type via `providerSettingsService.findActiveByTypes`
+ `providerFactory.create`; pass only the deps that resolved. (Phase 0 guarantees at most one per type.)

### 1.3 — `execute()` branches on `kind` and shares run recording
RED: executing a `kind='system'` automation runs the system task and records a **success**
`automation_runs` row with `kind='system'`; it does **not** hit the provider/querySource path and
does **not** throw "has no provider".
GREEN: one branch at the top of `execute()`; on success/error route through the existing
`recordResult`.

### 1.4 — DI wiring
RED (integration): resolving `automationExecutor` from the container and executing the seeded
`system:enrichment` automation writes/updates `media_enrichment` rows.
GREEN: register jobs + runner in `container.ts`.

### 1.5 — Regression
Existing user-automation execution tests stay green (the new branch is only taken for `kind='system'`).

---

## Verification gates (acceptance criteria)

- [ ] Executing `system:identity-resolution` populates `media_identity` for active Radarr/Sonarr items (verified against a seeded test DB + mock providers).
- [ ] Executing `system:enrichment` populates `media_enrichment` (overseerr/tmdb/play fields) for resolved identities.
- [ ] Both record a `automation_runs` row with `status='success'`, `kind='system'` — **no** "has no provider" error run.
- [ ] An unknown `system:*` taskId fails with the standard "not yet implemented" error, not a crash.
- [ ] Absent provider type → that job branch no-ops; the run still succeeds.
- [ ] Full server suite green: `yarn vitest run --project server`.
- [ ] Manual smoke: with providers configured, trigger the system automation (Phase 3 button, or a temporary script) and observe non-empty `media_identity` / `media_enrichment`.

---

## Risks

- **Long runs.** Identity resolution paces tvMaze lookups (500ms). A full run may take minutes — fine
  for cron, and Phase 3's Run-now is async, but keep job invocations off any request thread.
- **Depends on Phase 0.** The single-provider resolution assumes the Phase 0 invariant holds; if Phase 0
  is skipped, two active providers of a type would silently mean only one is honoured.
