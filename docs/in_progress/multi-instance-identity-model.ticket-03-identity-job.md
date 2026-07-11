---
title: "Phase 3: Identity job"
labels: [wayfinder:task]
status: closed
assignee: claude
blocked_by: [multi-instance-identity-model.ticket-01-authority-and-factory-surface.md, multi-instance-identity-model.ticket-02-schema-and-migration.md]
---

## Starting point — the ticket-2 shim

Ticket 2 landed the schema split, but `IdentityResolutionJob`/`IdentityJobFactory` compile against it via a
**single-instance shim**, not this ticket's multi-instance design — do not mistake the shim for done work:

- `IdentityJobFactory.create()` finds at most one Radarr/Sonarr/Plex instance each (`instances.find(...)`
  over `createInstances`'s array) and passes a single `{ provider, providerId }` pair per type — never a
  loop. This only stays correct because the single-active invariant is still global (ticket 6 hasn't run).
- `IdentityResolutionJob.Deps` takes `radarrProvider`/`radarrProviderId` and
  `sonarrProvider`/`sonarrProviderId` as single optional pairs (not the `movieSources`/`seriesSources`
  arrays this ticket's §3 design calls for).
- `runForMovies`/`runForSeries` already call `resolveGroup` (ticket 2) and upsert `media_item` on
  `(providerId, externalId)` for that one instance — this part matches the design and does not need
  redoing, only generalizing to a loop.
- No pruning and no orphan sweep exist yet — both are new in this ticket.
- `runForPlex` is unchanged from before ticket 2 (unscoped by kind) — the cross-namespace collision bug
  is still open; this ticket closes it.

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
