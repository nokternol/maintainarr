---
title: "Multi-instance MediaSource — build map"
labels: [wayfinder:map]
status: open
---

## Destination

Ship the `media_identity`/`media_item` multi-instance model exactly as designed in
[Multi-instance MediaSource — the `media_identity`/`media_item` model, complete design](./multi-instance-identity-model.md).
Every design decision there is already resolved — nothing on this map is a decision ticket. Reaching the
end of this map means all 8 of the doc's own "Implementation order" phases are built, and the doc's final
phase (its own docs-lifecycle bullet) has executed: the spec deleted, the decided sections promoted to
`docs/architecture/`.

## Notes

- **Tracker:** no hosted issue tracker or local-markdown convention existed for this repo before this
  map; this map introduces one. Map and ticket files are flat markdown siblings of the spec in
  `docs/in_progress/`: `multi-instance-identity-model.map.md` (this file) and
  `multi-instance-identity-model.ticket-NN-<slug>.md`.
- **Claiming:** set `assignee:` in a ticket's frontmatter before starting work on it (the local-markdown
  stand-in for tracker-assignment claim).
- **Blocking:** this tracker has no native dependency graph, so it falls back to a body convention per
  the wayfinder skill — each ticket's frontmatter `blocked_by:` lists the ids (filenames) of tickets that
  must be `status: closed` first. The frontier is the set of open, unassigned tickets whose `blocked_by`
  list is all closed.
