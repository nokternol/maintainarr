---
title: "Phase 6: Relax the invariant"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-02-schema-and-migration.md, multi-instance-identity-model.ticket-03-identity-job.md, multi-instance-identity-model.ticket-04-enrichment-paths.md, multi-instance-identity-model.ticket-05-preview-fanout.md]
---

## Question

Flip `assertNoActiveConflict` (`server/modules/providers/providerSettingsService.ts`) to early-return
for `isMediaSourceType(type)`, per [the design](./multi-instance-identity-model.md) §6 (Implementation
order, step 6) — the switch that makes a second active `MediaSource` instance reachable for the first
time. This ticket must land only after tickets 2–5 (schema, identity job, enrichment paths, preview
fan-out) are built and passing, since it's what makes multi-instance data actually start flowing through
them. Non-source types keep the existing invariant and its `ValidationError` unchanged. Update the D8
invariant comment to state the role scoping.

Verify: configuring a second active Radarr (or Sonarr) instance now succeeds and both instances resolve,
enrich, and preview correctly; configuring a second active TMDB/Overseerr/Tautulli/Plex-as-enricher/
Jellyfin instance still fails with the existing error.
