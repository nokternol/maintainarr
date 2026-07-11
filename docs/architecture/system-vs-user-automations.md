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
startup health check ([`server/modules/system/systemHealthCheck.ts`](ref:path:server/modules/system/systemHealthCheck.ts)) upserts them on every boot.
If a container restarts and a system job is missing, it is restored automatically.

Current system automations (added in Phase 2):
- **Identity Resolution Job** — maps Radarr/Sonarr items to cross-provider IDs
- **Enrichment Job** — fetches Tier 2 provider data for enriched filter predicates

Both are prerequisites for Tier 2 filter predicates to return meaningful results.

## Enforcement

`kind TEXT NOT NULL DEFAULT 'user'` is carried on both the `automations` and `automation_runs`
tables (`server/database/schema.ts:153,204`).

- `DELETE /api/automations/:id` and `PATCH /api/automations/:id/status` both reject `kind = 'system'`
  (`automationService.ts`'s `assertMutable` check).
- `GET /api/automations` is filterable by `kind` (`automationService.list({ kind })`).

## UI placement

- **Main dashboard / Automations** — user automations, fully configurable, run history,
  Run Now + Disable + Archive.
- **System → Tasks** — system automations. Read-only **except Run Now** — the one operator action
  permitted on a system task (schedule, last run, next run, run history, plus on-demand execution).
  Makes system health observable and operable without console access.

The verb model is Run Now / Disable / Archive — never Play/Pause, which would imply runtime control
over an executing process.
