---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [06-overseerr-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Overseerr — decision

## Question

Using the Overseerr research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Overseerr's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/overseerr.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/overseerr.md](../specs/overseerr.md) — full e2e spec.

## Resolution

- **Overseerr is the real build target** (the user's live instance today); the shared-implementation
  strategy with Seerr is decided but Seerr itself stays a migration note, not a parallel build — see
  `09-seerr-decision`.
- **New fields in scope**: request audit metadata (`overseerrRequestedAt`, `overseerrRequestedBy`,
  `overseerrModifiedBy`), routing config fields (server/profile/root-folder/language-profile),
  `overseerrRequestId` (task-target only), issue detail (`overseerrIssueType` as a single scalar,
  `overseerrIssueStatus` open/resolved, issue created/modified-by), `overseerrHasComments`
  (presence-only), `overseerrRequestScope` (coarse all/partial, not full per-season detail).
- **Tasks in scope**: approve/decline/retry/delete/update request; resolve/reopen/delete issue; add
  issue comment; override media availability status. Delete-issue-comment dropped — no comment IDs
  are surfaced anywhere to target it.
- **Structural schema gaps raised to the user directly, all deferred as known limitations rather than
  built this pass**: 4K/non-4K request duality (stays collapsed, last-request-wins), issue-type
  breakdown (single-valued, not true multi-type), full per-season detail, full issue-comment records.
  The `OverseerrRequest.type` field mismatch against the official schema is flagged for live-instance
  verification, not spec'd.
- **Out of scope**: user-management and notification-config endpoint groups, per the standing rule
  that an API surface not mapping to a collection of media isn't a task for this product.
- **Naming collisions flagged for the precedence ticket**: `status` (four distinct meanings across
  `overseerrRequestStatus`/media-availability-status/`overseerrIssueStatus`/`tmdbStatus`),
  `overseerrRequestedBy` (generic "added by" collision risk), `overseerrRequestId` (join-key
  reconciliation with `tmdbId`).
