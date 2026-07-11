# Parameterised actuator tasks (intent)

**Status:** INTENT (not built). Future state for actuator tasks that require a *target* argument. Depends
on `MediaActuator` owning its tasks via `ActuatorTask.run(ids)` — shipped, as-built:
`docs/architecture/actuator-task-ownership.md`.

## The gap

Some actuator tasks are not fully specified by `(instance, ids)`. They need a per-task **parameter**:

| Task (Radarr/Sonarr) | Missing parameter |
|---|---|
| `changeQualityProfile` | which quality profile (`qualityProfileId`) |
| `addTag` / `removeTag` | which tag (`tagId` / label) |

Today these are **modelled tasks** — declared in the right shape but with a parameterless
`run(ids)` that throws "not yet implemented" (`modelledRun`, `server/modules/providers/roles.ts`). They
prove discovery and enablement; they cannot perform the action because `run(ids)` has nowhere to carry
the target.

## What this needs (unbuilt)

- A parameter contract on `ActuatorTask` — the task declares the shape of the argument it requires (e.g. a
  typed parameter descriptor), and `run` accepts it alongside `ids`.
- A place to **supply** the parameter. The natural home is the automation: an automation binds
  `providerId` + `taskId` today; a parameterised task also binds its argument value, validated at create
  against the live target list (profiles/tags fetched from the instance).
- Client capture in the builder: when a selected task declares a parameter, the builder collects it
  (a profile/tag picker sourced from the instance's metadata).
- Create-time and execution validation that the supplied argument is still valid for the instance.

## Why deferred

The parameter model touches the `ActuatorTask` contract, the automation schema, create-validation, the
executor dispatch, and the client builder at once — a coherent change of its own. The shipped role/
ownership model deliberately kept `run(ids)`-only so that fracture closed without dragging the parameter
model in. When built, the modelled `changeQualityProfile`/`addTag`/`removeTag` stubs become real,
parameter-carrying tasks.
