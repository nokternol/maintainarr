# Actuator task ownership — the MediaActuator role owns its tasks (intent)

**Status:** INTENT (target model, not built). Detailed spec of the **MediaActuator** task surface under the
umbrella `docs/intent/system-roles-and-capabilities.md`. Sibling of the **MediaEnricher** as-built
(`docs/architecture/media-enricher-role.md`), which closed the *same* class of fracture. The
parameter-carrying follow-up is `docs/intent/actuator-task-parameters.md`.

## The fracture to close

Actuator tasks are modelled twice for one process:

- A type-keyed const table, `server/services/taskManifest.ts` — `MetadataProviderType → TaskDescriptor[]`,
  each descriptor carrying `id`/`label`/`destructive`/`affects` **and** a `run` closure that casts
  `provider as RadarrProvider`.
- The `MediaActuator` role (`server/providers/roles.ts`), which today carries only `actuatorType`.

The table is detached from the role: nothing makes a table key an actuator, an actuator have entries, or a
`run` cast match a real method. That decoupling is what let non-actuators (Plex/Jellyfin/Tautulli) be
handed tasks they cannot run — the precise "advertise what you cannot do" drift the role model exists to
remove.

This is the same shape `MediaEnricher.enrich()` resolved for `EnrichmentContribution`: a behavioral role
contract on the configured instance replaced a detached mapper/table. **The new design replaces the old —
the type-keyed table is retired, not kept alongside.**

## The role owns its tasks (two shapes, one extends the other)

`MediaActuator` exposes `tasks()`. A task has two honest shapes — the second is the first plus its runner,
so projecting one from the other is lossless, never "the full shape with `run` silently dropped by
serialization":

- **`ActuatorTaskDescriptor`** — `{ id, label, destructive, affects? }`. Pure data; the transport and
  discovery shape; serializes complete.
- **`ActuatorTask`** — `ActuatorTaskDescriptor & { run(ids): Promise<void> }`. The descriptor plus a runner
  **bound to the concrete provider instance** (no cast). The execution shape.

Building the discovery surface reads the descriptor off the task; the executor reads the runner. The
type-keyed `taskManifest`/`publicTaskManifest` is deleted; what the client receives is derived from role
instances, not a hand-maintained map.

## Model the whole vocabulary, as parameterless modelled tasks

The full intended actuator surface is declared now — not only what executes today — so the design is
proven across every system at once and flaws surface early.

- **Plex, Jellyfin, Tautulli** declare `MediaActuator` and own their task sets (delete/refresh/mark/…).
- **Radarr, Sonarr** own their full sets. Runnable today: Radarr `unmonitorMovie` / `triggerSearch` /
  `deleteMovieWithFiles`; Sonarr `unmonitorSeries` / `triggerSearch` / `deleteSeriesWithFiles`.
- Every other action is a **modelled task**: a first-class task in the right shape whose `run(ids)` throws
  "not yet implemented". It is **parameterless** — `run(ids)` only. Tasks needing a target
  (`changeQualityProfile`, `addTag`, `removeTag`) are modelled parameterless; the parameter-injection
  requirement is `docs/intent/actuator-task-parameters.md`, not this change.

"Declared ⇒ runnable" weakens to "declared ⇒ has a run binding, possibly a stub". Honesty is preserved by
the explicit throw and by enablement defaulting off (below), so a modelled task is never reachable by
accident.

## Availability is per configured instance, gated by per-instance enablement

Discovery is **instance-keyed**, not type-keyed. The server emits, per configured provider instance that
plays `MediaActuator`: its descriptors, each tagged `enabled`. Non-actuators and unconfigured types emit
nothing.

- **Enablement is per instance**, held in `provider.settings.enabledTasks`. Two instances of one type can
  differ: a 4K Radarr may enable `deleteMovieWithFiles` while a 1080p Radarr withholds it.
- **Default disabled.** A newly configured instance enables no tasks until chosen.
- **Enforced at two boundaries, not the UI:** `automationService.create` rejects a `taskId` not enabled on
  *that instance*; the executor refuses to run a task not enabled on the instance at run time. Disabled ⇒
  neither creatable nor executable. (Today `enabledTasks` is honoured only as a builder filter — that gap
  closes.)

One shape serves both consumers: the settings surface lists all of an instance's tasks with their
`enabled` state to toggle; the builder offers the enabled subset.

## The flaw this modelling unearths (named, not yet fixed)

The executor derives target ids by evaluating the automation's query against the provider instance **as a
`MediaSource`**, then runs the actuator task on that same instance. This conflates source and actuator. A
modelled actuator that is **not** a source (Plex/Jellyfin/Tautulli) has no valid id-derivation path —
acting on media it does not own requires resolving ids across the identity graph. Pure-actuator execution
is therefore out of scope here (modelled tasks are disabled by default); the conflation is the structural
issue to resolve before any non-source actuator can run.

## Vocabulary

- **MediaActuator** — a system that exposes actions on media it can address; the sole authority for what
  actuator tasks exist. A system holds the role only when it declares it.
- **Actuator task** — a named action a MediaActuator can perform; exists only because the instance carries
  the runner backing it.
- **Modelled task** — an actuator task declared in the right shape to model a capability that *should*
  exist, whose `run` is a not-yet-implemented stub; parameterless and disabled by default.
- **Task enablement** — whether a specific configured instance permits a task; per instance, default off,
  enforced at automation-create and execution.

## Relationship to existing docs

- Supersedes `docs/architecture/task-execution-and-actuator-manifest.md` (the as-built type-keyed manifest)
  when implemented — that doc is rewritten to the role-owned model on ship.
- Realises the actuator half of `docs/intent/system-roles-and-capabilities.md`.
- Mirrors `docs/architecture/media-enricher-role.md` as the precedent for retiring a table in favour of a
  behavioral role contract.
