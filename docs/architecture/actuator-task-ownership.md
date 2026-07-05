# MediaActuator task ownership (as-built)

**Status:** AS-BUILT (current fact) — server. Why the actuator half of the system-roles model is shaped the
way the code is. Detailed spec of the **MediaActuator** role under the umbrella
`docs/intent/system-roles-and-capabilities.md`; siblings are `docs/architecture/media-enricher-role.md`
(MediaEnricher) and `docs/intent/provider-source-model.md` (MediaSource). The deferred parameter-carrying
follow-up is `docs/intent/actuator-task-parameters.md`.

## The role owns its tasks

A **MediaActuator** is a configured system that exposes actions on media it can address. It is the **sole
authority for what actuator tasks exist**: a configured instance declares its own tasks, each carrying a
runner bound to that instance. A system without the role has no tasks, by construction — which is why a
non-actuator can never be offered one.

```ts
// server/providers/roles.ts
interface ActuatorTaskDescriptor { id: string; label: string; destructive: boolean; affects?: 'media'; }
interface ActuatorTask extends ActuatorTaskDescriptor { run(ids: number[]): Promise<void>; }
interface MediaActuator { readonly actuatorType: MetadataProviderType; tasks(): ActuatorTask[]; }
```

A task has two shapes, one extending the other, so projecting the transport shape from the execution shape
is lossless rather than "the full shape with `run` silently dropped by serialization":

- **`ActuatorTaskDescriptor`** — pure data; the transport and discovery shape; serializes complete.
- **`ActuatorTask`** — the descriptor plus a runner **bound to the concrete instance** (`run: (ids) =>
  this.unmonitorMovies(ids)`). The execution shape; no cast.

Discovery reads the descriptor off the task; the executor reads the runner. Both are derived from the role
instance, so the question "what tasks does this system have" has exactly one answer and one source.

## The whole vocabulary is modelled, as parameterless tasks

The full intended actuator surface is declared now — not only what executes today — so the design is proven
across every system at once rather than one provider at a time.

- **Radarr / Sonarr** own their full sets. Runnable today: Radarr `unmonitorMovie` / `triggerSearch` /
  `deleteMovieWithFiles`; Sonarr `unmonitorSeries` / `triggerSearch` / `deleteSeriesWithFiles`.
- **Plex, Jellyfin, Tautulli** declare `MediaActuator` and own modelled-only sets (delete / refresh / mark
  / notify / …).
- An action not yet wired is a **modelled task**: a first-class task in the right shape whose `run(ids)`
  throws via the shared `modelledRun(taskId)`. It is **parameterless**; tasks that will eventually need a
  target (`changeQualityProfile`, `addTag`, `removeTag`) are modelled parameterless until
  `docs/intent/actuator-task-parameters.md` lands.

"Declared ⇒ has a run binding, possibly a stub." Honesty is kept by the explicit throw and by enablement
defaulting off, so a modelled task is never reached by accident.

## Availability is per configured instance, gated by per-instance enablement

Discovery and enforcement are **instance-keyed**, not type-keyed, because two instances of one type can
legitimately differ — a 4K Radarr may enable `deleteMovieWithFiles` while a 1080p Radarr withholds it.

- **Enablement is per instance**, held in `provider.settings.enabledTasks` and read by the single pure
  authority `readEnabledTaskIds(settings)` ([`server/providers/taskEnablement.ts`](ref:path:server/providers/taskEnablement.ts)).
- **Default disabled.** A newly configured instance enables no tasks until chosen.
- **Enforced at two boundaries, not the UI:** `automationService.create` rejects a `taskId` not enabled on
  *that instance*; `AutomationExecutor` refuses (before any provider HTTP call) a task not enabled on the
  instance at run time. Disabled ⇒ neither creatable nor executable.

One shape serves both consumers: the settings surface lists all of an instance's tasks with their `enabled`
state to toggle; the builder offers the enabled subset.

