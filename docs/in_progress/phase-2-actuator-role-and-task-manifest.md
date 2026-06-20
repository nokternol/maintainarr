# Phase 2 — Actuator role & server task manifest

**Status:** IN PROGRESS — **Phase 2** of the System-Roles & MediaQueryEngine Heal (see `README.md`).
TDD (backend). **Depends on:** Phase 1 (resolution is out of the executor; task dispatch is its
remaining concern). Realises the actuator role in `docs/intent/system-roles-and-capabilities.md` and
closes `docs/architecture/task-execution-and-actuator-gap.md`.

## Observable value

The server owns what tasks exist, and that ownership is enforced:

- **Manifest:** a server-side task manifest returns an owner type's actuator tasks with their
  descriptors (`id`, `label`, `destructive`, `affects`) — e.g. RADARR → `unmonitorMovie`,
  `triggerSearch`.
- **Role honesty:** an enricher-only type (TMDB) has an **empty** task list — the actuator
  false-equality is gone, asserted directly.
- **Rejection:** creating an automation whose `taskId` is not in its bound provider's manifest is
  **rejected** (validation error), instead of persisting and throwing at run time.
- **Exposure:** `GET` returns the manifest so the client can derive its catalogue (consumed in Phase 3).

## Problem

Task vocabulary is defined twice and unenforced: the client `provider-registry.ts` advertises ~30 tasks
across all systems; the executor implements 3 (`RADARR_TASKS`/`SONARR_TASKS`) + 2 system jobs; create
validates `taskId: z.string().min(1)`. Tasks are duck-typed onto every "provider" though only the
actuator role can act. Result: a user can persist a `destructive` task that fails with `Task "…" is not
yet implemented`.

## Design

- **Roles as interfaces.** Declare `MediaSource` / `MetadataEnricher` / `MediaActuator`; concrete
  providers `implements` the ones they hold (`RadarrProvider` all three; `TmdbProvider`
  `MetadataEnricher` only). `BaseMetadataProvider` is renamed to reflect that it is a connection/HTTP
  base, not a metadata contract. (Structural; lands in REFACTOR — its observable proof is the manifest.)
- **Task manifest = the actuator declaration.** A server map keyed by `MetadataProviderType` →
  `TaskDescriptor { id, label, destructive, affects?: 'media', run }`. It is the single source the
  executor dispatches from (the existing `RADARR_TASKS`/`SONARR_TASKS` `run` fns move under it) **and**
  the shape served to the client. A type with no actuator role contributes no entry.
- **Validation seam.** Automation create/update validates `taskId ∈ manifest(boundProviderType)`.

## Mocking

| Mock target | Boundary / Internal | Justification |
|---|---|---|
| provider instances / HTTP | Boundary | task `run` fns call external APIs; not under test here |
| DB (automation persistence) | Boundary | integration cycles use the real test DB per existing pattern |
| task manifest | Internal | the declaration under test; never mocked |

## TDD cycles

1. **Tracer — manifest lists an owner's tasks.** RED: `taskManifest('RADARR')` returns descriptors
   including `unmonitorMovie` and `triggerSearch`, each with `destructive` and `affects`. No manifest →
   fails. GREEN: build the map from the existing dispatch entries. REFACTOR: the executor dispatches via
   the manifest; delete the standalone `RADARR_TASKS`/`SONARR_TASKS` once executor tests stay green.
2. **Enricher-only type has no tasks.** RED: `taskManifest('TMDB')` is empty. GREEN: only owner/actuator
   types contribute entries. REFACTOR: introduce the role interfaces; `implements` on concretes.
3. **Reject an unrunnable `taskId` on create.** RED: `POST /api/automations` with a `taskId` absent from
   the bound provider's manifest returns a validation error (not 2xx). Today `min(1)` accepts it → fails.
   GREEN: validate `taskId` against `manifest(providerType)`. REFACTOR.
4. **Accept a manifest `taskId` on create.** RED: a `POST` with `taskId: 'unmonitorMovie'` for a RADARR
   provider succeeds and persists. GREEN: ensure the validator admits manifest ids. REFACTOR.
5. **`destructive` survives to the descriptor.** RED: the manifest entry for a delete task reports
   `destructive: true` (guards the field the UI confirmation will read in Phase 3). GREEN: carry the
   flag. REFACTOR.
6. **Expose the manifest.** RED: `GET /api/providers/tasks` (integration) returns the per-type manifest
   shape. GREEN: handler returns `taskManifest`. REFACTOR.

## Gates

- `yarn test` (vitest) — existing `automationExecutor`, automation create/integration, and dispatch
  tests must stay green.
- `yarn typecheck:server`, `yarn lint`.

## Done when

The manifest is the single server-side declaration of actuator tasks; the executor dispatches from it;
enricher-only types expose no tasks; an unrunnable `taskId` cannot be persisted; and the manifest is
served for the client to consume in Phase 3.
</content>
