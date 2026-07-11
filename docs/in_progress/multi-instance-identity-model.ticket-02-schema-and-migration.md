---
title: "Phase 2: Schema + migration"
labels: [wayfinder:task]
status: open
assignee:
blocked_by: []
---

## Question

Land the `media_identity`/`media_item` schema split and its migration, per
[the design](./multi-instance-identity-model.md) §1–§2 (Implementation order, step 2):

- Rewrite `mediaIdentity` in `server/database/schema.ts`: drop `sourceType`/`sourceId`, add
  `kind`/`title`/`year`, add the per-kind partial-unique indexes (`ux_media_identity_movie_tmdb`,
  `ux_media_identity_show_tvdb`) plus the plain lookup indexes.
- Add the new `mediaItems` table: `providerId` (FK → `metadataProviders`, cascade), `externalId`,
  `mediaIdentityId` (FK, cascade), unique on `(providerId, externalId)`.
- Write `0014_media_identity_split.sql`: the 7-step table rebuild in §1.2 — preserve `media_identity.id`
  so `media_enrichment` rows survive; migrate groups/items only for types with an active instance; drop
  unattributable rows and their enrichment; defensive pre-index tmdb/tvdb dedupe; rename into place.
- Write `0015_filter_value_provider_scope.sql`: nullable `providerId` on `media_query_filter_values`,
  `ON DELETE SET NULL`.
- Implement `resolveGroup` (find-or-create by primary id per kind, fallback chain, fill-only identifier
  merge, never auto-merge two existing groups) per §2, in
  `server/modules/providers/groupResolver.ts` (or inline in the identity job if it stays small — decide
  at implementation time, not a design question).

Verify: migration run against a copy of production-shaped data preserves every `media_enrichment` row
whose owning type has an active instance; `resolveGroup` unit-tested against §2's five numbered rules.
