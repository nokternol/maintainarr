---
type: wayfinder-ticket
label: wayfinder:grilling
status: closed
assignee: claude
blocked_by: [05-tautulli-research]
parent: docs/in_progress/provider-e2e-spec/map.md
---

# Tautulli — decision

## Question

Using the Tautulli research ticket's gap-list, grill the user (`/grilling`, `/domain-modeling`
as needed) to decide Tautulli's full e2e spec: which fields and tasks are worth wiring, what
domain field names they map to, how each field's value flows (db/config surface → provider field
→ query engine → enrichment → UI filter), what tasks/actions become automation options,
and what a user-facing description of each looks like. Write the result to
`docs/in_progress/provider-e2e-spec/specs/tautulli.md`.

Any field/task the research ticket flagged as needing a structural schema change: raise it to the
user as a blocker in this session, do not decide its shape unilaterally. Any field-name collision
risk the research ticket flagged: note it in the spec file for the final precedence ticket to
resolve, don't resolve it here.

## Assets

- [specs/tautulli.md](../specs/tautulli.md) — full e2e spec.

## Resolution

- **Standing scoping premise applied**: only per-item fields and per-item tasks are in scope. This
  excludes essentially all of Tautulli's unwired surface at once — per-user data, session/live data,
  library-level (non-item) stats, aggregate/reporting, notifications, server/config/logs — without
  litigating each individually.
- **Only one new field group survives**: `get_library_media_info` (container, bitrate, codecs,
  resolution, file size) — confirmed genuinely per-item, unlike the rest of the audit.
- **`get_metadata` dropped outright**: not just low-priority — the current design routes
  movie/show metadata through Radarr/Sonarr as `MediaSource` owners, so a Plex-lineage copy (direct
  or via Tautulli) can no longer be authoritative for that role.
- **`get_recently_added` wired, with an explicit precedence call**: unlike Radarr/Sonarr's `added`
  (a genuinely different event from `plexAddedAt`, which must never contest with it), Tautulli's
  recently-added mirrors the *same* Plex library-add event through a second API. Decided: this one
  **does** contest with `plexAddedAt`, and **Plex wins** as the direct source — encoded in the spec
  for the precedence ticket to carry forward, not re-open.
- **Dead code cleanup in scope**: `getLibraryStats()`/`getHomeStats()` are implemented, called, but
  consumed nowhere downstream — removed as part of this spec (also excluded by the per-item premise
  regardless, since both are library/instance-scoped).
- **No new tasks**: every other Tautulli action (`delete_all_user_history`, `terminate_session`,
  `delete_all_library_history`, notification sends) is excluded by the per-item-tasks-only premise.
