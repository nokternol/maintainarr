---
type: wayfinder-ticket
label: wayfinder:prototype
status: closed
assignee: claude
blocked_by: [05-tautulli-decision]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Tautulli — UI pass

## Question

For every field Tautulli's decision ticket chose to wire as a UI filter, and every task chosen to
expose as an automation option: prototype (`/prototype`) any that need real UI thought (parameters,
non-trivial filter widget shape — e.g. a range vs. a multi-select vs. a date picker), then run an
`impeccable` pass on the resulting filter UI (per field) and automation UI (per task). Record the
UI/UX decisions (widget choice, parameter shape, copy) back into
`docs/in_progress/provider-e2e-spec/specs/tautulli.md`, linking any prototype artifacts rather
than pasting them in.

## Resolution

- **No field needed a `/prototype` session.** Narrowest UI pass in the map so far, matching the
  decision ticket's narrow (per-item-only, no new tasks) scope.
- **`fileContainer`/`videoCodec`/`audioCodec`/`fileResolution`** (`csv-strings`) and
  **`fileSizeBytes`** (`range`) all join routes/rules Plex's and Jellyfin's UI passes already
  established — Tautulli is a third producer, not a new route or widget. Extended Jellyfin's
  "aggregate across every configured producer's data" note to include Tautulli.
- **`fileBitrate`** (`range`) confirmed genuinely new — no earlier provider in this map named a
  bitrate field — but needs no lookup and renders via the existing `NumberRangeFilter`, same shape
  as `sizeOnDiskGb`. No decision beyond confirming the mapping.
- **`tautulliRecentlyAdded`** joins the existing `plexAddedDaysAgo` rule as a second producer (Plex
  wins precedence per the spec) — no new control, rule, or UI change.
- **No tasks to defer.** `deleteWatchHistory` is already wired parameter-free; the decision ticket's
  "no new tasks" holds. Nothing appended to
  [`11-automation-task-parameters`](11-automation-task-parameters.md).
- Full writeup: `docs/in_progress/provider-e2e-spec/specs/tautulli.md`'s "UI decisions" section.

This closes Tautulli's UI pass. `99-precedence` remains blocked on the other 3 providers' UI
tickets (Overseerr, TMDB/OMDB, TVMaze — per map.md's provider list; Seerr shares Overseerr's
implementation).
