---
title: "Phase 4: Enrichment paths"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-02-schema-and-migration.md, multi-instance-identity-model.ticket-03-identity-job.md]
---

## Question

Re-key enrichment attribution around the group/instance split, per
[the design](./multi-instance-identity-model.md) §4–§5 and §8's matching change (Implementation order,
step 4):

- Add `providerId?: number` to `NormalizedMovie._sourceIds`/`NormalizedShow._sourceIds`; thread it
  through `normalizeRadarrMovie`/`normalizeSonarrSeries` and `sourceAdapters.ts`'s
  `radarrMediaSource`/`sonarrMediaSource`/`mediaSourceFor`; start populating the logical keys
  (`tmdb`/`imdb`/`tvdb`) those normalizers currently drop.
- Add `externalIdOf`/`itemKey` helpers to `mediaItem.ts`.
- Rewrite `mergeEnrichment` (`enrichmentMerge.ts`) to take just `(db, items)` and join through
  `media_item` by `(providerId, externalId)` instead of a type/`idOf` pair; update its one caller
  (`MediaQueryEngine.evaluate`).
- Update `EnrichmentJob`'s `hydrate`/`identityKey` to build `_sourceIds` with an `identity` key instead
  of synthesized `radarr`/`sonarr` ids (collision-free hydrated keys).
- Delete `MediaSource.enrichmentSourceType` from the contract.
- Update `MediaQueryEngine.combine` to key pooled items on `itemKey` instead of `source.idOf`.
- Update `AutomationExecutor.executeWithSources`'s `mediaSourceFor` call site for the new signature.

Verify: two items from two instances that resolve to the same group read identical group-level
enrichment; a browse batch spanning two instances doesn't cross-attribute enrichment.
