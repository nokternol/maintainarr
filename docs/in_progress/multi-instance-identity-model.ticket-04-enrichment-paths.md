---
title: "Phase 4: Enrichment paths"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-02-schema-and-migration.md, multi-instance-identity-model.ticket-03-identity-job.md]
---

## Starting point — the ticket-2 shim

Ticket 2 landed a **single-active-instance shim** for `mergeEnrichment` and `EnrichmentJob.hydrate` to keep
them compiling against the split schema — neither matches this ticket's design yet:

- `mergeEnrichment` (`enrichmentMerge.ts`) keeps its ticket-1-era signature —
  `(db, items, sourceType: 'RADARR' | 'SONARR', getSourceId)` — unchanged. Internally it now resolves the
  *active* instance of `sourceType` (`metadataProviders` where `type = sourceType AND isActive`) and joins
  through `media_item` on `(providerId, externalId)` instead of querying `media_identity` directly by the
  now-removed `sourceType`/`sourceId` columns. It assumes exactly one active instance per type — this
  ticket's `(providerId, externalId)`/`itemKey`-keyed rewrite is what removes that assumption and the
  `sourceType`/`idOf` parameters.
- `EnrichmentJob.hydrate` already dropped the `radarr`/`sonarr` synthesized keys and added `identity:
  identity.id` to `_sourceIds` — this is exactly this ticket's §5 change and does not need redoing, only
  the `identityKey` doc-comment/verification pass this ticket calls for.
- `NormalizedMovie._sourceIds`/`NormalizedShow._sourceIds` do **not** yet carry `providerId`, and
  `normalizeRadarrMovie`/`normalizeSonarrSeries`/`sourceAdapters.ts` do **not** yet thread it — that
  thread-through is still entirely this ticket's work, not started.
- `MediaSource.enrichmentSourceType` and `MediaQueryEngine.combine`'s `source.idOf`-keyed pooling are
  unchanged from before ticket 2.

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
