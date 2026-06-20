# Phase 2 prompt — Actuator role & task manifest

Invocation: `tdd docs/in_progress/phase-2-prompt.md docs/in_progress/phase-2-actuator-role-and-task-manifest.md`

Read `AGENT_BRIEF.md` first, then the cycle doc and
`docs/intent/system-roles-and-capabilities.md` (the model) +
`docs/architecture/task-execution-and-actuator-gap.md` (the as-built gap you close). Depends on Phase 1
(resolution already out of the executor).

## The seams (verified)
- **Existing dispatch to fold into the manifest** — `server/services/automationExecutor.ts` (~L246–273):
  `RadarrTask`/`SonarrTask = { run, affects?: 'media' }`, `RADARR_TASKS`/`SONARR_TASKS` (run fns call
  `provider.unmonitorMovies`/`triggerMoviesSearch` etc.), and `SYSTEM_TASKS`
  (`system:enrichment`, `system:identity-resolution`).
- **Client shape to converge on** — `src/lib/provider-registry.ts`: `TaskDef = { id, label,
  description?, destructive }`. The server manifest unifies this with the executor's `{ run, affects }`
  into one `TaskDescriptor { id, label, destructive, affects?, run }`, keyed by `MetadataProviderType`
  (`server/database/schema.ts` ~L13).
- **Validation seam** — `server/modules/automations/automations.schemas.ts` (~L41) `taskId:
  z.string().min(1)`. Tighten to validate against `manifest(boundProviderType)`.
- **Manifest endpoint** — add under `server/modules/providers/` (it already serves `/metadata`,
  `/ratings`); suggested `GET /api/providers/tasks`. Confirm placement via graphify.

## Refactor-under-guard cycles
**Cycle 1 REFACTOR** (executor dispatches via the manifest; delete standalone `RADARR_TASKS`/
`SONARR_TASKS`) and **Cycle 2 REFACTOR** (introduce role interfaces; `implements` on concretes) are
structural — guarded by existing executor tests. The genuine RED targets are the manifest contents
(1, 2, 5), create validation (3, 4), and the endpoint (6).

## Traps
- **`SYSTEM_TASKS` are internal jobs, not provider actuator tasks** — keep them separate; the manifest is
  the provider/actuator surface (what an automation bound to a provider may run).
- Role interfaces (`MediaSource`/`MetadataEnricher`/`MediaActuator`) are mostly type-level; their
  **observable proof is the manifest** — an enricher-only type (TMDB) yields an empty task list. Don't
  try to RED a TypeScript `implements` clause directly.
- `BaseMetadataProvider` is a connection/HTTP base, not a metadata contract — rename it as part of the
  role work, but that's a REFACTOR, not a behaviour.
- Do **not** change the client (Phase 3) — only serve the manifest.

## Done when
Per the spec: the manifest is the single server declaration of actuator tasks; the executor dispatches
from it; enricher-only types expose none; an unrunnable `taskId` cannot persist; the manifest is served
for Phase 3.
</content>
