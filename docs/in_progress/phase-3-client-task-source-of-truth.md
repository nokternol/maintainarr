# Phase 3 — Client task source-of-truth inversion

**Status:** IN PROGRESS — **Phase 3** of the System-Roles & MediaQueryEngine Heal (see `README.md`).
TDD (client hooks) + `impeccable` (builder visual). **Depends on:** Phase 2 (manifest endpoint).

## Observable value

The client stops being its own task authority and derives from the server:

- **Derive:** a hook fetches the server task manifest; for a configured provider it yields exactly the
  server's tasks (id, label, destructive) — asserted against a mocked manifest response.
- **No phantom tasks:** the `AutomationBuilder` offers only manifest tasks; an enricher-only provider
  (TMDB) surfaces none — the builder cannot present a task the server can't run.
- **Confirmation honesty:** a `destructive` task (from the manifest flag) renders its confirmation
  affordance.
- **Catalogue deleted:** the hardcoded `tasks` in `src/lib/provider-registry.ts` / `src/lib/tasks.ts`
  are gone; nothing client-side declares what tasks exist.

## Problem

`AutomationBuilder` (`src/components/AutomationBuilder/index.tsx`, 395 lines) sources tasks from
`getEnabledTasksForProvider` over the hardcoded `PROVIDER_REGISTRY` (`provider-registry.ts`, 281 lines) —
never the server. This client catalogue is the drift engine: it advertises tasks the executor cannot run
and must be hand-synced. With Phase 2 serving the manifest, the client must consume it instead.

## Scope

- **In:** the `tasks` axis — replace the client catalogue with the server manifest; rewire the builder
  and the settings "enabled tasks" surface.
- **Out (kept as client display config):** `label` / `group` / `order` / `apiSuffix` / `defaultUrl` /
  `filterCapabilities` on `ProviderEntry`. Migrating those to the server is a later, separate inversion;
  this phase moves only the truth that has a correctness consequence (runnable tasks).

## Mocking

| Mock target | Boundary / Internal | Justification |
|---|---|---|
| manifest `fetch` (MSW) | Boundary | network; drive hook behaviour from fixed responses |
| `AutomationBuilder` rendering | Internal | component under test; rendered, not mocked |
| server manifest contents | Boundary | owned by Phase 2; represented by the mocked response |

## TDD cycles

1. **Tracer — hook returns manifest tasks for a type.** RED: `useProviderTasks` (MSW-mocked manifest)
   exposes RADARR's tasks with `id`/`label`/`destructive`. Hook absent → fails. GREEN: SWR fetch +
   select by type. REFACTOR.
2. **Builder lists only manifest tasks for a configured provider.** RED: with a RADARR provider
   configured and a mocked manifest, the builder renders exactly those task labels — not the old
   hardcoded set. GREEN: source the builder's tasks from the hook. REFACTOR: remove the
   `getEnabledTasksForProvider`/`PROVIDER_TASKS` import.
3. **Enricher-only provider shows no tasks.** RED: a TMDB provider configured → the builder shows the
   empty-tasks state, none offered. GREEN: rely on the (empty) manifest entry. REFACTOR.
4. **Destructive task renders confirmation.** RED: a task with `destructive: true` from the manifest
   renders the confirm affordance; a non-destructive one does not. GREEN: read the flag. REFACTOR.
5. **Catalogue removed.** Regression guard: builder + settings tests stay green with `tasks` deleted
   from `provider-registry.ts` and `tasks.ts`. GREEN: no behaviour change. REFACTOR: delete dead code.

## Visual pass (impeccable, not TDD)

After the hook logic is green, run the `AutomationBuilder` task selection through `impeccable` (Ladle
story first per `CLAUDE.md`): the task list, destructive confirmation, and the enricher-only empty state.

## Gates

- `yarn test` (vitest) — builder and settings tests green; new hook tests green.
- `yarn typecheck:client`, `yarn lint`.

## Done when

The client renders tasks from the server manifest only, the hardcoded task catalogue is deleted, and the
builder cannot offer an unrunnable task — proven by the builder showing nothing for an enricher-only
provider and exactly the manifest set for an owner.
</content>
