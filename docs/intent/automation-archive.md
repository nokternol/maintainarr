# Automation Archive & Restore (Soft Delete)

**Status:** INTENT — not yet built. Independent of the event bus; can slot any time.

## Model: archive + manual purge

Delete becomes **Archive** (soft, restorable). A permanent delete survives but is demoted to a
deliberate two-step from the Archived view. Nothing is auto-purged.

- **`automations.archivedAt`** — nullable timestamp. The presence of a value = archived.
- **Archive** sets `archivedAt` and **unschedules** the automation (same scheduler effect delete has
  today).
- **Restore** clears `archivedAt` and **reschedules iff `status='active'`** (mirrors the existing
  `updateStatus` scheduling logic); a disabled automation restores to disabled (unscheduled).
- **Archived automations are inert:** unscheduled, and `POST /:id/run` is **rejected** — to run one,
  restore it first.
- **System automations cannot be archived** (invariants — consistent with their Run-Now-only model).
- **Run history is retained** for archived automations (audit; `automation_runs` already keys on
  `automationId`).
- **No auto-purge in v1.** Manual purge only; revisit a retention window only if the table actually
  bloats. (Auto-purge would silently destroy recoverable data on a timer.)

## API

- `POST /api/automations/:id/archive` — set `archivedAt`, unschedule.
- `POST /api/automations/:id/restore` — clear `archivedAt`, reschedule iff active.
- `GET /api/automations?archived=true` — list archived (default excludes archived; composes with the
  existing `kind` param).
- `DELETE /api/automations/:id` — hard delete, **rejected unless already archived.**

### The enforced two-step

`DELETE` rejecting non-archived automations is what makes archive-before-delete an **invariant**, not
a UI convention — an API client cannot hard-delete a live automation in one call. This is a
**behaviour change to an existing endpoint**: today the dashboard trash button (and tests) hard-delete
directly; they must be rewired to archive first, with permanent delete moved to the Archived view.

## UI surface

Archived items appear via a **filter/section on the Automations screen** (`?archived=true`), not a
dedicated route — archive applies to user automations only, so it lives where they do. The Archived
view offers **Restore** and **Delete permanently**. A separate `/automations/archived` route was
considered and rejected as heavier than warranted for current archive volumes.

## Verb alignment

This is the **Archive** verb from `automation-verbs-and-separation.md` (archive icon, not a bare
trash). The destructive control on a user `AutomationRow` becomes Archive; permanent Delete lives only
in the Archived view.
