# System vs User Automations

## The distinction

Warden has two flavours of automation, both stored in the `automations` table and scheduled
by the same underlying infrastructure, distinguished by a `kind` column.

| | System | User |
|---|---|---|
| `kind` | `'system'` | `'user'` |
| Created by | Application startup (health check upsert) | User via UI |
| Editable | No — schedule and task are fixed by the application | Yes — fully configurable |
| Deletable via API | No | Yes |
| Visible in UI | System panel (settings/system) | Main dashboard |
| Schedule source | Hardcoded default, upserted at startup | User-defined, stored in DB |
| Purpose | Infrastructure that makes user automations possible | The reason the application exists |

## Why same table

System and user automations share the same mechanisms: they are scheduled by
`AutomationScheduler`, executed by `AutomationExecutor`, and their runs recorded in
`automation_runs`. A `kind` column is the minimal change to preserve this while enabling
correct visibility and access control.

Separate tables would duplicate the run-recording pattern and create parallel service
infrastructure for what is fundamentally the same operation with different ownership.

## System automations

System automations are invariants — they must always exist for Warden to function. The
startup health check (`server/health/systemHealthCheck.ts`) upserts them on every boot.
If a container restarts and a system job is missing, it is restored automatically.

Current system automations (added in Phase 2):
- **Identity Resolution Job** — maps Radarr/Sonarr items to cross-provider IDs
- **Enrichment Job** — fetches Tier 2 provider data for enriched filter predicates

Both are prerequisites for Tier 2 filter predicates to return meaningful results.

## Schema change required

Add `kind TEXT NOT NULL DEFAULT 'user'` to the `automations` table.
Add `kind TEXT NOT NULL DEFAULT 'user'` to the `automation_runs` table (or derive via join).

API routes must enforce:
- `DELETE /api/automations/:id` — reject if `kind = 'system'`
- `PATCH /api/automations/:id/status` — reject if `kind = 'system'`
- `GET /api/automations` — filterable by `kind`

## UI placement

- **Main dashboard / Automations** — user automations, fully configurable, run history,
  Run Now + Disable + Archive.
- **System → Tasks** — system automations. Read-only **except Run Now** — schedule, last run,
  next run, run history, plus on-demand execution. Makes system health observable and operable
  without console access.

> The verb model (Run Now / Disable / Archive — not Play/Pause) and the rule that system tasks are
> Run-Now-only are detailed in `automation-verbs-and-separation.md`. That supersedes the bare
> "read-only" wording above: Run Now is the one operator action permitted on a system task.