## Discovery: `GET /api/providers/tasks` is instance-keyed

[`server/modules/providers/providers.handler.ts`](ref:path:server/modules/providers/providers.handler.ts) returns, per configured provider instance that plays
`MediaActuator`:

```ts
Array<{ providerId: number; type: MetadataProviderType; tasks: Array<ActuatorTaskDescriptor & { enabled: boolean }> }>
```

It lists configured providers, constructs each via `ProviderFactory`, keeps those for which
`isMediaActuator(instance)` holds, and projects each instance's `tasks()` to descriptors tagged `enabled`.
Non-actuators and non-constructable types emit nothing — the surface advertises only what some configured
instance can actually do.

## The executor dispatches through the instance

`AutomationExecutor` binds the specific provider instance by `automation.provider.id`, resolves the task by
`source.tasks().find(t => t.id === taskId)`, enforces enablement via
`readEnabledTaskIds(providerSettings.settings)`, evaluates the query, and calls `task.run(ids)` — the runner
already bound to the instance. `task.affects` drives the `media:changed` event. `SYSTEM_TASKS`
(`system:enrichment`, `system:identity-resolution`) are separate: internal jobs run via `SystemTaskRunner`,
not actuator tasks, and absent from the discovery surface.

## How it is wired

- [`server/providers/roles.ts`](ref:path:server/providers/roles.ts) — `MediaActuator` / `ActuatorTask` / `ActuatorTaskDescriptor` contracts,
  `modelledRun`, `isMediaActuator`.
- `RadarrProvider`, `SonarrProvider` — `tasks()` with real (instance-bound) + modelled tasks.
- `PlexProvider`, `JellyfinProvider`, `TautulliProvider` — `implements MediaActuator`, modelled-only `tasks()`.
- [`server/providers/taskEnablement.ts`](ref:path:server/providers/taskEnablement.ts) — `readEnabledTaskIds`, the one authority both create and the
  executor consult.
- [`server/providers/providerFactory.ts`](ref:path:server/providers/providerFactory.ts) — constructs every configured type so discovery can ask any
  instance for its role.
- [`server/services/automationService.ts`](ref:path:server/services/automationService.ts), [`automationExecutor.ts`](ref:path:server/services/automationExecutor.ts) — create-time and run-time enablement.
- [`server/modules/providers/providers.handler.ts`](ref:path:server/modules/providers/providers.handler.ts) — instance-keyed discovery.

## The open issue this modelling unearthed

`AutomationExecutor` derives target ids by evaluating the automation's query against the provider instance
**as a `MediaSource`**, then runs the actuator task on that same instance — conflating source and actuator.
A modelled actuator that is **not** a source (Plex/Jellyfin/Tautulli) has no valid id-derivation path:
acting on media it does not own requires resolving ids across the identity graph. Pure-actuator execution
is therefore out of scope while modelled tasks default disabled; this conflation must be resolved before
any non-source actuator can run.

## The client derives, holds no catalogue

The client reads the instance-keyed `GET /api/providers/tasks` and holds no task catalogue of its own.
`useProviderTasks` ([`src/hooks/useProviderTasks.ts`](ref:path:src/hooks/useProviderTasks.ts)) fetches the instance-keyed availability; the builder
([`src/components/AutomationBuilder`](ref:path:src/components/AutomationBuilder/index.tsx)) offers each configured instance's **enabled** tasks, joining the
instance name from settings; [`ProviderCard`](ref:path:src/components/ProviderCard/index.tsx) lists an instance's tasks with their server `enabled` state to
toggle (default off — the old client default-on heuristic is gone). The hand-maintained catalogue is
retired: `src/lib/tasks.ts` is deleted and the `tasks` surface removed from [`src/lib/provider-registry.ts`](ref:path:src/lib/provider-registry.ts),
so nothing client-side declares what tasks exist. The JSON-honest descriptor carries no `description`, so
the UI does not show one.
