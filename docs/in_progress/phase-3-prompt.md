# Phase 3 prompt — Client task source-of-truth inversion

Invocation: `tdd docs/in_progress/phase-3-prompt.md docs/in_progress/phase-3-client-task-source-of-truth.md`

Read `AGENT_BRIEF.md` first, then the cycle doc and
`docs/intent/system-roles-and-capabilities.md`. Depends on Phase 2 (the `GET /api/providers/tasks`
manifest endpoint must exist).

## The seams (verified)
- **Consumer to rewire** — `src/components/AutomationBuilder/index.tsx` (~395 lines): sources tasks via
  `getEnabledTasksForProvider` from `@app/lib/tasks`, over the hardcoded `PROVIDER_REGISTRY` in
  `src/lib/provider-registry.ts` (~281 lines) / `src/lib/tasks.ts`.
- Other registry consumers: `src/components/ProviderCard/index.tsx`, `src/pages/settings/index.tsx`.
- **New hook** — `useProviderTasks` (SWR) fetching the Phase 2 manifest; mock it with MSW in tests.
- Providers persist an **enabled-task subset** (`enabledIds`) — preserve that behaviour; you're changing
  the *source* of the task list, not whether tasks can be enabled/disabled.

## Scope (don't over-reach)
- **In:** the `tasks` axis only — replace the hardcoded catalogue with the manifest; rewire builder +
  settings enabled-tasks surface.
- **Keep (client display config):** `label`/`group`/`order`/`apiSuffix`/`defaultUrl`/
  `filterCapabilities` on `ProviderEntry`. Migrating those is a separate later inversion.
- Do **not** touch the query/filter view (Phase 4).

## Refactor-under-guard cycle
**Cycle 5** (delete the hardcoded `tasks` from `provider-registry.ts`/`tasks.ts`) is guarded by builder +
settings tests staying green. Cycles 1–4 are genuine RED against a mocked manifest.

## Visual pass
After hook logic is green, run the builder task selection (list, destructive confirm, enricher-only empty
state) through `impeccable` — **Ladle story first**, per `CLAUDE.md`. Stop the Ladle/dev server when
done.

## Done when
Per the spec: tasks render from the server manifest only; the hardcoded catalogue is deleted; the builder
shows nothing for an enricher-only provider and exactly the manifest set for an owner.
</content>
