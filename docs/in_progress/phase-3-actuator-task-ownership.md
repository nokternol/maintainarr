# Phase 3 — Actuator task ownership, then client derivation (server-first)

**Status:** IN PROGRESS — **Stage 1 (server) complete**; Stage 2 (client derivation + visual pass) outstanding.
Implementation plan realising the **MediaActuator** task-ownership model. Stage 1 (server) is now as-built
in `docs/architecture/actuator-task-ownership.md`.

**Stage 1 delivered:** `MediaActuator.tasks()` owns the task surface (`ActuatorTask` =
`ActuatorTaskDescriptor & { run(ids) }`, runner bound to the instance, no cast); Radarr/Sonarr carry real +
modelled tasks, Plex/Jellyfin/Tautulli carry modelled-only sets (`run` throws via `modelledRun`); the
type-keyed `taskManifest`/`publicTaskManifest` table is **deleted**; per-instance enablement
(`settings.enabledTasks`, default off) is enforced at `automationService.create` **and** executor run via
the shared `readEnabledTaskIds`; `GET /api/providers/tasks` returns instance-keyed availability
(`{ providerId, type, tasks: [{…descriptor, enabled}] }`), non-actuators absent.

**This replaces the earlier client-first Phase 3.** That version inverted the *client* onto the Phase 2
server manifest, assuming that manifest was the whole, correct task truth. It is not: the manifest is a
type-keyed const table (`server/services/taskManifest.ts`) **detached** from the `MediaActuator` role —
the same two-designs-for-one-process fracture `MediaEnricher.enrich()` closed for `EnrichmentContribution`.
The actuator task model must be **replaced** (role owns its tasks) before any client can honestly derive
from it. So Phase 3 is server-first; the client derivation is its second stage, not a separate phase.

## Why the earlier framing was wrong

The program assumed "server role model cohesive after P2.5". P2.5 closed only the **enricher** role. The
**actuator** role (`server/providers/roles.ts`) still carries nothing but `actuatorType`; the task
vocabulary lives in a detached type-keyed table whose `run` closures cast `provider as RadarrProvider`.
Nothing ties a table key to an actuator, an actuator to entries, or a `run` cast to a real method — so
non-actuators could be (and were) handed tasks. The client cannot derive a correct catalogue from an
incorrect source. Fix the source first.

## Stage 1 — the role owns its tasks (server)

Target model in full (now as-built): `docs/architecture/actuator-task-ownership.md`. In short:

- `MediaActuator` exposes `tasks(): ActuatorTask[]`. `ActuatorTask = ActuatorTaskDescriptor & { run(ids) }`,
  `run` a bound method on the concrete provider — no cast. `ActuatorTaskDescriptor`
  (`{ id, label, destructive, affects? }`) is the lossless, JSON-honest transport projection.
- The type-keyed `taskManifest`/`publicTaskManifest` table is **deleted**; nothing but a configured
  `MediaActuator` instance declares a task.
- **Model the whole vocabulary** as *parameterless* tasks: Plex/Jellyfin/Tautulli declare `MediaActuator`;
  Radarr/Sonarr carry their full sets. Runnable today: Radarr `unmonitorMovie`/`triggerSearch`/
  `deleteMovieWithFiles`, Sonarr equivalents. Everything else is a **modelled task** whose `run(ids)`
  throws "not yet implemented", disabled by default. Parameter injection
  (`changeQualityProfile`/`addTag`/`removeTag` targets) is out — `docs/intent/actuator-task-parameters.md`.
- **Discovery is instance-keyed:** the server returns, per configured actuator instance,
  `{ providerId, type, tasks: Array<ActuatorTaskDescriptor & { enabled }> }`. Non-actuators absent. This
  replaces the type-keyed `GET /api/providers/tasks`.
- **Enablement is per instance, default off, enforced server-side:** `provider.settings.enabledTasks` per
  instance (a 4K Radarr may enable delete while a 1080p one does not); `automationService.create` rejects a
  `taskId` not enabled on *that instance*; the executor refuses to run one disabled on the instance at run
  time. The current builder-only filter is not enforcement.

### Server seams

| File | Role |
|---|---|
| `server/providers/roles.ts` | `MediaActuator` gains the task surface. Mirror `MediaEnricher`. |
| `server/services/taskManifest.ts` | Type-keyed table to retire; `run`/`affects`/`destructive` move onto providers. |
| `server/providers/radarrProvider.ts`, `sonarrProvider.ts` | Already `implements MediaActuator`; gain `tasks()` (real + modelled). |
| `server/providers/plexProvider.ts`, `jellyfinProvider.ts`, `tautulliProvider.ts` | Gain `MediaActuator` + modelled `tasks()`. Confirm each class's current roles first. |
| `server/services/automationExecutor.ts` (~147) | Dispatch via the instance's `tasks()`; enforce enablement at run. |
| `server/services/automationService.ts` (~257) | Create-validation against the instance's enabled set, not the type vocabulary. |
| `server/modules/providers/providers.handler.ts` + routes | `GET /api/providers/tasks` → instance-keyed availability; needs `providerSettingsService` + factory. |
| `server/jobs/enrichmentJob.ts` + `roles.ts` (`MediaEnricher`) | The precedent: behavioral role over configured instances, no table. |

### The flaw Stage 1 surfaces (design it, don't trip over it)

The executor derives target ids by evaluating the query against the instance **as a `MediaSource`**, then
runs the actuator task on the same instance — conflating source and actuator. A modelled actuator that is
not a source (Plex/Jellyfin/Tautulli) has no id-derivation path. Out of scope here (modelled tasks
disabled), but it must be resolved before any non-source actuator can run.

## Stage 2 — the client derives (folds in the old Phase 3 goal, corrected)

Only after Stage 1 is the server truth whole. Then invert the client — the *goal* the earlier Phase 3 had
right, the *source* it had wrong:

- `useProviderTasks` fetches the **instance-keyed availability** (Stage 1's shape), not a type-keyed
  manifest.
- The builder (`src/components/AutomationBuilder/index.tsx`) offers each configured instance's **enabled**
  tasks; the settings surface (`src/components/ProviderCard/index.tsx`) lists all of an instance's tasks
  with their `enabled` state to toggle.
- Delete the hardcoded client catalogue (`src/lib/provider-registry.ts` `tasks`, `src/lib/tasks.ts`):
  nothing client-side declares what tasks exist.
- Visual pass via `impeccable` (Ladle story first, per `CLAUDE.md`) **after** the hook logic is green —
  builder task list, destructive confirm, enricher/empty states, and the disabled-by-default state.

## Gates

`yarn test` (server + client), `yarn typecheck:server`, `yarn typecheck:client`, `yarn lint`. Unit-test at
boundaries (provider HTTP / `ProviderFactory`, DB); never mock internal domain. New services register in
`server/container.ts` and inject via the cradle.

## Done when

Nothing but a configured `MediaActuator` instance declares a task; discovery is per configured instance;
enablement is per instance, default off, enforced at create and execution; the type-keyed `taskManifest`
table is gone; the client derives from the instance-keyed API and holds no catalogue of its own. The
server half is shipped and recorded in `docs/architecture/actuator-task-ownership.md`; this plan is
retired when Stage 2 (client) lands.
