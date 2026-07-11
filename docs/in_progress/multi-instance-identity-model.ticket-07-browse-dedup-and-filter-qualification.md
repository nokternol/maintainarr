---
title: "Phase 7: Browse dedup + filter qualification"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: [multi-instance-identity-model.ticket-06-relax-invariant.md]
---

## Question

Build the multi-instance browse/query surface, per [the design](./multi-instance-identity-model.md)
§8 and §10 (Implementation order, step 7):

- `media.handler.ts`'s `getMovies()`/`getSeries()` caches become per-instance sublists; the inline
  `MediaSource` normalizes with provenance; raw-row recovery matches by `itemKey` instead of raw ids.
- Display dedup: group matched raw rows by native primary id (`tmdbId`/`tvdbId`, fallback
  `${providerId}:${id}`), computed live per request. ANY filter semantics (grouping after engine
  matching). Representative + badge row composition: `sourceCount`, `sourceProviderIds` additive fields.
  Pagination/totals operate on grouped rows.
- Option catalogs (`listTags`, `listQualityProfiles`, `listSources`) gain provider decoration
  (`providerId`/`providerName`, `instances` on `MediaSourceDescriptor`).
- `MediaRule.instanceScoped` on `qualityProfileIds`/`tagIds` (both content-type variants);
  `FilterValueEntry.providerId`, persisted via the migration from ticket 2; the per-entry provider gate
  in `matchItems` (unqualified = today's behavior; qualified = matches only that instance's items).
- Two new `QueryHealth` degradation reasons: dangling `providerId` qualification, and an entry qualified
  to a provider other than an automation's own binding.
- Client filter bar: per-instance grouped options and qualified-entry emission when >1 active instance;
  unqualified emission (today's wire shape) with exactly one. **Ladle story first** per repo convention,
  then verify in `yarn dev`.

Verify: with one active instance every behavior (browse rows, filter matching, wire shape) is
byte-identical to pre-change; with two, "do I have this in 4k?" style cross-instance browsing and
instance-qualified filters both work as described in §8/§10.
