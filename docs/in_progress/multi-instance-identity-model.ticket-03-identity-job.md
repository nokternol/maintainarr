---
title: "Phase 3: Identity job"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-01-authority-and-factory-surface.md, multi-instance-identity-model.ticket-02-schema-and-migration.md]
---

## Question

Rewrite `IdentityJobFactory`/`IdentityResolutionJob` to loop every active instance per type instead of
collapsing to one, per [the design](./multi-instance-identity-model.md) §3 (Implementation order, step 3):

- `IdentityJobFactory.create()`: build one `{ providerId, provider }` entry per active Radarr/Sonarr
  instance via `createInstances` (ticket 1); keep Plex/TVMaze construction as today.
- `IdentityResolutionJob.runForMovies()`/`runForSeries()`: per instance, resolve each item's group via
  `resolveGroup` (ticket 2), upsert `media_item` on `(providerId, externalId)`, then prune that
  instance's rows no longer in the fetched set.
- `runForPlex()`: kind-scope the stamp (`WHERE kind = ? AND tmdbId/tvdbId = ?`), closing the
  cross-namespace collision bug named in §3.
- Add the orphan sweep: delete `media_identity` groups with zero `media_item` rows (enrichment cascades).
- `systemTaskRunner.ts`'s `IdentityJobLike`/`IdentityJobFactoryLike` interfaces are unchanged; counts
  become totals across instances.

Verify: two active instances of the same type both get resolved (no last-one-wins); an item removed from
an instance's library is pruned and its orphaned group (if any) is swept.