- **Execution-carrying map:** the design phase is done, so this map overrides wayfinder's decisions-only
  default (per the skill's "Plan, don't do" section) — every ticket here is a `wayfinder:task`, resolved
  by building and landing the code, not by deciding anything. Ticket bodies point into the spec's numbered
  sections rather than restating them; the spec is the source of truth for every implementation detail.
- **Skills to consult:** `tdd` for every schema/logic ticket; `docs-lifecycle` for the final ticket;
  Ladle-story-first for any client-visible piece (ticket 7).

## Decisions so far

<!-- index of closed tickets — what got built, since this map is execution-carrying -->

- **Phase 1 (`ticket-01-authority-and-factory-surface.md`) — closed.** `MediaKind`/`SOURCE_OWNER_BY_KIND`/
  `isMediaSourceType`/`kindOfSourceType` added to `providers/roles.ts` and exported through
  `providers/index.ts`; `OWNER_TYPE` deleted from `media/mediaSourceFactory.ts` (derives from
  `SOURCE_OWNER_BY_KIND` instead); `ContentType = MediaKind` type alias in `media/filterRegistry.ts`;
  `ProviderInstance`/`createInstances` added to `providers/providerFactory.ts`; `ProviderSet` slimmed
  (no `radarr`/`sonarr` slots, `createMany` drops their branches); `identityJobFactory.ts` adapted to
  `createInstances` + `instanceof` lookups to keep compiling under the still-global single-active
  invariant (Phase 3 replaces this with the real multi-instance loop). No observable behavior change;
  `dependency-cruiser` and full server suite stayed green throughout.

- **Phase 2 (`ticket-02-schema-and-migration.md`) — closed.** `media_identity`/`media_item` schema split
  landed in `server/database/schema.ts` (`0014_media_identity_split.sql`,
  `0015_filter_value_provider_scope.sql`); `resolveGroup` (`providers/groupResolver.ts`) implements the
  find-or-create/fallback-chain/fill-only-merge rules and is unit-tested against all five. **Landed with a
  deliberate single-active-instance shim, not the full design**, to keep the schema change compiling and
  the build green: `IdentityResolutionJob`/`IdentityJobFactory` write through `resolveGroup` + `media_item`
  for at most one Radarr/Sonarr instance each (no loop, no pruning, no orphan sweep — all ticket 3);
  `mergeEnrichment` keeps its old `(sourceType, getSourceId)` signature and resolves the single active
  instance of that type internally (the `(providerId, externalId)`/`itemKey` rewrite is ticket 4);
  `EnrichmentJob.hydrate` dropped the `radarr`/`sonarr` synthesized keys per §5 (this part is real, not
  shimmed). Tickets 3 and 4 each carry a "Starting point" section naming exactly what the shim covers so
  neither mistakes shimmed code for finished work. 658 tests green, typecheck clean, `dependency-cruiser`
  clean.

- **Phase 3 (`ticket-03-identity-job.md`) — closed.** `IdentityResolutionJob.Deps` replaced the ticket-2
  shim's single `radarrProvider`/`sonarrProvider` pair with `movieSources`/`seriesSources` arrays;
  `runForMovies`/`runForSeries` loop every entry, upserting through `resolveGroup` + `media_item` per
  instance, then prune that instance's stale `media_item` rows (externalId no longer in its fetched set)
  and sweep any group left with zero items. `IdentityJobFactory.create()` builds the arrays via
  `createInstances` (ticket 1) instead of `.find()`-ing one instance per type. `runForPlex` is now
  kind-scoped (`WHERE kind = ? AND tmdbId/tvdbId = ?`), closing the cross-namespace collision bug. Verified
  two active instances of the same type both resolve (no last-one-wins, tested by seeding a second active
  row directly since the single-active gate itself is still ticket 6's job to relax); shared-group,
  per-instance pruning, and orphan-sweep behavior are each unit-tested. `systemTaskRunner.ts`'s
  `IdentityJobLike`/`IdentityJobFactoryLike` interfaces untouched, as designed.

- **Phase 4 (`ticket-04-enrichment-paths.md`) — closed.** Removed the ticket-2 shim entirely:
  `NormalizedMovie._sourceIds`/`NormalizedShow._sourceIds` gained `providerId`/`identity`;
  `normalizeRadarrMovie`/`normalizeSonarrSeries` now take `providerId` and populate the logical
  `tmdb`/`imdb`/`tvdb` keys; `sourceAdapters.ts`'s `radarrMediaSource`/`sonarrMediaSource`/`mediaSourceFor`
  thread it through. Added `externalIdOf`/`itemKey` to `mediaItem.ts`. `mergeEnrichment` is now
  `(db, items)` — no `sourceType`/`idOf` params — grouping a batch by each item's own `providerId` and
  joining `media_item` per group, so a browse batch spanning instances resolves correctly without
  cross-attribution (unit-tested directly, including the collision case two instances' distinct copies
  sharing a raw external id). `MediaSource.enrichmentSourceType` is deleted from the contract;
  `MediaQueryEngine.combine` now pools on `itemKey` instead of `source.idOf`. Call sites updated:
  `MediaQueryEngine.evaluate`, `AutomationExecutor.executeWithSources`, `MediaSourceFactory.forContentType`,
  and `media.handler.ts`'s two inline browse sources (the latter under a documented single-active-id bound
  — real per-instance sublists are Phase 7's job, this ticket only had to keep them compiling and correct
  under today's still-global invariant).

- **Phase 5 (`ticket-05-preview-fanout.md`) — closed.** `MediaSourceFactory.forContentType` (single
  active-instance lookup) is replaced by `sourcesFor(contentType): Promise<MediaSourceEntry[]>` — one
  `{ providerId, name, source }` entry per active instance owning that content type, never collapsed. The
  preview handler (`GET /api/media-queries/:id/preview`) evaluates the query spec once per instance and
  returns `{ count, instances: [{ providerId, name, count }] }`, `count` being the sum across instances;
  zero active instances returns `{ count: 0, instances: [] }`. `MediaQuery`/`MediaQuerySpec` in
  `mediaQueryEngine.ts` are untouched — fan-out is the handler's own loop. The client
  (`QuerySourceList`) needed no changes: it only reads `data.count`, unchanged in meaning; `instances` is
  strictly additive.

## Not yet specified

<!-- empty: the spec resolved every design question in scope of this destination -->

## Out of scope

- **`MediaItem` open field shape** (typed union + provenance map vs. a fully open field bag) — the spec
  deliberately keeps `MediaItem`'s current closed-union shape and defers this; it's the still-open
  remainder of `docs/intent/provider-media-identity-model.md`, a separate future effort.
- **Derived rule gating** (a `MediaRule`'s `sourceProviders` projected from field provenance instead of
  hand-kept) — depends on the field-shape decision above landing first; out of scope of this destination.
- **Generalized "provider silently depends on another provider" fracture** (e.g. Tautulli's data being
  entirely Plex-keyed with nothing declaring that dependency) — flagged in
  `docs/intent/provider-media-identity-model.md` as its own unresolved investigation, not part of this
  model's build.
